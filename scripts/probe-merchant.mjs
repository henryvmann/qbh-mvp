// Usage: node scripts/probe-merchant.mjs <app_user_id> <merchant_substring>

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

const [, , appUserId, q] = process.argv;
if (!appUserId || !q) {
  console.error("usage: node scripts/probe-merchant.mjs <app_user_id> <merchant_substring>");
  process.exit(1);
}

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data } = await supa
  .from("plaid_transactions")
  .select("name, merchant_name, amount, date, category")
  .eq("app_user_id", appUserId);

const matches = (data || []).filter((t) => {
  const m = ((t.merchant_name || "") + " " + (t.name || "")).toLowerCase();
  return m.includes(q.toLowerCase());
});

console.log(`\n${matches.length} transactions matching "${q}":\n`);
let sum = 0;
for (const t of matches) {
  sum += Number(t.amount) || 0;
  const cats = Array.isArray(t.category) ? t.category.join("/") : "";
  console.log(`  ${t.date}  $${String(t.amount).padStart(8)}  ${(t.merchant_name ?? t.name ?? "").slice(0, 50).padEnd(50)} [${cats}]`);
}
if (matches.length) {
  console.log(`\n  avg: $${(sum / matches.length).toFixed(2)}  count: ${matches.length}\n`);
}
process.exit(0);
