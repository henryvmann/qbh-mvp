export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { buildYearAhead } from "../../../lib/qbh/year-ahead";

/**
 * GET /api/year-ahead
 *
 * Returns the user's preventive-care calendar for the next 12 months,
 * grouped by month, plus an "overdue" bucket. Powers /timeline's
 * "Year ahead" section.
 */
export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await buildYearAhead(appUserId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/year-ahead] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to build year ahead" }, { status: 500 });
  }
}
