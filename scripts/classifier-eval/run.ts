/**
 * Classifier eval harness.
 *
 * Generates a fixture batch, feeds it to buildProviderRegistry, and
 * compares the output to the ground-truth labels. Emits precision,
 * recall, F1, and ranked false-positive / false-negative lists. Saves
 * a run record so we can track score over time as the classifier
 * prompt or rules change.
 *
 * CLI:
 *   npx tsx scripts/classifier-eval/run.ts --size 2000 --seed 42
 *   npx tsx scripts/classifier-eval/run.ts --variance 5   (5 batches, mean ± stddev)
 */

// Load env BEFORE importing the classifier — classify-transactions.ts
// reads OPENAI_API_KEY at module-evaluation time, so we use a dynamic
// import after dotenv has populated process.env.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env.local") });

import { makeFixtureBatch, truthProvidersFromBatch, type FixtureBatch, type LabeledTx } from "./generate";
import { expandGoldenSet, GOLDEN_SEEDS } from "./golden";
import { expandEmbarrassmentList, EMBARRASSMENT_LIST } from "./embarrassment";
import type { DiscoveredProvider } from "../../src/lib/qbh/discovery/build-provider-registry";

// Dynamically import the classifier so OPENAI_API_KEY is available.
async function getBuildProviderRegistry() {
  const mod = await import("../../src/lib/qbh/discovery/build-provider-registry");
  return mod.buildProviderRegistry;
}

// ─────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────

type EvalResult = {
  seed: number;
  fixture_size: number;
  truth_providers: number;
  truth_healthcare_providers: number;
  output_providers: number;
  output_healthcare_count: number;
  output_review_needed_count: number;
  precision: number;
  recall: number;
  f1: number;
  false_positives: Array<{ name: string; bucket: string; classifier_type: string | null }>;
  false_negatives: Array<{ name: string; expected_type: string | null; tag: string | undefined; visit_count: number }>;
  bucket_accuracy: Record<string, { correct: number; total: number; pct: number }>;
  failure_groups: Record<string, { fp: number; fn: number }>;
};

function normalize(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function nameMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Allow either-direction substring containment for variants like
  // "MODERN DERMATOLOGY" vs "MODERN DERMATOLOGY ASSOC".
  if (na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na))) return true;
  return false;
}

/** Map a classifier-returned provider_type (which may be either an AI
 *  bucket like "mental_health" OR a raw NPI taxonomy like "Counselor,
 *  Addiction (Substance Use Disorder)") onto our broad bucket taxonomy
 *  for accuracy comparison. */
function broadBucket(s: string | null): string | null {
  if (!s) return null;
  const t = s.toLowerCase();
  if (/mental_health|psychiatr|psycholog|counselor|social worker|marriage and family|behavioral|therapist, mental/.test(t)) return "mental_health";
  if (/^pt$|physical therap|occupational therap|kinesiotherap/.test(t)) return "pt";
  if (/dentist|dental|orthodont|periodont/.test(t)) return "dentist";
  if (/optometr|ophthalmolog|vision|eyewear/.test(t)) return "vision";
  if (/pharmacy/.test(t)) return "pharmacy";
  if (/lab|laboratory|pathology|radiology|imaging/.test(t)) return "lab";
  if (/hospital|health system|medical center/.test(t)) return "hospital";
  if (/urgent care/.test(t)) return "urgent_care";
  if (/cardiolog|dermatolog|gastroenterolog|neurolog|orthopedic|surgeon|surgery|specialist|gynecolog|urolog|endocrinolog|rheumatolog|allerg/.test(t)) return "specialist";
  if (/chiropract/.test(t)) return "chiropractic";
  if (/pediatric/.test(t)) return "doctor";
  if (/family|internal medicine|general practice|primary care|nurse practitioner|physician assistant|^doctor$/.test(t)) return "doctor";
  return null;
}

