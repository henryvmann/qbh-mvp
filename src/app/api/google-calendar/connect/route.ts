// src/app/api/google-calendar/connect/route.ts

import { NextResponse } from "next/server";
import { buildGoogleCalendarAuthUrl } from "../../../../lib/google-calendar";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

export async function POST(req: Request) {
  try {
    const appUserId = await getSessionAppUserId();

    if (!appUserId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const authorizeUrl = await buildGoogleCalendarAuthUrl(appUserId);

    return NextResponse.json({
      ok: true,
      authorize_url: authorizeUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to build Google Calendar authorization URL";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}