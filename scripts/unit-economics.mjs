#!/usr/bin/env node
// Unit economics report for QBH Kate voice calls.
// Pulls VAPI call logs (authoritative cost), joins against Supabase schedule_attempts
// for outcomes, and prints per-call + per-booking economics.
//
// Usage: node scripts/unit-economics.mjs
// Env: VAPI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- load .env.local (simple parser, no dep) ---
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, k, vRaw] = m;
      if (process.env[k]) continue;
      let v = vRaw;
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  } catch {}
}
loadEnvLocal();

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!VAPI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    `Missing env. Need VAPI_API_KEY, SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.\n` +
      `Got: VAPI_API_KEY=${!!VAPI_API_KEY}, SUPABASE_URL=${!!SUPABASE_URL}, SUPABASE_SERVICE_ROLE_KEY=${!!SUPABASE_SERVICE_KEY}`
  );
  process.exit(1);
}

// --- fetch all VAPI calls (paginate) ---
async function fetchAllVapiCalls() {
  const calls = [];
  let createdAtLt = undefined;
  // VAPI /call supports limit (max 100) and createdAtLt for cursoring
  for (let page = 0; page < 50; page++) {
    const url = new URL("https://api.vapi.ai/call");
    url.searchParams.set("limit", "100");
    if (createdAtLt) url.searchParams.set("createdAtLt", createdAtLt);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
    });
    if (!res.ok) {
      console.error(`VAPI fetch failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    calls.push(...batch);
    if (batch.length < 100) break;
    createdAtLt = batch[batch.length - 1].createdAt;
  }
  return calls;
}

// --- fetch schedule_attempts ---
async function fetchScheduleAttempts() {
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supa
    .from("schedule_attempts")
    .select("id, created_at, status, vapi_call_id, provider_id, metadata")
    .not("vapi_call_id", "is", null);
  if (error) {
    console.error("Supabase error:", error);
    process.exit(1);
  }
  return data || [];
}

// --- stats helpers ---
function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}
function fmtMoney(n) {
  return `$${n.toFixed(4)}`;
}
function fmtMoneyCoarse(n) {
  return `$${n.toFixed(2)}`;
}
function fmtPct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

// --- main ---
(async () => {
  console.log("Fetching VAPI calls…");
  const calls = await fetchAllVapiCalls();
  console.log(`  → ${calls.length} VAPI calls`);

  console.log("Fetching schedule_attempts…");
  const attempts = await fetchScheduleAttempts();
  console.log(`  → ${attempts.length} attempts with vapi_call_id`);

  const attemptByCallId = new Map();
  for (const a of attempts) attemptByCallId.set(a.vapi_call_id, a);

  // Enrich calls with attempt outcome
  const enriched = calls.map((c) => {
    const attempt = attemptByCallId.get(c.id);
    const start = c.startedAt ? new Date(c.startedAt) : null;
    const end = c.endedAt ? new Date(c.endedAt) : null;
    const durationSec = start && end ? (end - start) / 1000 : 0;
    return {
      id: c.id,
      createdAt: c.createdAt,
      status: c.status,
      endedReason: c.endedReason,
      cost: typeof c.cost === "number" ? c.cost : 0,
      costBreakdown: c.costBreakdown || {},
      durationSec,
      attemptStatus: attempt?.status ?? null,
      attemptId: attempt?.id ?? null,
    };
  });

  // Connected = call actually reached a human (has duration > 5s and not ended by customer-did-not-answer etc.)
  const connected = enriched.filter((c) => c.durationSec > 5 && c.cost > 0);
  const unconnected = enriched.filter((c) => !(c.durationSec > 5 && c.cost > 0));

  // Booked = attempt status indicates a successful booking
  const BOOKED_STATUSES = new Set([
    "BOOKED_CONFIRMED",
    "BOOKED",
    "CONFIRMED",
    "COMPLETED",
  ]);
  const booked = enriched.filter((c) =>
    c.attemptStatus && BOOKED_STATUSES.has(c.attemptStatus)
  );

  // Distributions
  const connectedCosts = connected.map((c) => c.cost).sort((a, b) => a - b);
  const connectedDurations = connected.map((c) => c.durationSec).sort((a, b) => a - b);
  const allCosts = enriched.map((c) => c.cost).sort((a, b) => a - b);

  const totalCost = enriched.reduce((s, c) => s + c.cost, 0);
  const connectedTotalCost = connected.reduce((s, c) => s + c.cost, 0);

  // Cost breakdown categories (llm, stt, tts, transport, etc.)
  // VAPI's costBreakdown mixes dollar fields with raw token/char counts — filter those out.
  const NON_DOLLAR_KEYS = new Set([
    "llmPromptTokens",
    "llmCachedPromptTokens",
    "llmCompletionTokens",
    "ttsCharacters",
    "total",
    "analysisCostBreakdown",
  ]);
  const breakdownTotals = {};
  for (const c of enriched) {
    for (const [k, v] of Object.entries(c.costBreakdown || {})) {
      if (NON_DOLLAR_KEYS.has(k)) continue;
      if (typeof v === "number") breakdownTotals[k] = (breakdownTotals[k] || 0) + v;
    }
  }

  // Ended reason breakdown
  const endedReasonCounts = {};
  for (const c of enriched) {
    const r = c.endedReason || "unknown";
    endedReasonCounts[r] = (endedReasonCounts[r] || 0) + 1;
  }

  // Attempt status breakdown (among calls that are linked to an attempt)
  const attemptStatusCounts = {};
  for (const c of enriched) {
    const s = c.attemptStatus || "UNLINKED";
    attemptStatusCounts[s] = (attemptStatusCounts[s] || 0) + 1;
  }

  // --- report ---
  console.log("\n=====================================================");
  console.log(" QBH Kate Voice Calls — Unit Economics Report");
  console.log("=====================================================\n");

  console.log("VOLUME");
  console.log(`  Total VAPI calls:         ${enriched.length}`);
  console.log(`  Connected (>5s, cost>0):  ${connected.length}  (${fmtPct(connected.length / Math.max(1, enriched.length))})`);
  console.log(`  Unconnected:              ${unconnected.length}`);
  console.log(`  Linked to attempt:        ${enriched.filter((c) => c.attemptId).length}`);
  console.log(`  Successful bookings:      ${booked.length}`);

  console.log("\nCOST (all calls)");
  console.log(`  Total spend:              ${fmtMoneyCoarse(totalCost)}`);
  console.log(`  Avg cost / call:          ${fmtMoney(mean(enriched.map((c) => c.cost)))}`);
  console.log(`  p50 cost / call:          ${fmtMoney(quantile(allCosts, 0.5))}`);
  console.log(`  p90 cost / call:          ${fmtMoney(quantile(allCosts, 0.9))}`);
  console.log(`  Max cost / call:          ${fmtMoney(allCosts[allCosts.length - 1] || 0)}`);

  console.log("\nCOST (connected calls only — real unit cost)");
  console.log(`  Avg cost / connected:     ${fmtMoney(mean(connected.map((c) => c.cost)))}`);
  console.log(`  p50 cost / connected:     ${fmtMoney(quantile(connectedCosts, 0.5))}`);
  console.log(`  p90 cost / connected:     ${fmtMoney(quantile(connectedCosts, 0.9))}`);
  console.log(`  Avg duration / connected: ${mean(connected.map((c) => c.durationSec)).toFixed(1)}s`);
  console.log(`  p50 duration:             ${quantile(connectedDurations, 0.5).toFixed(1)}s`);
  console.log(`  p90 duration:             ${quantile(connectedDurations, 0.9).toFixed(1)}s`);

  console.log("\nCOST BREAKDOWN (VAPI categories, total $)");
  const sortedBreakdown = Object.entries(breakdownTotals).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sortedBreakdown) {
    const pct = totalCost > 0 ? v / totalCost : 0;
    console.log(`  ${k.padEnd(20)} ${fmtMoneyCoarse(v).padStart(10)}  (${fmtPct(pct)})`);
  }

  console.log("\nOUTCOME: VAPI endedReason");
  for (const [k, v] of Object.entries(endedReasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(35)} ${String(v).padStart(4)}`);
  }

  console.log("\nOUTCOME: schedule_attempts.status");
  for (const [k, v] of Object.entries(attemptStatusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(35)} ${String(v).padStart(4)}`);
  }

  console.log("\nUNIT ECONOMICS");
  const costPerConnected = connected.length ? connectedTotalCost / connected.length : 0;
  const costPerBooking = booked.length ? totalCost / booked.length : null;
  const bookingRate = connected.length ? booked.length / connected.length : 0;
  console.log(`  Cost per connected call:  ${fmtMoney(costPerConnected)}`);
  console.log(`  Booking rate (of connected): ${fmtPct(bookingRate)}`);
  if (costPerBooking !== null) {
    console.log(`  Cost per successful booking (amortizing failed attempts): ${fmtMoneyCoarse(costPerBooking)}`);
  } else {
    console.log(`  Cost per successful booking: N/A (no bookings detected — check BOOKED_STATUSES)`);
  }

  // =====================================================
  // MODELED NON-VOICE COSTS (per user per month)
  // Assumptions are configurable — tune for your actual usage.
  // =====================================================

  // OpenAI pricing (2025):
  //   gpt-4o:      $2.50/1M input, $10.00/1M output
  //   gpt-4o-mini: $0.15/1M input,  $0.60/1M output
  const MODEL_PRICE = {
    "gpt-4o":      { in: 2.50 / 1_000_000, out: 10.00 / 1_000_000 },
    "gpt-4o-mini": { in: 0.15 / 1_000_000, out:  0.60 / 1_000_000 },
  };

  // Kate chat uses gpt-4o with tool calls (search_providers) → 1–2 round trips.
  // Estimate: ~60% of messages are single-pass, ~40% involve tool + second pass.
  // Per message avg: 3500 in + 500 out = ~$0.01375.
  const openAiRoutes = [
    // route, model, calls/mo/user, avg_in_tokens, avg_out_tokens, once
    { route: "Kate chat (typical)",   model: "gpt-4o",      calls: 20, tokIn: 3500, tokOut: 500, once: false },
    { route: "Kate prep",             model: "gpt-4o",      calls: 2,  tokIn: 2500, tokOut: 500, once: false },
    { route: "Kate insights",         model: "gpt-4o-mini", calls: 30, tokIn: 3000, tokOut: 500, once: false },
    { route: "Goals suggest",         model: "gpt-4o-mini", calls: 1,  tokIn: 1500, tokOut: 300, once: false },
    { route: "Call outcome classify", model: "gpt-4o-mini", calls: 5,  tokIn: 3000, tokOut: 150, once: false },
    { route: "Transaction classify",  model: "gpt-4o-mini", calls: 1,  tokIn: 5000, tokOut: 2500, once: true },
  ];

  const openAiRows = openAiRoutes.map((r) => {
    const monthlyCalls = r.once ? (1 / 12) : r.calls;
    const p = MODEL_PRICE[r.model];
    const cost = monthlyCalls * (r.tokIn * p.in + r.tokOut * p.out);
    return { ...r, monthlyCalls, cost };
  });
  const openAiTotal = openAiRows.reduce((s, r) => s + r.cost, 0);

  // Plaid: ~$0.30-$1.00 per connected item per month (mid-estimate)
  const PLAID_PER_USER_MO = 0.60;

  // Google Places: $17/1000 text search + $17/1000 place details = $0.034 per provider lookup
  // Assume 10 providers looked up at onboarding, amortized over 12 months
  const PLACES_ONETIME = 10 * 0.034;
  const PLACES_PER_USER_MO = PLACES_ONETIME / 12;

  // Supabase/Vercel: platform fees. Flat ~$25/mo Supabase Pro + $20/mo Vercel Pro.
  // At 100 active users, infra is $0.45/user/mo. At 1000 users, $0.045. Use $0.15 mid.
  const INFRA_PER_USER_MO = 0.15;

  console.log("\n=====================================================");
  console.log(" FULL COGS MODEL — per active user per month");
  console.log("=====================================================");

  console.log("\nOPENAI — modeled per-user usage (mixed gpt-4o + gpt-4o-mini)");
  console.log(`  ${"Route".padEnd(25)} ${"model".padEnd(13)} ${"calls/mo".padStart(10)} ${"in tok".padStart(8)} ${"out tok".padStart(8)} ${"cost".padStart(10)}`);
  for (const r of openAiRows) {
    const callsStr = typeof r.monthlyCalls === "number" && r.monthlyCalls < 1 ? r.monthlyCalls.toFixed(3) : String(r.monthlyCalls);
    console.log(
      `  ${r.route.padEnd(25)} ${r.model.padEnd(13)} ${callsStr.padStart(10)} ${String(r.tokIn).padStart(8)} ${String(r.tokOut).padStart(8)} ${fmtMoney(r.cost).padStart(10)}`
    );
  }
  console.log(`  ${"OpenAI subtotal".padEnd(25)} ${"".padEnd(13)} ${"".padStart(10)} ${"".padStart(8)} ${"".padStart(8)} ${fmtMoney(openAiTotal).padStart(10)}`);

  console.log("\nOTHER RECURRING COSTS");
  console.log(`  Plaid (per connected user)          ${fmtMoney(PLAID_PER_USER_MO)}/mo`);
  console.log(`  Google Places (amortized onboarding)${fmtMoney(PLACES_PER_USER_MO)}/mo`);
  console.log(`  Supabase + Vercel (infra share)     ${fmtMoney(INFRA_PER_USER_MO)}/mo`);

  const fixedMonthlyCOGS = openAiTotal + PLAID_PER_USER_MO + PLACES_PER_USER_MO + INFRA_PER_USER_MO;

  console.log("\nFIXED (non-voice) COGS per user / mo:  " + fmtMoney(fixedMonthlyCOGS));

  console.log("\n=====================================================");
  console.log(" TOTAL LOADED COGS PER USER — by usage scenario");
  console.log("=====================================================");
  const scenarios = [
    { name: "Light   (2 Kate calls/mo)",           calls: 2 },
    { name: "Typical (5 Kate calls/mo)",           calls: 5 },
    { name: "Heavy   (10 Kate calls/mo)",          calls: 10 },
    { name: "Family  (20 Kate calls/mo)",          calls: 20 },
  ];
  console.log(`  ${"Scenario".padEnd(32)} ${"voice".padStart(8)} ${"fixed".padStart(8)} ${"total".padStart(8)}   margin @ $19   margin @ $29`);
  for (const s of scenarios) {
    const voice = s.calls * costPerConnected;
    const total = voice + fixedMonthlyCOGS;
    const m19 = (19 - total) / 19;
    const m29 = (29 - total) / 29;
    console.log(
      `  ${s.name.padEnd(32)} ${fmtMoneyCoarse(voice).padStart(8)} ${fmtMoneyCoarse(fixedMonthlyCOGS).padStart(8)} ${fmtMoneyCoarse(total).padStart(8)}   ${fmtPct(m19).padStart(12)}   ${fmtPct(m29).padStart(12)}`
    );
  }

  console.log("\nNOTES");
  console.log("  - Voice cost (VAPI) is MEASURED from your actual test calls.");
  console.log("  - OpenAI, Plaid, Places, Infra are MODELED with configurable assumptions");
  console.log("    at the top of this script — tune to match real usage after launch.");
  console.log("  - Assumes Plaid on the cheap tier (~$0.60/user/mo) and infra amortized across 100+ users.");
  console.log("  - Does not include: Epic/FHIR (free), NPI (free), Google Calendar (free),");
  console.log("    customer support, fraud losses, payment processing fees (Stripe ~2.9%+$0.30).");
  console.log("  - 'Connected' heuristic = duration>5s AND cost>0.");
  console.log("");
})();
