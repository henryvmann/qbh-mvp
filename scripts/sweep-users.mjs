// One-off admin sweep — deletes a list of auth users and all their owned
// rows in correct FK order. Mirrors src/app/api/account/delete logic
// plus the newer kate_* and health_score_snapshots tables.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const KEEP = new Set([
  "alli.echelman@gmail.com",
  "jenniferleighmann@gmail.com",
  "jennifer@jennifermanntherapy.com",
  "jennifer@getquarterback.com",
  "jennyechelman@gmail.com",
]);

async function deleteUserCascade(authUserId, email) {
  // Find app_user(s) for this auth user
  const { data: appUsers } = await supa
    .from("app_users")
    .select("id")
    .eq("auth_user_id", authUserId);

  for (const row of appUsers || []) {
    const appUserId = row.id;

    // 1. patient_notes
    await supa.from("patient_notes").delete().eq("app_user_id", appUserId);

    // 2. kate_insights
    await supa.from("kate_insights").delete().eq("app_user_id", appUserId);

    // 3. kate_messages + kate_conversations (newer tables not in /api/account/delete yet)
    await supa.from("kate_messages").delete().eq("app_user_id", appUserId);
    await supa.from("kate_conversations").delete().eq("app_user_id", appUserId);

    // 4. health_score_snapshots
    await supa.from("health_score_snapshots").delete().eq("app_user_id", appUserId);

    // 5. attempt-id-keyed tables (call_notes, call_scorecards, proposals)
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

    // 6. schedule_attempts, calendar_events, call_events
    await supa.from("schedule_attempts").delete().eq("app_user_id", appUserId);
    await supa.from("calendar_events").delete().eq("app_user_id", appUserId);
    await supa.from("call_events").delete().eq("app_user_id", appUserId);

    // 7. calendar_connections via integration_id
    const { data: integrations } = await supa
      .from("integrations")
      .select("id")
      .eq("app_user_id", appUserId);
    const integrationIds = (integrations || []).map((i) => i.id);
    if (integrationIds.length > 0) {
      await supa.from("calendar_connections").delete().in("integration_id", integrationIds);
    }

    // 8. portal_*, integrations
    await supa.from("portal_connections").delete().eq("app_user_id", appUserId);
    await supa.from("portal_facts").delete().eq("app_user_id", appUserId);
    await supa.from("integrations").delete().eq("app_user_id", appUserId);

    // 9. provider_visits, providers
    await supa.from("provider_visits").delete().eq("app_user_id", appUserId);
    await supa.from("providers").delete().eq("app_user_id", appUserId);

    // 10. plaid_transactions via plaid_items.id
    const { data: plaidItems } = await supa
      .from("plaid_items")
      .select("id")
      .eq("app_user_id", appUserId);
    const plaidItemIds = (plaidItems || []).map((i) => i.id);
    if (plaidItemIds.length > 0) {
      await supa.from("plaid_transactions").delete().in("plaid_item_id", plaidItemIds);
    }
    // and any plaid_transactions keyed directly by app_user_id (older rows)
    await supa.from("plaid_transactions").delete().eq("app_user_id", appUserId);

    // 11. plaid_items
    await supa.from("plaid_items").delete().eq("app_user_id", appUserId);

    // 12. app_users
    await supa.from("app_users").delete().eq("id", appUserId);
  }

  // 13. Auth user
  const { error } = await supa.auth.admin.deleteUser(authUserId);
  if (error) {
    console.error(`  ❌ ${email}: ${error.message}`);
    return false;
  }
  return true;
}

async function main() {
  const { data: list } = await supa.auth.admin.listUsers({ perPage: 500 });
  const drop = list.users.filter((u) => !KEEP.has((u.email || "").toLowerCase()));
  console.log(`Sweeping ${drop.length} auth users...`);

  let ok = 0;
  let fail = 0;
  for (const u of drop) {
    process.stdout.write(`  ${u.email.padEnd(45)} ... `);
    const success = await deleteUserCascade(u.id, u.email);
    if (success) {
      console.log("✓");
      ok++;
    } else {
      fail++;
    }
  }

  const { data: list2 } = await supa.auth.admin.listUsers({ perPage: 500 });
  const { count: appCount } = await supa
    .from("app_users")
    .select("*", { count: "exact", head: true });
  console.log(`\nFINAL — auth users: ${list2.users.length} | app_users rows: ${appCount}`);
  console.log(`Deleted ${ok} successfully, ${fail} failed.`);
  list2.users.forEach((u) => console.log("  ", u.email));
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
