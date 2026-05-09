// Hard-delete a single user end-to-end. Used for clearing test accounts.
// Order matters: child rows first, then app_users, then auth.users.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const email = process.argv[2];
if (!email) {
  console.error("usage: node scripts/delete-user.mjs <email>");
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: authList } = await sb.auth.admin.listUsers({ perPage: 200 });
const authUser = (authList?.users || []).find(
  (u) => (u.email || "").toLowerCase() === email.toLowerCase()
);

if (!authUser) {
  console.log(`no auth user for ${email}`);
  process.exit(0);
}

const authId = authUser.id;

const { data: appRow } = await sb
  .from("app_users")
  .select("id")
  .eq("auth_user_id", authId)
  .maybeSingle();

const appId = appRow?.id ?? null;
console.log(`auth_user_id: ${authId}`);
console.log(`app_user_id:  ${appId ?? "(none)"}`);

if (appId) {
  // Tables with app_user_id FK — order matters when one references another
  // (e.g. provider_visits.provider_id → providers.id, so visits go first).
  const tablesInOrder = [
    "provider_visits",
    "schedule_attempts",
    "appointment_caregivers",
    "appointments",
    "plaid_transactions",
    "plaid_items",
    "integrations",
    "providers",
    "caregiver_contacts",
    "insurance_claims",
    "user_documents",
    "user_recordings",
    "notifications",
    "audit_log",
  ];

  for (const t of tablesInOrder) {
    const { error, count } = await sb
      .from(t)
      .delete({ count: "exact" })
      .eq("app_user_id", appId);
    if (error && error.code !== "42P01") {
      console.error(`  ${t}: ERROR ${error.message}`);
    } else {
      console.log(`  ${t}: deleted ${count ?? 0}`);
    }
  }

  const { error: appErr } = await sb.from("app_users").delete().eq("id", appId);
  if (appErr) console.error(`  app_users: ERROR ${appErr.message}`);
  else console.log(`  app_users: deleted`);
}

const { error: authErr } = await sb.auth.admin.deleteUser(authId);
if (authErr) console.error(`auth.users: ERROR ${authErr.message}`);
else console.log(`auth.users: deleted`);

console.log("done.");
