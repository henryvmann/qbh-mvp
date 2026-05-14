// Burst-mode trigger for the call-test harness. Fires N test calls
// back-to-back against prod, staggered so Sandra's prompt PATCH
// doesn't race the next call's PATCH.
//
// Usage:
//   node scripts/burst-test-calls.mjs              # 50 calls, 5s stagger
//   node scripts/burst-test-calls.mjs --count 20   # 20 calls
//   node scripts/burst-test-calls.mjs --stagger 8  # 8s between triggers
//
// Each call is INITIATED here; the actual conversation + grading happens
// asynchronously via VAPI webhooks. Watch progress at
// https://www.getquarterback.com/api/vapi/test-loop (GET returns the
// 20 most recent scored calls).

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const COUNT = parseInt(args.count || "50", 10);
// VAPI's concurrent-call limit is 10 on the subscription, and Kate↔Sandra
// calls run ~2-3 min, so the sustainable rate is ~3.3/min. 20s stagger
// stays just under the cap; bursts shorter than that hit "Over
// Concurrency Limit" 400s. Pass --stagger N to override.
const STAGGER_MS = parseInt(args.stagger || "20", 10) * 1000;
const BASE_URL = args.url || "https://www.getquarterback.com";

console.log(`Burst test: ${COUNT} calls, ${STAGGER_MS / 1000}s stagger, target ${BASE_URL}\n`);

const results = [];

for (let i = 0; i < COUNT; i++) {
  const t0 = Date.now();
  let attempt = 0;
  let data = null;
  // Retry on VAPI concurrency rejection with exponential backoff so we
  // don't burn the slot. Otherwise the call enters the matrix with no
  // vapi_call_id and we lose date_accuracy grading on it.
  while (attempt < 4) {
    try {
      const res = await fetch(`${BASE_URL}/api/vapi/test-loop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      data = await res.json();
      const concurrencyBlocked =
        data?.callResult?.data?.subscriptionLimits?.concurrencyBlocked === true ||
        (typeof data?.callResult?.data?.message === "string" &&
          data.callResult.data.message.toLowerCase().includes("concurrency"));
      if (!concurrencyBlocked) break;
      attempt++;
      const backoffSec = 15 * attempt;
      console.log(
        `${String(i + 1).padStart(2)}/${COUNT}  [concurrency limit, backing off ${backoffSec}s — retry ${attempt}/4]`,
      );
      await new Promise((r) => setTimeout(r, backoffSec * 1000));
    } catch (err) {
      console.error(`${i + 1}/${COUNT}  ERROR: ${err.message}`);
      data = { ok: false, error: String(err) };
      break;
    }
  }
  const tag = data?.isRegression
    ? "[REGRESSION]"
    : `[${data?.datePattern ?? "?"}]`;
  const persona = data?.sandraPersona ?? "?";
  const intended = data?.intendedIso?.slice(0, 16) ?? "?";
  const callId = data?.vapiCallId?.slice(-8) ?? "?";
  console.log(
    `${String(i + 1).padStart(2)}/${COUNT}  ${tag.padEnd(22)} ${persona.padEnd(45)} → ${intended}  call:${callId}`,
  );
  results.push({ ok: !!data?.ok && !!data?.vapiCallId, ...data });
  if (i < COUNT - 1) {
    const elapsed = Date.now() - t0;
    const wait = Math.max(0, STAGGER_MS - elapsed);
    if (wait) await new Promise((r) => setTimeout(r, wait));
  }
}

const ok = results.filter((r) => r.ok).length;
const fail = results.length - ok;
const regressions = results.filter((r) => r.isRegression).length;
console.log(
  `\nDone. ${ok}/${results.length} triggered (${fail} failed). ${regressions} regression slots fired.`,
);
console.log(
  `Calls run async; scores trickle in over the next ~5-15 min as webhooks fire.\nWatch: ${BASE_URL}/api/vapi/test-loop`,
);