function score(batch: FixtureBatch, output: DiscoveredProvider[]): EvalResult {
  const truth = truthProvidersFromBatch(batch);
  const truthHealthcare = truth.filter((p) => p.is_healthcare);

  // Output providers we'd actually surface — HEALTHCARE bucket only counts
  // as a "confident" classification. REVIEW_NEEDED is also "we think it's
  // healthcare" but lower confidence; treat it as a positive for recall
  // (we did flag it) but not precision-critical for the dashboard.
  const outputHealthcare = output.filter((p) => p.bucket === "HEALTHCARE");
  const outputReviewNeeded = output.filter((p) => p.bucket === "REVIEW_NEEDED");

  // Build lookup of all output providers for matching
  const allOutput = [...outputHealthcare, ...outputReviewNeeded];

  // For each truth-healthcare provider, was it caught (any bucket)?
  let truePositives = 0;
  const falseNegatives: EvalResult["false_negatives"] = [];
  for (const t of truthHealthcare) {
    const matched = allOutput.find((o) => nameMatch(o.normalized_name || o.provider_name, t.canonical_name));
    if (matched) {
      truePositives++;
    } else {
      falseNegatives.push({
        name: t.canonical_name,
        expected_type: t.expected_provider_type,
        tag: t.tag,
        visit_count: t.visit_count,
      });
    }
  }

  // For each output-confident-healthcare provider, was it actually healthcare?
  let confidentTruePositives = 0;
  const falsePositives: EvalResult["false_positives"] = [];
  for (const o of outputHealthcare) {
    const matched = truth.find((t) => nameMatch(o.normalized_name || o.provider_name, t.canonical_name));
    if (matched && matched.is_healthcare) {
      confidentTruePositives++;
    } else {
      falsePositives.push({
        name: o.provider_name,
        bucket: o.bucket,
        classifier_type: o.provider_type,
      });
    }
  }

  // Precision is on confident HEALTHCARE only (this is what users see on
  // dashboard). Recall is on ALL flagged (HEALTHCARE + REVIEW_NEEDED) since
  // review_needed surfaces in onboarding's Keep/Drop step.
  const precision = outputHealthcare.length === 0 ? 1 : confidentTruePositives / outputHealthcare.length;
  const recall = truthHealthcare.length === 0 ? 1 : truePositives / truthHealthcare.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  // Bucket accuracy — for matched true-healthcare, did the classifier pick
  // the right provider_type? Compare via broadBucket() so an NPI taxonomy
  // like "Counselor, Addiction (Substance Use Disorder)" still maps to
  // "mental_health" and gets credit.
  const bucketStats: Record<string, { correct: number; total: number }> = {};
  for (const t of truthHealthcare) {
    if (!t.expected_provider_type) continue;
    const b = t.expected_provider_type;
    bucketStats[b] = bucketStats[b] || { correct: 0, total: 0 };
    bucketStats[b].total++;
    const matched = allOutput.find((o) => nameMatch(o.normalized_name || o.provider_name, t.canonical_name));
    if (matched && broadBucket(matched.provider_type) === b) bucketStats[b].correct++;
  }
  const bucketAccuracy: EvalResult["bucket_accuracy"] = {};
  for (const [k, v] of Object.entries(bucketStats)) {
    bucketAccuracy[k] = { correct: v.correct, total: v.total, pct: v.total === 0 ? 0 : v.correct / v.total };
  }

  // Failure groups — group FP/FN by tag from the seed
  const failureGroups: Record<string, { fp: number; fn: number }> = {};
  for (const fn of falseNegatives) {
    const tag = fn.tag || "untagged";
    failureGroups[tag] = failureGroups[tag] || { fp: 0, fn: 0 };
    failureGroups[tag].fn++;
  }
  for (const fp of falsePositives) {
    // Find the truth row for this name to recover the tag
    const truthRow = truth.find((t) => nameMatch(fp.name, t.canonical_name));
    const tag = truthRow?.tag || "untagged";
    failureGroups[tag] = failureGroups[tag] || { fp: 0, fn: 0 };
    failureGroups[tag].fp++;
  }

  return {
    seed: batch.seed,
    fixture_size: batch.txs.length,
    truth_providers: truth.length,
    truth_healthcare_providers: truthHealthcare.length,
    output_providers: output.length,
    output_healthcare_count: outputHealthcare.length,
    output_review_needed_count: outputReviewNeeded.length,
    precision,
    recall,
    f1,
    false_positives: falsePositives,
    false_negatives: falseNegatives,
    bucket_accuracy: bucketAccuracy,
    failure_groups: failureGroups,
  };
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function printResult(r: EvalResult) {
  console.log("\n" + "=".repeat(64));
  console.log(`RUN  seed=${r.seed}  size=${r.fixture_size}`);
  console.log("=".repeat(64));
  console.log(`Truth: ${r.truth_providers} unique merchants (${r.truth_healthcare_providers} healthcare)`);
  console.log(`Output: ${r.output_healthcare_count} HEALTHCARE + ${r.output_review_needed_count} REVIEW_NEEDED = ${r.output_providers} total`);
  console.log("");
  console.log(`PRECISION (of HEALTHCARE-bucket, % truly healthcare):  ${fmtPct(r.precision)}`);
  console.log(`RECALL    (of true healthcare, % flagged at all):     ${fmtPct(r.recall)}`);
  console.log(`F1:                                                    ${r.f1.toFixed(3)}`);
  console.log("");

  if (Object.keys(r.bucket_accuracy).length > 0) {
    console.log("Bucket accuracy (correct provider_type when matched):");
    for (const [b, v] of Object.entries(r.bucket_accuracy).sort()) {
      console.log(`  ${b.padEnd(15)} ${v.correct}/${v.total} = ${fmtPct(v.pct)}`);
    }
    console.log("");
  }

  if (r.false_negatives.length > 0) {
    console.log(`False negatives (${r.false_negatives.length}) — true healthcare we missed:`);
    for (const fn of r.false_negatives.slice(0, 25)) {
      console.log(`  - "${fn.name}" [tag=${fn.tag}, expected=${fn.expected_type}, visits=${fn.visit_count}]`);
    }
    if (r.false_negatives.length > 25) console.log(`  ... and ${r.false_negatives.length - 25} more`);
    console.log("");
  }

  if (r.false_positives.length > 0) {
    console.log(`False positives (${r.false_positives.length}) — non-healthcare we falsely flagged HEALTHCARE:`);
    for (const fp of r.false_positives.slice(0, 25)) {
      console.log(`  - "${fp.name}" [classified as ${fp.classifier_type ?? "no-type"}]`);
    }
    if (r.false_positives.length > 25) console.log(`  ... and ${r.false_positives.length - 25} more`);
    console.log("");
  }

  if (Object.keys(r.failure_groups).length > 0) {
    console.log("Failures by tag:");
    const rows = Object.entries(r.failure_groups)
      .filter(([, v]) => v.fp + v.fn > 0)
      .sort((a, b) => (b[1].fp + b[1].fn) - (a[1].fp + a[1].fn));
    for (const [tag, v] of rows) {
      console.log(`  ${tag.padEnd(28)} fp=${v.fp.toString().padStart(2)}  fn=${v.fn.toString().padStart(2)}`);
    }
  }
  console.log("");
}

async function runOne(opts: { seed?: number; size?: number }): Promise<EvalResult> {
  const batch = makeFixtureBatch({ size: opts.size, seed: opts.seed });
  console.log(`[eval] generated ${batch.txs.length} txs (seed=${batch.seed}); ${batch.stats.healthcare_tx} healthcare, ${batch.stats.non_healthcare_tx} non, ${batch.stats.ambiguous_tx} ambiguous`);

  const buildProviderRegistry = await getBuildProviderRegistry();
  // Unwrap LabeledTx → bare Plaid transactions (the classifier doesn't see truth labels).
  const plaidTxs = batch.txs.map((row) => row.tx);
  const start = Date.now();
  const output = await buildProviderRegistry(plaidTxs);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[eval] classifier completed in ${elapsed}s`);

  const result = score(batch, output);
  return result;
}

/** Wrap a fixed LabeledTx[] into a FixtureBatch and run the same scorer. */
async function runFixed(label: string, txs: LabeledTx[]): Promise<EvalResult> {
  const batch: FixtureBatch = {
    seed: 0,
    txs,
    stats: {
      total: txs.length,
      healthcare_tx: txs.filter((t) => t.truth.is_healthcare).length,
      non_healthcare_tx: txs.filter((t) => !t.truth.is_healthcare).length,
      ambiguous_tx: 0,
    },
  };
  console.log(`[eval] ${label}: ${batch.txs.length} txs (${batch.stats.healthcare_tx} healthcare, ${batch.stats.non_healthcare_tx} non)`);
  const buildProviderRegistry = await getBuildProviderRegistry();
  const start = Date.now();
  const output = await buildProviderRegistry(batch.txs.map((r) => r.tx));
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[eval] classifier completed in ${elapsed}s`);
  return score(batch, output);
}

