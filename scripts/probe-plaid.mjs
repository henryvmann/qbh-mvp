// Usage: node scripts/probe-plaid.mjs <app_user_id>
//
// Calls Plaid directly using the user's stored access_token to see
// exactly what transactions/accounts are available — bypasses our
// /api/discovery/run route so we can isolate whether the bug is
// Plaid-side or our-side.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

const appUserId = process.argv[2];
if (!appUserId) {
  console.error("usage: node scripts/probe-plaid.mjs <app_user_id>");
  process.exit(1);
}

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: items, error: itemsErr } = await supa
  .from("plaid_items")
  .select("*")
  .eq("app_user_id", appUserId)
  .order("created_at", { ascending: false })
  .limit(1);
console.log("items query error:", itemsErr);
console.log("items length:", items?.length);
if (items?.[0]) console.log("columns:", Object.keys(items[0]).join(", "));
const item = items?.[0];
if (!item?.access_token) {
  console.error("no access_token for that user — item:", item);
  process.exit(1);
}

const env = (process.env.PLAID_ENV || "production").trim();
const host =
  env === "sandbox"
    ? "https://sandbox.plaid.com"
    : env === "development"
    ? "https://development.plaid.com"
    : "https://production.plaid.com";

console.log(`plaid env: ${env}`);
console.log(`item: ${item.item_id}  institution=${item.institution_name ?? "?"}  linked=${item.created_at}\n`);

async function plaidPost(endpoint, body) {
  const res = await fetch(`${host}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body,
    }),
  });
  return res.json();
}

const itemInfo = await plaidPost("/item/get", { access_token: item.access_token });
console.log("item.products available:", itemInfo?.item?.available_products);
console.log("item.products billed:   ", itemInfo?.item?.billed_products);
console.log("item.error:             ", itemInfo?.item?.error);
console.log("institution_id:         ", itemInfo?.item?.institution_id);

const accts = await plaidPost("/accounts/get", { access_token: item.access_token });
console.log(`\naccounts (${accts?.accounts?.length ?? 0}):`);
for (const a of accts?.accounts ?? []) {
  console.log(`  - ${a.name}  type=${a.type}/${a.subtype}  mask=${a.mask}  balance=$${a.balances?.current ?? "?"}`);
}

const today = new Date();
const start = new Date(today);
start.setMonth(start.getMonth() - 12);
const startStr = start.toISOString().slice(0, 10);
const endStr = today.toISOString().slice(0, 10);

console.log(`\ncalling transactions/get  ${startStr} → ${endStr}`);
const tx = await plaidPost("/transactions/get", {
  access_token: item.access_token,
  start_date: startStr,
  end_date: endStr,
  options: { count: 20, offset: 0 },
});
if (tx.error_code) {
  console.log(`  ERROR ${tx.error_code}: ${tx.error_message}`);
  console.log(`  display: ${tx.display_message}`);
} else {
  console.log(`  total_transactions: ${tx.total_transactions ?? 0}`);
  console.log(`  returned (first page): ${tx.transactions?.length ?? 0}`);
  for (const t of (tx.transactions ?? []).slice(0, 10)) {
    console.log(`    ${t.date}  $${t.amount}  ${(t.merchant_name ?? t.name ?? "").slice(0, 50)}`);
  }
}

process.exit(0);
