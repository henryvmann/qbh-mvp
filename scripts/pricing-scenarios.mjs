#!/usr/bin/env node
// QBH Pricing Scenarios: MRR, margin, and total GP projections across
// price points, tier mix, user counts, and payment rails (web vs iOS vs Android).
//
// Inputs are MODELED (assumptions at top). Voice cost comes from measured data.
// Edit the ASSUMPTIONS block to pressure-test your own scenarios.
//
// Usage: node scripts/pricing-scenarios.mjs

// ========= ASSUMPTIONS =========

// --- Measured voice cost (from unit-economics.mjs run on 43 test calls) ---
const VAPI_COST_PER_CONNECTED_CALL = 0.1629;

// --- OpenAI pricing ---
const PRICE_4O     = { in: 2.50 / 1e6, out: 10.00 / 1e6 };
const PRICE_4OMINI = { in: 0.15 / 1e6, out:  0.60 / 1e6 };

const openAiCost = (model, calls, tokIn, tokOut) => {
  const p = model === "4o" ? PRICE_4O : PRICE_4OMINI;
  return calls * (tokIn * p.in + tokOut * p.out);
};

// --- Per-tier usage + COGS model ---
// Free: discovery + provider list + limited insights. NO voice, NO chat.
// Solo: 1 person, full Kate, typical usage.
// Solo (heavy): same but 2.4x Kate activity.
// Family: up to 5 recipients, roughly 3x voice + shared chat/insights.

const tierCOGS = {
  Free: {
    description: "Discovery, provider list, 3 insights/wk, no voice, no chat",
    voiceCalls: 0,
    openai:
      openAiCost("4omini", 12, 2500, 400) + // insights (3/wk × 4 wks, capped)
      openAiCost("4omini", 1 / 12, 5000, 2500), // amortized one-time discovery classify
    plaid: 0.60,
    places: 10 * 0.034 / 12, // 10 lookups once, amortized
    infra: 0.15,
  },
  Solo: {
    description: "Full Kate voice + chat, 1 person, typical usage",
    voiceCalls: 5,
    openai:
      openAiCost("4o",     20, 3500, 500) + // Kate chat (typical 20 msgs/mo with tool calls)
      openAiCost("4o",      2, 2500, 500) + // Kate prep
      openAiCost("4omini", 30, 3000, 500) + // Kate insights daily
      openAiCost("4omini",  1, 1500, 300) + // Goals suggest
      openAiCost("4omini",  5, 3000, 150) + // Call outcome classify (per connected call)
      openAiCost("4omini", 1 / 12, 5000, 2500), // one-time discovery
    plaid: 0.60,
    places: 10 * 0.034 / 12,
    infra: 0.15,
  },
  SoloHeavy: {
    description: "Power user: 50 chat msgs/mo, 12 voice calls/mo",
    voiceCalls: 12,
    openai:
      openAiCost("4o",     50, 3500, 500) +
      openAiCost("4o",      4, 2500, 500) +
      openAiCost("4omini", 30, 3000, 500) +
      openAiCost("4omini",  2, 1500, 300) +
      openAiCost("4omini", 12, 3000, 150) +
      openAiCost("4omini", 1 / 12, 5000, 2500),
    plaid: 0.60,
    places: 10 * 0.034 / 12,
    infra: 0.15,
  },
  Family: {
    description: "Up to 5 care recipients, ~15 voice calls/mo, shared chat",
    voiceCalls: 15,
    openai:
      openAiCost("4o",     30, 4000, 600) + // more context with 5 recipients
      openAiCost("4o",      5, 2500, 500) +
      openAiCost("4omini", 60, 4000, 600) + // insights for each recipient
      openAiCost("4omini",  5, 2000, 400) +
      openAiCost("4omini", 15, 3000, 150) +
      openAiCost("4omini", 5 / 12, 5000, 2500), // 5 recipients to classify, amortized
    plaid: 0.60, // same bank connection
    places: 50 * 0.034 / 12,
    infra: 0.30, // more data = slight infra bump
  },
};

// Compute total monthly COGS per tier
const tierTotalCOGS = Object.fromEntries(
  Object.entries(tierCOGS).map(([name, t]) => {
    const voice = t.voiceCalls * VAPI_COST_PER_CONNECTED_CALL;
    const total = voice + t.openai + t.plaid + t.places + t.infra;
    return [name, { ...t, voice, total }];
  })
);

