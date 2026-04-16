export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import {
  getDashboardProvidersForUser,
  getDashboardDiscoverySummaryForUser,
  getGoogleCalendarConnectionForUser,
} from "../../../../lib/qbh/queries/dashboard";
import { logAudit } from "../../../../lib/audit";

async function getUserInfo(appUserId: string): Promise<{ displayName: string | null; fullName: string | null }> {
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("auth_user_id, patient_profile")
    .eq("id", appUserId)
    .maybeSingle();

  const profile = (appUser?.patient_profile || {}) as Record<string, string | null>;
  const nickname = profile.display_name || profile.nickname || null;

  let fullName: string | null = null;
  if (appUser?.auth_user_id) {
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(
      appUser.auth_user_id
    );
    fullName = user?.user_metadata?.name ?? null;
  }

  // Display name: nickname > first name from full name > full name
  const firstName = fullName?.split(" ")[0] || null;
  const displayName = nickname || firstName || fullName;

  return { displayName, fullName };
}

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);

  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  logAudit({ appUserId, action: "view_dashboard", resourceType: "dashboard", ipAddress: ip });

  const [snapshots, discoverySummary, hasGoogleCalendarConnection, userInfo] =
    await Promise.all([
      getDashboardProvidersForUser(appUserId),
      getDashboardDiscoverySummaryForUser(appUserId),
      getGoogleCalendarConnectionForUser(appUserId),
      getUserInfo(appUserId),
    ]);

  return NextResponse.json({
    ok: true,
    appUserId,
    userName: userInfo.displayName || null,
    fullName: userInfo.fullName || null,
    snapshots,
    discoverySummary,
    hasGoogleCalendarConnection,
  });
}
