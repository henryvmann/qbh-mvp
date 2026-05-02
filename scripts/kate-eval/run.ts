/**
 * Kate conversation eval harness.
 *
 * Loads each fixture, drives Kate's full stack (rule → voice → LLM)
 * against the synthetic facts, captures her message, sends Kate's
 * actual response + the per-fixture rubric to a Claude analyzer pass,
 * scores each quality 0-1, aggregates per-fixture pass/fail.
 *
 * CLI:
 *   npx tsx scripts/kate-eval/run.ts                   # full set
 *   npx tsx scripts/kate-eval/run.ts --fixture <id>    # one case
 *   npx tsx scripts/kate-eval/run.ts --threshold 0.8   # required pass rate
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env.local") });

import { FIXTURES, type KateFixture, type KateQuality } from "./fixtures";

// Lazy import so env loads first
async function getKate() {
  const mod = await import("../../src/lib/qbh/kate/state");
  return {
    composeOpeningFromFacts: mod.composeOpeningFromFacts,
    composeReplyFromFacts: mod.composeReplyFromFacts,
  };
}

async function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing — required for the analyzer pass");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  return new Anthropic({ apiKey });
}

const ANALYZER_MODEL = "claude-sonnet-4-5";

const ANALYZER_SYSTEM_PROMPT = `You are scoring Kate's response against a rubric.

You will be given:
- A short fixture description (the situation Kate was in)
- Kate's actual response message
- A rubric of qualities. Each quality has:
    - id: stable identifier
    - must: true if the quality must be PRESENT, false if it must be ABSENT
    - description: what the quality actually is

Score each quality on a 0–1 scale:
  - 1.0 = the quality is clearly present (or clearly absent, if must=false)
  - 0.5 = ambiguous / borderline
  - 0.0 = the quality is clearly absent (or clearly present, if must=false)

Return ONLY a JSON object in this exact shape:
{
  "scores": [
    { "quality_id": "<id>", "score": 0.0-1.0, "reasoning": "<one short sentence>" }
  ]
}

Be strict but fair. Hallucinations and false-completion claims are always 0.
Calm, brief, accurate language is always 1 when "must" calls for it.`;

type QualityScore = {
  quality_id: string;
  score: number;
  reasoning: string;
  must: boolean;
  pass: boolean; // score ≥ 0.6
};

type FixtureResult = {
  fixture_id: string;
  description: string;
  kate_message: string;
  qualities: QualityScore[];
  pass_count: number;
  total_count: number;
  pass_rate: number; // pass_count / total_count
};

async function runFixture(fixture: KateFixture): Promise<FixtureResult> {
  const { composeOpeningFromFacts, composeReplyFromFacts } = await getKate();
  const state = fixture.userReply
    ? await composeReplyFromFacts({ facts: fixture.facts, userReply: fixture.userReply })
    : await composeOpeningFromFacts(fixture.facts);

  const kateMessage = state.message || "";
  const anthropic = await getAnthropic();

  const userPayload = {
    fixture_description: fixture.description,
    kate_message: kateMessage,
    rubric: fixture.qualities.map((q) => ({
      id: q.id,
      must: q.must,
      description: q.description,
    })),
  };

  const resp = await anthropic.messages.create({
    model: ANALYZER_MODEL,
    max_tokens: 800,
    system: ANALYZER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });

  const block = resp.content.find((b) => b.type === "text");
  const raw = block && "text" in block ? block.text : "";

  let parsed: { scores: { quality_id: string; score: number; reasoning: string }[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to extract JSON
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`analyzer returned non-JSON for ${fixture.id}: ${raw.slice(0, 200)}`);
    parsed = JSON.parse(m[0]);
  }

  // Map analyzer scores back to qualities + pass/fail
  const qualityById = new Map(fixture.qualities.map((q) => [q.id, q]));
  const qualityScores: QualityScore[] = [];
  for (const s of parsed.scores) {
    const q = qualityById.get(s.quality_id);
    if (!q) continue;
    const passThreshold = 0.6;
    qualityScores.push({
      quality_id: s.quality_id,
      score: s.score,
      reasoning: s.reasoning,
      must: q.must,
      pass: s.score >= passThreshold,
    });
  }

  // Backfill any rubric items the analyzer didn't address
  for (const q of fixture.qualities) {
    if (!qualityScores.find((s) => s.quality_id === q.id)) {
      qualityScores.push({
        quality_id: q.id,
        score: 0,
        reasoning: "[analyzer omitted]",
        must: q.must,
        pass: false,
      });
    }
  }

  const passCount = qualityScores.filter((q) => q.pass).length;
  return {
    fixture_id: fixture.id,
    description: fixture.description,
    kate_message: kateMessage,
    qualities: qualityScores,
    pass_count: passCount,
    total_count: qualityScores.length,
    pass_rate: passCount / qualityScores.length,
  };
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function printResult(r: FixtureResult) {
  const passed = r.pass_rate >= 0.85;
  const emoji = passed ? "✅" : "❌";
  console.log(`\n${emoji} ${r.fixture_id} — ${r.pass_count}/${r.total_count} (${fmtPct(r.pass_rate)})`);
  console.log(`   ${r.description}`);
  console.log(`   Kate: ${quote(r.kate_message)}`);
  for (const q of r.qualities) {
    const tick = q.pass ? "✓" : "✗";
    const badge = q.must ? "MUST" : "MUST NOT";
    console.log(`   ${tick} [${badge}] ${q.quality_id} (${q.score.toFixed(2)}): ${q.reasoning}`);
  }
}

function quote(s: string): string {
  const single = s.replace(/\n+/g, " ↵ ");
  return single.length > 280 ? `"${single.slice(0, 280)}…"` : `"${single}"`;
}

async function main() {
  const args = process.argv.slice(2);
  const fixtureFlag = args.indexOf("--fixture");
  const fixtureId = fixtureFlag >= 0 ? args[fixtureFlag + 1] : null;
  const thresholdFlag = args.indexOf("--threshold");
  const passThreshold = thresholdFlag >= 0 ? Number(args[thresholdFlag + 1]) : 0.85;

  const set = fixtureId
    ? FIXTURES.filter((f) => f.id === fixtureId)
    : FIXTURES;
  if (set.length === 0) {
    console.error(`No fixtures matched: ${fixtureId}`);
    process.exit(1);
  }

  console.log(`[kate-eval] running ${set.length} fixture(s)`);
  const results: FixtureResult[] = [];
  for (const fx of set) {
    try {
      const r = await runFixture(fx);
      printResult(r);
      results.push(r);
    } catch (err) {
      console.error(`[kate-eval] ${fx.id} failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Aggregate
  const allQualities = results.flatMap((r) => r.qualities);
  const total = allQualities.length;
  const passed = allQualities.filter((q) => q.pass).length;
  const overallPassRate = total === 0 ? 0 : passed / total;
  const fixtureFails = results.filter((r) => r.pass_rate < passThreshold);

  console.log("\n" + "=".repeat(64));
  console.log("KATE-EVAL SUMMARY");
  console.log("=".repeat(64));
  console.log(`Fixtures:        ${results.length}`);
  console.log(`Quality checks:  ${passed}/${total} = ${fmtPct(overallPassRate)}`);
  console.log(`Fixtures < ${fmtPct(passThreshold)} threshold: ${fixtureFails.length}`);
  for (const f of fixtureFails) {
    console.log(`  - ${f.fixture_id} (${fmtPct(f.pass_rate)})`);
  }

  // Save
  const dir = path.resolve(__dirname, "runs");
  fs.mkdirSync(dir, { recursive: true });
  const filename = `run-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(dir, filename),
    JSON.stringify({ overallPassRate, results }, null, 2)
  );
  console.log(`\n[kate-eval] saved → scripts/kate-eval/runs/${filename}`);

  if (fixtureFails.length > 0) {
    console.error(`\n❌ KATE GATE FAILED — ${fixtureFails.length} fixture(s) below ${fmtPct(passThreshold)} threshold.\n`);
    process.exit(1);
  }
  console.log(`\n✅ Kate gate clean — all fixtures ≥ ${fmtPct(passThreshold)}.\n`);
}

main().catch((err) => {
  console.error("[kate-eval] fatal:", err);
  process.exit(1);
});
