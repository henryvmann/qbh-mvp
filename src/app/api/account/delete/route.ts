export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { logAudit } from "../../../../lib/audit";

export async function POST(req: NextRequest) {
  const deletedTables: string[] = [];
  const failedTables: string[] = [];

  try {
    const appUserId = await getSessionAppUserId(req);
    if (!appUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return NextResponse.json(
        { ok: false, error: "Must send { confirm: true } to delete account" },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    // Log the deletion event before we start (audit trail)
    await logAudit({
      appUserId,
      action: "delete_account",
      resourceType: "account",
      resourceId: appUserId,
      details: { initiated: true },
      ipAddress: ip || undefined,
    });

    console.log(`[account/delete] ${new Date().toISOString()} — Account deletion initiated for app_user_id`);

    // Helper to delete from a table and track results
    async function deleteFrom(table: string, column: string, value: string) {
      try {
        const { error } = await supabaseAdmin.from(table).delete().eq(column, value);
        if (error) throw error;
        deletedTables.push(table);
      } catch (err) {
        console.error(`[account/delete] Failed to delete from ${table}:`, err);
        failedTables.push(table);
      }
    }

    // 1. patient_notes
    await deleteFrom("patient_notes", "app_user_id", appUserId);

    // 2. kate_insights
    await deleteFrom("kate_insights", "app_user_id", appUserId);

    // 3-5. Get schedule_attempt IDs first for cascading deletes
    let attemptIds: number[] = [];
    try {
      const { data: attempts } = await supabaseAdmin
        .from("schedule_attempts")
        .select("id")
        .eq("app_user_id", appUserId);
      attemptIds = (attempts || []).map((a) => a.id);
    } catch (err) {
      console.error("[account/delete] Failed to fetch schedule_attempts:", err);
    }

    if (attemptIds.length > 0) {
      // 3. call_notes (via attempt IDs)
      try {
        const { error } = await supabaseAdmin
          .from("call_notes")
          .delete()
          .in("attempt_id", attemptIds);
        if (error) throw error;
        deletedTables.push("call_notes");
      } catch (err) {
        console.error("[account/delete] Failed to delete call_notes:", err);
        failedTables.push("call_notes");
      }

      // 4. call_scorecards (via attempt IDs)
      try {
        const { error } = await supabaseAdmin
          .from("call_scorecards")
          .delete()
          .in("attempt_id", attemptIds);
        if (error) throw error;
        deletedTables.push("call_scorecards");
      } catch (err) {
        console.error("[account/delete] Failed to delete call_scorecards:", err);
        failedTables.push("call_scorecards");
      }

      // 5. proposals (via attempt IDs)
      try {
        const { error } = await supabaseAdmin
          .from("proposals")
          .delete()
          .in("attempt_id", attemptIds);
        if (error) throw error;
        deletedTables.push("proposals");
      } catch (err) {
        console.error("[account/delete] Failed to delete proposals:", err);
        failedTables.push("proposals");
      }
    }

    // 6. schedule_attempts
    await deleteFrom("schedule_attempts", "app_user_id", appUserId);

    // 7. calendar_events
    await deleteFrom("calendar_events", "app_user_id", appUserId);

    // 8. calendar_connections (via integrations)
    try {
      const { data: integrations } = await supabaseAdmin
        .from("integrations")
        .select("id")
        .eq("app_user_id", appUserId);
      const integrationIds = (integrations || []).map((i) => i.id);
      if (integrationIds.length > 0) {
        const { error } = await supabaseAdmin
          .from("calendar_connections")
          .delete()
          .in("integration_id", integrationIds);
        if (error) throw error;
        deletedTables.push("calendar_connections");
      }
    } catch (err) {
      console.error("[account/delete] Failed to delete calendar_connections:", err);
      failedTables.push("calendar_connections");
    }

    // 9. portal_connections
    await deleteFrom("portal_connections", "app_user_id", appUserId);

    // 10. portal_facts
    await deleteFrom("portal_facts", "app_user_id", appUserId);

    // 11. integrations
    await deleteFrom("integrations", "app_user_id", appUserId);

    // 12. provider_visits
    await deleteFrom("provider_visits", "app_user_id", appUserId);

    // 13. providers
    await deleteFrom("providers", "app_user_id", appUserId);

    // 14. plaid_transactions (via plaid_items, if table exists)
    try {
      const { data: plaidItems } = await supabaseAdmin
        .from("plaid_items")
        .select("id")
        .eq("app_user_id", appUserId);
      const plaidItemIds = (plaidItems || []).map((i) => i.id);
      if (plaidItemIds.length > 0) {
        const { error } = await supabaseAdmin
          .from("plaid_transactions")
          .delete()
          .in("plaid_item_id", plaidItemIds);
        if (error) throw error;
        deletedTables.push("plaid_transactions");
      }
    } catch (err) {
      // Table may not exist — that's OK
      console.error("[account/delete] plaid_transactions (may not exist):", err);
    }

    // 15. plaid_items
    try {
      await deleteFrom("plaid_items", "app_user_id", appUserId);
    } catch {
      // Table may not exist
    }

    // 16. Get auth_user_id before deleting app_users row
    let authUserId: string | null = null;
    try {
      const { data: appUser } = await supabaseAdmin
        .from("app_users")
        .select("auth_user_id")
        .eq("id", appUserId)
        .maybeSingle();
      authUserId = appUser?.auth_user_id || null;
    } catch {
      // Non-critical for deletion flow
    }

    // Delete app_users row
    await deleteFrom("app_users", "id", appUserId);

    // 17. Delete Supabase Auth user
    if (authUserId) {
      try {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
        if (error) throw error;
        deletedTables.push("auth_user");
      } catch (err) {
        console.error("[account/delete] Failed to delete auth user:", err);
        failedTables.push("auth_user");
      }
    }

    console.log(`[account/delete] ${new Date().toISOString()} — Account deletion completed. Deleted: ${deletedTables.join(", ")}. Failed: ${failedTables.join(", ") || "none"}`);

    return NextResponse.json({
      ok: true,
      deleted: true,
      deletedTables,
      failedTables: failedTables.length > 0 ? failedTables : undefined,
    });
  } catch (err) {
    console.error("[account/delete] Unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Account deletion failed",
        deletedTables,
        failedTables,
      },
      { status: 500 }
    );
  }
}
