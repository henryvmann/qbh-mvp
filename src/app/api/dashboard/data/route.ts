import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import {
  getDashboardProvidersForUser,
  getDashboardDiscoverySummaryForUser,
  getGoogleCalendarConnectionForUser,
} from "../../../../lib/qbh/queries/dashboard";

export async function GET() {
  const appUserId = await getSessionAppUserId();

  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [snapshots, discoverySummary, hasGoogleCalendarConnection] =
    await Promise.all([
      getDashboardProvidersForUser(appUserId),
      getDashboardDiscoverySummaryForUser(appUserId),
      getGoogleCalendarConnectionForUser(appUserId),
    ]);

  return NextResponse.json({
    ok: true,
    appUserId,
    snapshots,
    discoverySummary,
    hasGoogleCalendarConnection,
  });
}
