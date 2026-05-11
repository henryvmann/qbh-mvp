// Look up Rick's Modern Dermatology visit history to confirm what
// "10 days ago" was derived from on the dashboard.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const EMAIL = "rick@getquarterback.com";

const { data: authUsers } = await sb.auth.admin.listUsers({ perPage: 200 });
const auth = (authUsers?.users || []).find((u) => (u.email || "").toLowerCase() === EMAIL.toLowerCase());
if (!auth) { console.error("no auth user for", EMAIL); process.exit(1); }

const { data: userRow, error: userErr } = await sb
  .from("app_users")
  .select("id, auth_user_id")
  .eq("auth_user_id", auth.id)
  .maybeSingle();

if (userErr) { console.error("user lookup:", userErr.message); process.exit(1); }
if (!userRow) { console.error("no app_users row for", EMAIL); process.exit(1); }
console.log("user:", userRow.id, "auth:", userRow.auth_user_id, "email:", auth.email);

const { data: providers } = await sb
  .from("providers")
  .select("id, name, specialty, provider_type, status, created_at")
  .eq("app_user_id", userRow.id)
  .ilike("name", "%modern%derm%");

console.log("\nprovider matches:");
for (const p of providers || []) {
  console.log(`  ${p.id}  ${p.name}  type=${p.provider_type}  status=${p.status}  created=${p.created_at}`);
}

const providerIds = (providers || []).map((p) => p.id);
if (providerIds.length === 0) { console.log("no matching providers"); process.exit(0); }

const { data: visits } = await sb
  .from("provider_visits")
  .select("id, provider_id, source, source_transaction_id, visit_date, amount_cents, created_at")
  .eq("app_user_id", userRow.id)
  .in("provider_id", providerIds)
  .order("visit_date", { ascending: false });

console.log("\nvisits:");
for (const v of visits || []) {
  console.log(`  ${v.visit_date}  $${(v.amount_cents/100).toFixed(2)}  source=${v.source}  src_txn=${v.source_transaction_id}  created=${v.created_at}`);
}

// Pull the source transactions referenced in provider_visits by their
// plaid transaction_id so we can see the merchant string Plaid sent.
const txnIds = (visits || []).map((v) => v.source_transaction_id).filter(Boolean);
if (txnIds.length > 0) {
  for (const tableName of ["transactions", "plaid_transactions", "discovery_transactions"]) {
    const { data: txns, error } = await sb
      .from(tableName)
      .select("*")
      .in("transaction_id", txnIds);
    if (error) { console.log(`\n${tableName}: ERROR ${error.message}`); continue; }
    console.log(`\n${tableName}: ${txns?.length ?? 0} rows`);
    for (const t of txns || []) {
      console.log("  ", JSON.stringify(t, null, 2).slice(0, 800));
    }
  }
}

// Also show the provider row in full — sometimes the raw merchant string
// is stored on the provider row itself (discovered_merchant, etc.).
const { data: providerFull } = await sb
  .from("providers")
  .select("*")
  .in("id", providerIds)
  .maybeSingle();
if (providerFull) {
  console.log("\nfull provider row keys:", Object.keys(providerFull));
  console.log(JSON.stringify(providerFull, null, 2));
}
