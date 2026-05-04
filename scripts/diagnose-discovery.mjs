// Usage:
//   source ~/.nvm/nvm.sh && node scripts/diagnose-discovery.mjs <app_user_id>
//
// Looks up the user's most recent Plaid item + transactions + the
// providers the classifier produced. Answers: did Plaid return data,
// and did the classifier discard everything?

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

const appUserId = process.argv[2];
if (!appUserId) {
  console.error("usage: node scripts/diagnose-discovery.mjs <app_user_id>");
  process.exit(1);
}

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: appUser, error: appErr } = await supa
  .from("app_users")
  .select("id, created_at, auth_user_id")
  .eq("id", appUserId)
  .maybeSingle();

if (appErr || !appUser) {
  console.error("app_user not found:", appErr ?? "(no row)");
  process.exit(1);
}

const { data: authResp } = await supa.auth.admin.getUserById(appUser.auth_user_id);
console.log(`\napp_user: ${appUser.id}`);
console.log(`email:    ${authResp?.user?.email ?? "(unknown)"}\n`);

const { data: items } = await supa
  .from("plaid_items")
  .select("*")
  .eq("app_user_id", appUserId)
  .order("created_at", { ascending: false });
console.log(`plaid_items: ${items?.length ?? 0}`);
for (const it of items ?? []) {
  console.log(`  - institution=${it.institution_name ?? "?"}  item_id=${it.item_id}  created=${it.created_at}`);
  if (it.access_token) console.log(`    access_token present: yes (len=${it.access_token.length})`);
}

const { count: txCount, error: txCountErr } = await supa
  .from("plaid_transactions")
  .select("*", { count: "exact", head: true })
  .eq("app_user_id", appUserId);
console.log(`\nplaid_transactions: ${txCount ?? 0}`, txCountErr ? `(error: ${txCountErr.message})` : "");

const { data: txSample } = await supa
  .from("plaid_transactions")
  .select("name, merchant_name, amount, date, category")
  .eq("app_user_id", appUserId)
  .order("date", { ascending: false })
  .limit(40);
if (txSample?.length) {
  console.log(`\nrecent transactions (latest 40):`);
  for (const tx of txSample) {
    const cats = Array.isArray(tx.category) ? tx.category.join("/") : "";
    const amount = tx.amount != null ? `$${String(tx.amount).padStart(8)}` : "        -";
    const merchant = (tx.merchant_name ?? tx.name ?? "").slice(0, 50);
    console.log(`  ${tx.date}  ${amount}  ${merchant.padEnd(50)} ${cats}`);
  }
}

const { count: provCount } = await supa
  .from("providers")
  .select("*", { count: "exact", head: true })
  .eq("app_user_id", appUserId);
const { count: activeCount } = await supa
  .from("providers")
  .select("*", { count: "exact", head: true })
  .eq("app_user_id", appUserId)
  .eq("status", "active");
console.log(`\nproviders: ${provCount ?? 0}  (active: ${activeCount ?? 0})`);

const { data: provSample } = await supa
  .from("providers")
  .select("name, provider_type, status, source")
  .eq("app_user_id", appUserId)
  .order("created_at", { ascending: false })
  .limit(20);
for (const p of provSample ?? []) {
  console.log(`  - ${(p.name ?? "").padEnd(40)} type=${p.provider_type ?? "-"}  status=${p.status}  src=${p.source ?? "-"}`);
}

console.log("");
process.exit(0);