// --- Payment processing rail assumptions ---
// Mix of users by platform (where they sign up / pay):
//   60% web (Stripe), 30% iOS (Apple IAP), 10% Android (Google Play)
// Apple Small Business Program: 15% under $1M/yr (everyone here starts qualifying)
// Google Play: 15% on first $1M/yr
const RAIL_MIX = { web: 0.60, ios: 0.30, android: 0.10 };
const RAIL_FEE = {
  web: { pct: 0.029, flat: 0.30 },
  ios: { pct: 0.15, flat: 0.00 },
  android: { pct: 0.15, flat: 0.00 },
};
function blendedFeeOnPrice(price) {
  let netPerUser = 0;
  for (const [rail, weight] of Object.entries(RAIL_MIX)) {
    const f = RAIL_FEE[rail];
    const net = price * (1 - f.pct) - f.flat;
    netPerUser += net * weight;
  }
  return price - netPerUser; // $ fee per user
}

// --- Tier mix scenarios ---
const tierMixes = {
  Conservative: { Free: 0.70, Solo: 0.23, SoloHeavy: 0.02, Family: 0.05 },
  Realistic:    { Free: 0.60, Solo: 0.27, SoloHeavy: 0.03, Family: 0.10 },
  Optimistic:   { Free: 0.50, Solo: 0.32, SoloHeavy: 0.04, Family: 0.14 },
};

// --- Price scenarios ---
const priceOptions = {
  A: { label: "A: $19 Solo / $39 Family", Solo: 19, SoloHeavy: 19, Family: 39, Free: 0 },
  B: { label: "B: $24 Solo / $49 Family", Solo: 24, SoloHeavy: 24, Family: 49, Free: 0 },
  C: { label: "C: $29 Solo / $59 Family", Solo: 29, SoloHeavy: 29, Family: 59, Free: 0 },
  D: { label: "D: $19 Solo / $49 Family", Solo: 19, SoloHeavy: 19, Family: 49, Free: 0 },
};

const userCountScenarios = [100, 1_000, 10_000, 100_000];

// ========= HELPERS =========
const fmt$ = (n, d = 2) => `$${n.toFixed(d)}`;
const fmtK = (n) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` :
  n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` :
  `$${n.toFixed(0)}`;
const fmtPct = (n) => `${(n * 100).toFixed(1)}%`;

function pad(s, n, right = false) {
  s = String(s);
  return right ? s.padStart(n) : s.padEnd(n);
}

// ========= REPORT =========

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log("║  QBH PRICING DATA REPORT                                         ║");
console.log("║  Voice cost: measured ($0.16/connected call from 43 test calls)  ║");
console.log("║  OpenAI: gpt-4o (chat, prep) + gpt-4o-mini (everything else)     ║");
console.log("╚══════════════════════════════════════════════════════════════════╝");

// ===== Section 1: Per-tier COGS =====
console.log("\n━━━━━━━━━ SECTION 1 — Per-user monthly COGS by tier ━━━━━━━━━\n");
console.log(pad("Tier", 12) + pad("Voice", 10, true) + pad("OpenAI", 10, true) + pad("Plaid", 9, true) + pad("Places", 9, true) + pad("Infra", 9, true) + pad("TOTAL", 10, true));
for (const [name, t] of Object.entries(tierTotalCOGS)) {
  console.log(
    pad(name, 12) +
    pad(fmt$(t.voice, 2), 10, true) +
    pad(fmt$(t.openai, 3), 10, true) +
    pad(fmt$(t.plaid, 2), 9, true) +
    pad(fmt$(t.places, 2), 9, true) +
    pad(fmt$(t.infra, 2), 9, true) +
    pad(fmt$(t.total, 2), 10, true)
  );
}
console.log("\n  Notes: Voice = VAPI per connected call. OpenAI includes Kate chat+prep on gpt-4o,");
console.log("  insights + classifiers on gpt-4o-mini. Plaid = transactions product tier.");
console.log("  Places = Google Maps phone lookup, amortized. Infra = Supabase+Vercel share.");

// ===== Section 2: Gross margin per tier at each price =====
console.log("\n━━━━━━━━━ SECTION 2 — Gross margin per paying tier ━━━━━━━━━");
console.log("Shows: Price → fees (blended 60% web / 30% iOS / 10% Android) → Net → COGS → GP → Margin\n");

for (const po of Object.values(priceOptions)) {
  console.log(`\n  ${po.label}`);
  console.log("  " + pad("Tier", 12) + pad("Price", 9, true) + pad("Fees", 9, true) + pad("Net", 9, true) + pad("COGS", 9, true) + pad("GP/user", 10, true) + pad("Margin", 9, true));
  for (const tierName of ["Solo", "SoloHeavy", "Family"]) {
    const price = po[tierName];
    const fees = blendedFeeOnPrice(price);
    const net = price - fees;
    const cogs = tierTotalCOGS[tierName].total;
    const gp = net - cogs;
    const margin = gp / price;
    console.log("  " +
      pad(tierName, 12) +
      pad(fmt$(price, 0), 9, true) +
      pad(fmt$(fees, 2), 9, true) +
      pad(fmt$(net, 2), 9, true) +
      pad(fmt$(cogs, 2), 9, true) +
      pad(fmt$(gp, 2), 10, true) +
      pad(fmtPct(margin), 9, true)
    );
  }
}

