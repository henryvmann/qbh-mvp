// Replay every plaid_transactions row in the DB through the
// classifier and dump the results. Catches real-world false positives
// our hand-curated fixtures don't cover.
//
// Usage: source ~/.nvm/nvm.sh && node scripts/classifier-eval/replay-real.mjs

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env.local") });

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// dotenv is loaded; classify-transactions reads OPENAI_API_KEY at
// module-evaluation, so import dynamically here.
const { buildProviderRegistry } = await import(
  "../../src/lib/qbh/discovery/build-provider-registry.ts"
);

const { data: users } = await supa
  .from("app_users")
  .select("id, auth_user_id");

console.log(`replaying transactions for ${users?.length ?? 0} app_users\n`);

const allViolations = [];
const allHealthcare = [];
const allReview = [];

for (const u of users ?? []) {
  const { data: txs } = await supa
    .from("plaid_transactions")
    .select("transaction_id, name, merchant_name, amount, date, category")
    .eq("app_user_id", u.id);
  if (!txs || txs.length === 0) continue;

  // Resolve email for the report header
  const { data: authResp } = await supa.auth.admin.getUserById(u.auth_user_id);
  const email = authResp?.user?.email ?? "(unknown)";

  console.log(`─ ${email} ─ ${txs.length} transactions`);
  const normalized = txs.map((tx) => ({
    transaction_id: tx.transaction_id,
    name: tx.name ?? null,
    merchant_name: tx.merchant_name ?? null,
    amount: tx.amount ?? null,
    date: tx.date,
    category: tx.category ?? null,
  }));

  let providers;
  try {
    providers = await buildProviderRegistry(normalized);
  } catch (err) {
    console.log(`  ✗ classifier threw: ${err?.message ?? err}`);
    continue;
  }

  const healthcare = providers.filter((p) => p.bucket === "HEALTHCARE");
  const review = providers.filter((p) => p.bucket === "REVIEW_NEEDED");
  console.log(`  → ${healthcare.length} healthcare, ${review.length} review-needed`);

  for (const p of healthcare) {
    allHealthcare.push({ email, ...p });
    console.log(`    [HC]   ${p.provider_name.padEnd(40)} ${p.provider_type ?? "-"}  visits=${p.visit_count}`);
  }
  for (const p of review) {
    allReview.push({ email, ...p });
    console.log(`    [REV]  ${p.provider_name.padEnd(40)} ${p.provider_type ?? "-"}  visits=${p.visit_count}`);
  }
  console.log("");
}

// Heuristic flag: anything in REVIEW_NEEDED whose name matches an
// "obviously not a clinician" pattern we should fixture
const SUSPICIOUS = [
  /TRADER/i, /WHOLE FOODS/i, /TARGET\b/i, /COSTCO/i, /WALMART/i, /PUBLIX/i,
  /GROCERY/i, /MARKET/i, /SHOP/i, /STORE/i, /CAFE/i, /COFFEE/i, /STARBUCKS/i,
  /AMAZON/i, /APPLE\b/i, /UBER/i, /LYFT/i, /NETFLIX/i, /SPOTIFY/i,
];
console.log("\n== FLAGGED FOR HUMAN REVIEW ==\n");
let suspicious = 0;
for (const p of [...allHealthcare, ...allReview]) {
  if (SUSPICIOUS.some((re) => re.test(p.provider_name))) {
    suspicious++;
    console.log(`  ${p.email}  ${p.bucket}  ${p.provider_name}  type=${p.provider_type ?? "-"}`);
  }
}
if (suspicious === 0) console.log("  none");

console.log(`\nTOTAL: ${allHealthcare.length} healthcare, ${allReview.length} review-needed across all users`);
process.exit(0);
