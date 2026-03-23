// src/app/api/google-calendar/connect/route.ts

import { NextResponse } from "next/server";
import { buildGoogleCalendarAuthUrl } from "../../../../lib/google-calendar";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const appUserId = String(body?.app_user_id || "").trim();

    if (!appUserId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing app_user_id",
        },
        { status: 400 }
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