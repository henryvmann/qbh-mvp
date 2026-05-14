// Retroactively grade every overnight test call: pull the schedule_attempt
// for each oracle row, find the transcript in its metadata, and POST to
// test-analyze. With the new fallback in place, each grade will pick up
// the oracle by attempt_id and compute date_accuracy.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const BASE_URL = "https://www.getquarterback.com";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Pull every oracle row from the last 12 hours.
const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
const { data: oracles } = await sb
  .from("call_test_oracles")
  .select("vapi_call_id, attempt_id, scenario, date_pattern, intended_iso, is_regression, created_at")
  .gte("created_at", since)
  .order("created_at", { ascending: true });

console.log(`Regrading ${oracles?.length ?? 0} oracle rows from the last 12h...\n`);

let graded = 0, skipped = 0, errors = 0;
for (const o of oracles ?? []) {
  if (!o.attempt_id) { skipped++; continue; }

  // Transcripts live in call_notes (keyed by attempt_id), not in
  // schedule_attempts.metadata.
  const { data: note } = await sb
    .from("call_notes")
    .select("transcript")
    .eq("attempt_id", o.attempt_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const transcript = note?.transcript;
  if (!transcript || typeof transcript !== "string" || transcript.length < 50) {
    skipped++;
    process.stdout.write(`  skip ${o.attempt_id.padStart(4)}  ${o.date_pattern?.padEnd(24) ?? "?"}  no transcript\n`);
    continue;
  }

  // Wipe any prior call_test_logs entry for this attempt so the re-grade
  // doesn't dedupe-short-circuit. (test-analyze dedupes by call_id =
  // "attempt-N".)
  const callId = `attempt-${o.attempt_id}`;
  await sb.from("call_test_logs").delete().eq("call_id", callId);

  try {
    const res = await fetch(`${BASE_URL}/api/vapi/test-analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, call_id: callId }),
    });
    const j = await res.json().catch(() => ({}));
    if (j?.ok) {
      graded++;
      const dateOk = j.rubric?.date_accuracy?.pass === true ? "✓" : j.rubric?.date_accuracy === undefined ? "·" : "✗";
      console.log(`  ok   ${o.attempt_id.padStart(4)}  ${(o.date_pattern ?? "?").padEnd(24)}  score=${String(j.score ?? "?").padStart(2)}  date:${dateOk}  ${j.pass ? "PASS" : "fail"}${o.is_regression ? "  [REGRESSION]" : ""}`);
    } else {
      errors++;
      console.log(`  err  ${o.attempt_id.padStart(4)}  ${o.date_pattern?.padEnd(24) ?? "?"}  ${j?.error ?? "no body"}`);
    }
  } catch (err) {
    errors++;
    console.log(`  err  ${o.attempt_id.padStart(4)}  ${o.date_pattern?.padEnd(24) ?? "?"}  ${err.message}`);
  }
  // Light throttle so we don't slam OpenAI's rate limit.
  await new Promise((r) => setTimeout(r, 400));
}

console.log(`\nDone. ${graded} graded, ${skipped} skipped (no transcript), ${errors} errors.`);
