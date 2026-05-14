// Pull the last N graded calls and produce a single readable report:
//   - Overall pass rate + score distribution
//   - Pass rate per date_pattern (where the language failure modes live)
//   - Regression slot results (Caroline Andrew, must be 100%)
//   - Pass rate on each new rubric line (date_accuracy,
//     disambiguation_when_needed, care_coordinator_posture)
//   - Worst-scored calls with one-line scenario + issue summary
//
// Usage:
//   node scripts/summarize-test-run.mjs              # last 50
//   node scripts/summarize-test-run.mjs --count 100  # last 100

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const COUNT = parseInt(args.count || "50", 10);

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: logs } = await sb
  .from("call_test_logs")
  .select("call_id, score, analysis, created_at")
  .order("created_at", { ascending: false })
  .limit(COUNT);

if (!logs || logs.length === 0) {
  console.log("No graded calls yet. Webhooks still in flight — try again in a few minutes.");
  process.exit(0);
}

// Parse analysis JSON for each call
const calls = logs.map((row) => {
  let a = {};
  try { a = typeof row.analysis === "string" ? JSON.parse(row.analysis) : row.analysis; } catch {}
  return {
    callId: row.call_id,
    score: row.score ?? 0,
    pass: a?.pass === true,
    rubric: a?.rubric || {},
    oracle: a?.oracle || null,
    issues: Array.isArray(a?.issues) ? a.issues : [],
    summary: a?.summary || "",
    scenario: a?.scenario || a?.oracle?.scenario || "?",
  };
});

function pct(n, d) {
  if (d === 0) return "0%";
  return `${((n / d) * 100).toFixed(0)}%`;
}

// Overall
const total = calls.length;
const passed = calls.filter((c) => c.pass).length;
const avgScore = (calls.reduce((s, c) => s + c.score, 0) / total).toFixed(2);
console.log(`\n=== TEST RUN SUMMARY (${total} calls) ===`);
console.log(`Overall pass: ${passed}/${total}  (${pct(passed, total)})`);
console.log(`Avg score:    ${avgScore}/10`);

// Score distribution
const bands = { "9-10": 0, "7-8": 0, "5-6": 0, "3-4": 0, "0-2": 0 };
for (const c of calls) {
  if (c.score >= 9) bands["9-10"]++;
  else if (c.score >= 7) bands["7-8"]++;
  else if (c.score >= 5) bands["5-6"]++;
  else if (c.score >= 3) bands["3-4"]++;
  else bands["0-2"]++;
}
console.log("\nScore distribution:");
for (const [band, n] of Object.entries(bands)) {
  console.log(`  ${band}: ${"█".repeat(n).padEnd(30)} ${n}`);
}

// Regression slot
const regressions = calls.filter((c) => c.oracle?.is_regression === true);
if (regressions.length > 0) {
  const regPass = regressions.filter((c) => c.pass).length;
  const dateOk = regressions.filter(
    (c) => c.rubric?.date_accuracy?.pass === true,
  ).length;
  console.log(`\n=== CAROLINE ANDREW REGRESSION (${regressions.length} runs) ===`);
  console.log(`Pass:          ${regPass}/${regressions.length}  (${pct(regPass, regressions.length)})`);
  console.log(`Date accuracy: ${dateOk}/${regressions.length}  (${pct(dateOk, regressions.length)})`);
  if (regPass < regressions.length) {
    console.log("\nFailed regression runs:");
    for (const c of regressions.filter((c) => !c.pass)) {
      console.log(`  call ${c.callId.slice(-8)}  score=${c.score}  ${c.issues[0] || c.summary.slice(0, 100)}`);
    }
  }
} else {
  console.log("\n=== CAROLINE ANDREW REGRESSION ===  (no regression runs in this batch)");
}

// Date pattern breakdown
const byPattern = new Map();
for (const c of calls) {
  const p = c.oracle?.date_pattern || "none";
  if (!byPattern.has(p)) byPattern.set(p, { total: 0, pass: 0, dateOk: 0, disamb: 0, posture: 0 });
  const b = byPattern.get(p);
  b.total++;
  if (c.pass) b.pass++;
  if (c.rubric?.date_accuracy?.pass === true) b.dateOk++;
  if (c.rubric?.disambiguation_when_needed?.pass === true) b.disamb++;
  if (c.rubric?.care_coordinator_posture?.pass === true) b.posture++;
}
console.log("\n=== BY DATE PATTERN ===");
console.log("                              total  pass     date    disamb  posture");
for (const [pattern, b] of byPattern) {
  console.log(
    `  ${pattern.padEnd(28)} ${String(b.total).padStart(3)}    ${pct(b.pass, b.total).padStart(4)}    ${pct(b.dateOk, b.total).padStart(4)}    ${pct(b.disamb, b.total).padStart(4)}    ${pct(b.posture, b.total).padStart(4)}`,
  );
}

// New rubric category aggregates
const dateOkTotal = calls.filter((c) => c.rubric?.date_accuracy?.pass === true).length;
const dateGraded = calls.filter((c) => c.rubric?.date_accuracy !== undefined).length;
const disambGraded = calls.filter((c) => c.rubric?.disambiguation_when_needed !== undefined).length;
const disambOk = calls.filter((c) => c.rubric?.disambiguation_when_needed?.pass === true).length;
const postureGraded = calls.filter((c) => c.rubric?.care_coordinator_posture !== undefined).length;
const postureOk = calls.filter((c) => c.rubric?.care_coordinator_posture?.pass === true).length;
console.log("\n=== NEW RUBRIC LINES ===");
console.log(`date_accuracy:               ${dateOkTotal}/${dateGraded}  (${pct(dateOkTotal, dateGraded)})`);
console.log(`disambiguation_when_needed:  ${disambOk}/${disambGraded}  (${pct(disambOk, disambGraded)})`);
console.log(`care_coordinator_posture:    ${postureOk}/${postureGraded}  (${pct(postureOk, postureGraded)})`);

// Worst calls
const worst = [...calls].sort((a, b) => a.score - b.score).slice(0, 6);
console.log("\n=== LOWEST-SCORED CALLS ===");
for (const c of worst) {
  const issue = c.issues[0] || c.summary.slice(0, 110);
  console.log(`  ${c.callId.slice(-8)}  score=${c.score}  ${c.scenario.slice(0, 50)}`);
  console.log(`    ${issue}`);
}

console.log("");
