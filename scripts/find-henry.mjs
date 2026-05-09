import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: authUsers } = await sb.auth.admin.listUsers({ perPage: 200 });
const matches = (authUsers?.users || []).filter((u) =>
  (u.email || "").toLowerCase().includes("henry@getquarterback")
);

if (matches.length === 0) {
  console.log("No henry@getquarterback auth users found");
  process.exit(0);
}

for (const auth of matches) {
  console.log(`\nauth.users id: ${auth.id}`);
  console.log(`email: ${auth.email}`);
  console.log(`created: ${auth.created_at}`);

  const { data: appUser } = await sb
    .from("app_users")
    .select("id, created_at")
    .eq("auth_user_id", auth.id)
    .maybeSingle();

  if (!appUser) {
    console.log("  no app_users row");
    continue;
  }

  console.log(`app_users id: ${appUser.id}  created: ${appUser.created_at}`);

  const counts = {};
  for (const t of [
    "providers",
    "plaid_items",
    "plaid_transactions",
    "provider_visits",
    "schedule_attempts",
    "audit_log",
    "integrations",
    "appointments",
    "appointment_caregivers",
    "caregiver_contacts",
    "insurance_claims",
    "user_documents",
    "user_recordings",
    "notifications",
  ]) {
    const { count, error } = await sb
      .from(t)
      .select("id", { count: "exact", head: true })
      .eq("app_user_id", appUser.id);
    if (error && error.code !== "42P01") {
      counts[t] = `err: ${error.message}`;
    } else {
      counts[t] = count ?? 0;
    }
  }
  console.log("  row counts:", counts);
}
