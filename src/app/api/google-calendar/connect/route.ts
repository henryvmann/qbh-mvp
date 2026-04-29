export const dynamic = 'force-dynamic';
// src/app/api/google-calendar/connect/route.ts

import { NextResponse } from "next/server";
import { buildGoogleCalendarAuthUrl } from "../../../../lib/google-calendar";
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

    // Allow the caller (e.g. onboarding) to declare where they want the user
    // sent after the OAuth round-trip. Carried through the OAuth state.
    const body = (await req.json().catch(() => ({}))) as { return_to?: string };
    const returnTo = typeof body.return_to === "string" && body.return_to.trim()
      ? body.return_to.trim()
      : undefined;

    const authorizeUrl = await buildGoogleCalendarAuthUrl(appUserId, returnTo);

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