// ===== Section 3: MRR and GP at scale, by tier mix =====
console.log("\n\n━━━━━━━━━ SECTION 3 — MRR, COGS, Gross Profit at scale ━━━━━━━━━");
console.log("For each price option × tier mix × user count: MRR, total COGS (incl. free users), GP, GM%\n");

function computeScaleRow(userCount, mix, prices) {
  let mrr = 0;
  let cogs = 0;
  let fees = 0;
  for (const [tier, share] of Object.entries(mix)) {
    const users = userCount * share;
    const price = prices[tier] || 0;
    mrr += users * price;
    cogs += users * tierTotalCOGS[tier].total;
    fees += users * blendedFeeOnPrice(price);
  }
  const netRev = mrr - fees;
  const gp = netRev - cogs;
  const gm = mrr > 0 ? gp / mrr : 0;
  return { mrr, cogs, fees, netRev, gp, gm };
}

for (const po of Object.values(priceOptions)) {
  console.log(`\n  ─── ${po.label} ───`);
  for (const [mixName, mix] of Object.entries(tierMixes)) {
    console.log(`\n  Mix: ${mixName}  (Free ${fmtPct(mix.Free)} / Solo ${fmtPct(mix.Solo + mix.SoloHeavy)} / Family ${fmtPct(mix.Family)})`);
    console.log("    " + pad("Users", 10, true) + pad("MRR", 12, true) + pad("Fees", 12, true) + pad("COGS", 12, true) + pad("GP", 12, true) + pad("GM%", 9, true) + pad("ARPU", 9, true));
    for (const n of userCountScenarios) {
      const r = computeScaleRow(n, mix, po);
      const arpu = r.mrr / n;
      console.log("    " +
        pad(n.toLocaleString(), 10, true) +
        pad(fmtK(r.mrr), 12, true) +
        pad(fmtK(r.fees), 12, true) +
        pad(fmtK(r.cogs), 12, true) +
        pad(fmtK(r.gp), 12, true) +
        pad(fmtPct(r.gm), 9, true) +
        pad(fmt$(arpu, 2), 9, true)
      );
    }
  }
}

// ===== Section 4: Head-to-head Option A vs B vs C at Realistic mix =====
console.log("\n\n━━━━━━━━━ SECTION 4 — Price option comparison (Realistic mix) ━━━━━━━━━\n");
const realistic = tierMixes.Realistic;
console.log(pad("Users", 10, true) + pad("Metric", 10) + Object.values(priceOptions).map((p) => pad(p.label.split(":")[0], 12, true)).join(""));
for (const n of userCountScenarios) {
  for (const metric of ["MRR", "GP", "GM%"]) {
    let row = pad(n.toLocaleString(), 10, true) + pad(metric, 10);
    for (const po of Object.values(priceOptions)) {
      const r = computeScaleRow(n, realistic, po);
      if (metric === "MRR") row += pad(fmtK(r.mrr), 12, true);
      if (metric === "GP") row += pad(fmtK(r.gp), 12, true);
      if (metric === "GM%") row += pad(fmtPct(r.gm), 12, true);
    }
    console.log(row);
  }
  console.log("");
}

// ===== Section 5: Annual plan equivalents =====
console.log("━━━━━━━━━ SECTION 5 — Annual plan equivalents (20% discount) ━━━━━━━━━\n");
console.log("Monthly price shown with annual-equivalent monthly after 20% discount.");
console.log("Annual plans improve LTV/CAC, smooth churn, lock in users.\n");
console.log(pad("Tier", 12) + pad("Monthly", 10, true) + pad("Annual", 10, true) + pad("Ann/mo", 10, true) + pad("Savings", 10, true));
for (const po of Object.values(priceOptions)) {
  console.log(`\n  ${po.label}`);
  for (const tier of ["Solo", "Family"]) {
    const monthly = po[tier];
    const annual = Math.round(monthly * 12 * 0.80);
    const annPerMo = annual / 12;
    const savings = (monthly * 12) - annual;
    console.log("  " +
      pad(tier, 12) +
      pad(fmt$(monthly, 0) + "/mo", 10, true) +
      pad(fmt$(annual, 0) + "/yr", 10, true) +
      pad(fmt$(annPerMo, 2), 10, true) +
      pad(fmt$(savings, 0), 10, true)
    );
  }
}

