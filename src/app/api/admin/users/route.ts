export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

type AdminUser = {
  app_user_id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  survey_answers: any | null;
  plaid_connected: boolean;
  calendar_connected: boolean;
  providers_total: number;
  providers_active: number;
  providers_dismissed: number;
  providers_review: number;
  visits_count: number;
  booking_attempts: number;
  last_activity: string | null;
};

export async function GET() {
  try {
    // 1. Get all app_users
    const { data: appUsers, error: appUsersError } = await supabaseAdmin
      .from("app_users")
      .select("id, auth_user_id, created_at")
      .order("created_at", { ascending: false });

    if (appUsersError) {
      console.error("[admin/users] app_users error:", appUsersError);
      return NextResponse.json({ ok: false, error: appUsersError.message }, { status: 500 });
    }

    if (!appUsers || appUsers.length === 0) {
      return NextResponse.json({ ok: true, users: [] });
    }

    // 2. Get all auth users in one call for metadata (name, email, survey_answers)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authError) {
      console.error("[admin/users] auth listUsers error:", authError);
      return NextResponse.json({ ok: false, error: "Failed to fetch auth users" }, { status: 500 });
    }

    const authUserMap = new Map<string, { name: string | null; email: string | null; survey_answers: any }>();
    for (const u of authData.users) {
      authUserMap.set(u.id, {
        name: u.user_metadata?.name ?? null,
        email: u.email ?? null,
        survey_answers: u.user_metadata?.survey_answers ?? null,
      });
    }

    const appUserIds = appUsers.map((u) => u.id);

    // 3. Aggregate queries — fetch all in parallel, count in JS
    const [
      { data: providerRows },
      { data: plaidRows },
      { data: calendarRows },
      { data: visitRows },
      { data: bookingRows },
    ] = await Promise.all([
      supabaseAdmin.from("providers").select("app_user_id, status, created_at").in("app_user_id", appUserIds),
      supabaseAdmin.from("plaid_items").select("app_user_id").in("app_user_id", appUserIds),
      supabaseAdmin.from("integrations").select("app_user_id").eq("integration_type", "calendar").in("app_user_id", appUserIds),
      supabaseAdmin.from("provider_visits").select("app_user_id, visit_date").in("app_user_id", appUserIds),
      supabaseAdmin.from("schedule_attempts").select("app_user_id, created_at").in("app_user_id", appUserIds),
    ]);

    // Build lookup maps
    const providerMap = new Map<string, { total: number; active: number; dismissed: number; review: number }>();
    for (const row of providerRows ?? []) {
      const entry = providerMap.get(row.app_user_id) ?? { total: 0, active: 0, dismissed: 0, review: 0 };
      entry.total++;
      if (row.status === "active") entry.active++;
      else if (row.status === "dismissed") entry.dismissed++;
      else if (row.status === "review_needed") entry.review++;
      providerMap.set(row.app_user_id, entry);
    }

    const plaidSet = new Set<string>();
    for (const row of plaidRows ?? []) plaidSet.add(row.app_user_id);

    const calendarSet = new Set<string>();
    for (const row of calendarRows ?? []) calendarSet.add(row.app_user_id);

    const visitMap = new Map<string, number>();
    for (const row of visitRows ?? []) {
      visitMap.set(row.app_user_id, (visitMap.get(row.app_user_id) ?? 0) + 1);
    }

    const bookingMap = new Map<string, number>();
    for (const row of bookingRows ?? []) {
      bookingMap.set(row.app_user_id, (bookingMap.get(row.app_user_id) ?? 0) + 1);
    }

    // Last activity: most recent timestamp across providers, visits, schedule_attempts
    const lastActivityMap = new Map<string, string>();
    function trackActivity(userId: string, dateStr: string | null) {
      if (!dateStr) return;
      const cur = lastActivityMap.get(userId);
      if (!cur || dateStr > cur) lastActivityMap.set(userId, dateStr);
    }
    for (const row of providerRows ?? []) trackActivity(row.app_user_id, row.created_at);
    for (const row of visitRows ?? []) trackActivity(row.app_user_id, row.visit_date);
    for (const row of bookingRows ?? []) trackActivity(row.app_user_id, row.created_at);

    // 4. Join everything together
    const users: AdminUser[] = appUsers.map((appUser) => {
      const authInfo = appUser.auth_user_id ? authUserMap.get(appUser.auth_user_id) : null;
      const provStats = providerMap.get(appUser.id) ?? { total: 0, active: 0, dismissed: 0, review: 0 };

      return {
        app_user_id: appUser.id,
        name: authInfo?.name ?? null,
        email: authInfo?.email ?? null,
        created_at: appUser.created_at,
        survey_answers: authInfo?.survey_answers ?? null,
        plaid_connected: plaidSet.has(appUser.id),
        calendar_connected: calendarSet.has(appUser.id),
        providers_total: provStats.total,
        providers_active: provStats.active,
        providers_dismissed: provStats.dismissed,
        providers_review: provStats.review,
        visits_count: visitMap.get(appUser.id) ?? 0,
        booking_attempts: bookingMap.get(appUser.id) ?? 0,
        last_activity: lastActivityMap.get(appUser.id) ?? null,
      };
    });

    return NextResponse.json({ ok: true, users });
  } catch (err) {
    console.error("[admin/users] error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
