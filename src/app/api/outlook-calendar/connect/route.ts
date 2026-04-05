export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { buildOutlookCalendarAuthUrl } from "../../../../lib/outlook-calendar";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

export async function POST(req: Request) {
  try {
    const appUserId = await getSessionAppUserId(req);

    if (!appUserId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const authorizeUrl = await buildOutlookCalendarAuthUrl(appUserId);

    return NextResponse.json({
      ok: true,
      authorize_url: authorizeUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to build Outlook Calendar authorization URL";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