// ===== Section 6: Break-even analysis =====
console.log("\n\n━━━━━━━━━ SECTION 6 — Break-even vs fixed team cost ━━━━━━━━━\n");
const fixedTeamMonthly = [20_000, 50_000, 100_000, 200_000];
console.log("Paying users needed to cover team burn at each GP/user level (Realistic mix, various prices)\n");
console.log(pad("Team Burn", 12, true) + Object.values(priceOptions).map((p) => pad(p.label.split(":")[0] + " users", 15, true)).join(""));
for (const burn of fixedTeamMonthly) {
  let row = pad(fmtK(burn) + "/mo", 12, true);
  for (const po of Object.values(priceOptions)) {
    // GP per paying user (weighted avg of Solo + SoloHeavy + Family)
    const paidShare = realistic.Solo + realistic.SoloHeavy + realistic.Family;
    const gpPerPaidUser =
      (realistic.Solo * ((po.Solo - blendedFeeOnPrice(po.Solo)) - tierTotalCOGS.Solo.total) +
       realistic.SoloHeavy * ((po.SoloHeavy - blendedFeeOnPrice(po.SoloHeavy)) - tierTotalCOGS.SoloHeavy.total) +
       realistic.Family * ((po.Family - blendedFeeOnPrice(po.Family)) - tierTotalCOGS.Family.total)
      ) / paidShare;
    const paidUsersNeeded = burn / gpPerPaidUser;
    // Total users including free = paidUsersNeeded / paidShare
    const totalUsers = paidUsersNeeded / paidShare;
    row += pad(Math.round(totalUsers).toLocaleString(), 15, true);
  }
  console.log(row);
}
console.log("\n  (Total users = paying + free. Paying share at Realistic mix = " + fmtPct(realistic.Solo + realistic.SoloHeavy + realistic.Family) + ")");

// ===== Section 7: Key levers summary =====
console.log("\n\n━━━━━━━━━ SECTION 7 — Sensitivity: which lever moves the needle ━━━━━━━━━\n");
const baseRealistic = computeScaleRow(10_000, tierMixes.Realistic, priceOptions.A);
console.log(`Base case: 10k users, $19/$39, Realistic mix. MRR = ${fmtK(baseRealistic.mrr)}, GP = ${fmtK(baseRealistic.gp)}\n`);

const scenarios = [
  { label: "Raise Solo $19 → $24 (+26%)",       delta: () => computeScaleRow(10_000, tierMixes.Realistic, priceOptions.B) },
  { label: "Raise Solo $19 → $29 (+53%)",       delta: () => computeScaleRow(10_000, tierMixes.Realistic, priceOptions.C) },
  { label: "Shift Conservative → Optimistic",   delta: () => computeScaleRow(10_000, tierMixes.Optimistic, priceOptions.A) },
  { label: "Shift Optimistic → Conservative",   delta: () => computeScaleRow(10_000, tierMixes.Conservative, priceOptions.A) },
  { label: "Kate chat 20 → 40 msgs (COGS +)",   delta: null }, // informational
];
console.log(pad("Lever", 40) + pad("MRR", 10, true) + pad("Δ MRR", 10, true) + pad("GP", 10, true) + pad("Δ GP", 10, true));
for (const s of scenarios) {
  if (!s.delta) {
    console.log(pad(s.label, 40) + "  (would add ~$0.28/user/mo COGS, -$28k GP at 10k users)");
    continue;
  }
  const r = s.delta();
  console.log(
    pad(s.label, 40) +
    pad(fmtK(r.mrr), 10, true) +
    pad(fmtK(r.mrr - baseRealistic.mrr), 10, true) +
    pad(fmtK(r.gp), 10, true) +
    pad(fmtK(r.gp - baseRealistic.gp), 10, true)
  );
}

console.log("\n\n━━━━━━━━━ READING GUIDE ━━━━━━━━━\n");
console.log("• Section 1: where your money goes per user per tier");
console.log("• Section 2: gross margin on each tier at each price (single-user economics)");
console.log("• Section 3: scaled MRR and GP across user counts and tier mixes");
console.log("• Section 4: head-to-head price option comparison at the Realistic mix");
console.log("• Section 5: annual plan price structure");
console.log("• Section 6: how many users you need to cover team burn");
console.log("• Section 7: sensitivity — which lever actually moves GP");
console.log("\nAll numbers are models. Voice is measured; everything else is assumption-driven.");
console.log("Tune the ASSUMPTIONS block at the top of this script to test your own scenarios.\n");
