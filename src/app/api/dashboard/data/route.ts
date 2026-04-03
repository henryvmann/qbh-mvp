export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import {
  getDashboardProvidersForUser,
  getDashboardDiscoverySummaryForUser,
  getGoogleCalendarConnectionForUser,
} from "../../../../lib/qbh/queries/dashboard";

async function getUserName(appUserId: string): Promise<string | null> {
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("auth_user_id")
    .eq("id", appUserId)
    .maybeSingle();

  if (!appUser?.auth_user_id) return null;

  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(
    appUser.auth_user_id
  );

  return user?.user_metadata?.name ?? null;
}

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);

  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [snapshots, discoverySummary, hasGoogleCalendarConnection, userName] =
    await Promise.all([
      getDashboardProvidersForUser(appUserId),
      getDashboardDiscoverySummaryForUser(appUserId),
      getGoogleCalendarConnectionForUser(appUserId),
      getUserName(appUserId),
    ]);

  return NextResponse.json({
    ok: true,
    appUserId,
    userName: userName || null,
    snapshots,
    discoverySummary,
    hasGoogleCalendarConnection,
  });
}