function saveRun(r: EvalResult) {
  const dir = path.resolve(__dirname, "runs");
  fs.mkdirSync(dir, { recursive: true });
  const filename = `run-${Date.now()}-seed${r.seed}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(r, null, 2));
  console.log(`[eval] saved → scripts/classifier-eval/runs/${filename}`);
}

async function main() {
  const args = process.argv.slice(2);
  const get = (k: string): string | undefined => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (k: string) => args.includes(`--${k}`);

  const size = Number(get("size") ?? 2000);
  const seed = get("seed") ? Number(get("seed")) : undefined;
  const variance = get("variance") ? Number(get("variance")) : 0;

  // ── Embarrassment mode ──────────────────────────────────────────
  // Zero-tolerance test. ANY confident false-positive on this list
  // exits non-zero — meant to be wired into a CI / pre-deploy gate.
  if (has("embarrassment") || has("all")) {
    console.log("\n[eval] running EMBARRASSMENT LIST — zero-tolerance gate");
    const r = await runFixed(
      `embarrassment (${EMBARRASSMENT_LIST.length} merchants)`,
      expandEmbarrassmentList()
    );
    printResult(r);
    saveRun(r);
    if (r.false_positives.length > 0) {
      console.error(
        `\n❌ EMBARRASSMENT GATE FAILED — ${r.false_positives.length} merchants would surface as healthcare to a real user. Hard launch blocker.\n`
      );
      if (!has("all")) process.exit(1);
    } else {
      console.log("\n✅ Embarrassment gate clean — zero false positives.\n");
    }
    if (!has("all")) return;
  }

  // ── Golden mode ────────────────────────────────────────────────
  // Curated regression suite. Tracks F1; gates on F1 ≥ 0.95.
  if (has("golden") || has("all")) {
    console.log("\n[eval] running GOLDEN SET — regression gate");
    const r = await runFixed(
      `golden (${GOLDEN_SEEDS.length} merchants)`,
      expandGoldenSet()
    );
    printResult(r);
    saveRun(r);
    const threshold = Number(get("golden-threshold") ?? 0.95);
    if (r.f1 < threshold) {
      console.error(
        `\n❌ GOLDEN F1 ${r.f1.toFixed(3)} below ${threshold}. Regression in classifier behavior.\n`
      );
      if (!has("all")) process.exit(1);
    } else {
      console.log(`\n✅ Golden gate passed — F1 ${r.f1.toFixed(3)} ≥ ${threshold}.\n`);
    }
    if (!has("all")) return;
  }

  // After --all, both gates above ran. Report combined status.
  if (has("all")) return;

  if (variance > 0) {
    console.log(`[eval] running variance test: ${variance} batches`);
    const results: EvalResult[] = [];
    for (let i = 0; i < variance; i++) {
      const r = await runOne({ size });
      printResult(r);
      saveRun(r);
      results.push(r);
    }
    const ps = results.map(r => r.precision);
    const rs = results.map(r => r.recall);
    const fs2 = results.map(r => r.f1);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const std = (xs: number[]) => {
      const m = mean(xs);
      return Math.sqrt(xs.map(x => (x - m) ** 2).reduce((a, b) => a + b, 0) / xs.length);
    };
    console.log("\n" + "=".repeat(64));
    console.log("VARIANCE SUMMARY across " + variance + " batches");
    console.log("=".repeat(64));
    console.log(`Precision: mean=${fmtPct(mean(ps))}  stddev=${fmtPct(std(ps))}`);
    console.log(`Recall:    mean=${fmtPct(mean(rs))}  stddev=${fmtPct(std(rs))}`);
    console.log(`F1:        mean=${mean(fs2).toFixed(3)}  stddev=${std(fs2).toFixed(3)}`);
    return;
  }

  const r = await runOne({ size, seed });
  printResult(r);
  saveRun(r);
}

main().catch((err) => {
  console.error("[eval] fatal:", err);
  process.exit(1);
});
