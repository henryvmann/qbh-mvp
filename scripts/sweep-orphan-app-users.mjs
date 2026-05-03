// Cascade-delete app_users rows whose auth_user_id no longer exists.
// Same FK ordering as sweep-users.mjs but operates on orphaned rows.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function deleteAppUserCascade(appUserId) {
  await supa.from("patient_notes").delete().eq("app_user_id", appUserId);
  await supa.from("kate_insights").delete().eq("app_user_id", appUserId);
  await supa.from("kate_messages").delete().eq("app_user_id", appUserId);
  await supa.from("kate_conversations").delete().eq("app_user_id", appUserId);
  await supa.from("health_score_snapshots").delete().eq("app_user_id", appUserId);

  const { data: attempts } = await supa
    .from("schedule_attempts")
    .select("id")
    .eq("app_user_id", appUserId);
  const attemptIds = (attempts || []).map((a) => a.id);
  if (attemptIds.length > 0) {
    await supa.from("call_notes").delete().in("attempt_id", attemptIds);
    await supa.from("call_scorecards").delete().in("attempt_id", attemptIds);
    await supa.from("proposals").delete().in("attempt_id", attemptIds);
  }

  await supa.from("schedule_attempts").delete().eq("app_user_id", appUserId);
  await supa.from("calendar_events").delete().eq("app_user_id", appUserId);
  await supa.from("call_events").delete().eq("app_user_id", appUserId);

  const { data: integrations } = await supa
    .from("integrations")
    .select("id")
    .eq("app_user_id", appUserId);
  const integrationIds = (integrations || []).map((i) => i.id);
  if (integrationIds.length > 0) {
    await supa.from("calendar_connections").delete().in("integration_id", integrationIds);
  }

  await supa.from("portal_connections").delete().eq("app_user_id", appUserId);
  await supa.from("portal_facts").delete().eq("app_user_id", appUserId);
  await supa.from("integrations").delete().eq("app_user_id", appUserId);
  await supa.from("provider_visits").delete().eq("app_user_id", appUserId);
  await supa.from("providers").delete().eq("app_user_id", appUserId);

  const { data: plaidItems } = await supa
    .from("plaid_items")
    .select("id")
    .eq("app_user_id", appUserId);
  const plaidItemIds = (plaidItems || []).map((i) => i.id);
  if (plaidItemIds.length > 0) {
    await supa.from("plaid_transactions").delete().in("plaid_item_id", plaidItemIds);
  }
  await supa.from("plaid_transactions").delete().eq("app_user_id", appUserId);
  await supa.from("plaid_items").delete().eq("app_user_id", appUserId);

  await supa.from("app_users").delete().eq("id", appUserId);
}

async function main() {
  // Get all current auth user IDs
  const { data: list } = await supa.auth.admin.listUsers({ perPage: 500 });
  const validAuthIds = new Set(list.users.map((u) => u.id));

  // Get all app_users rows
  const { data: rows } = await supa.from("app_users").select("id, auth_user_id, created_at");
  const orphans = (rows || []).filter(
    (r) => !r.auth_user_id || !validAuthIds.has(r.auth_user_id)
  );
  console.log(`Found ${rows?.length || 0} app_users rows; ${orphans.length} are orphaned.`);

  for (const o of orphans) {
    process.stdout.write(`  ${o.id} (auth=${o.auth_user_id || "null"}, created=${o.created_at?.slice(0,10)}) ... `);
    try {
      await deleteAppUserCascade(o.id);
      console.log("✓");
    } catch (err) {
      console.log("✗", err.message);
    }
  }

  const { count: finalCount } = await supa
    .from("app_users")
    .select("*", { count: "exact", head: true });
  console.log(`\nFINAL app_users rows: ${finalCount}`);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
