export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { scanCalendarForProviders } from "../../../../lib/google-calendar";

export async function POST(req: NextRequest) {
  // Try session-based auth first (normal user requests)
  let appUserId = await getSessionAppUserId(req);

  // Fallback: internal server-to-server call from the OAuth callback
  // passes app_user_id via x-app-user-id header
  if (!appUserId) {
    const headerUserId = req.headers.get("x-app-user-id")?.trim();
    if (headerUserId) {
      // Validate the user exists before trusting the header
      const { data } = await supabaseAdmin
        .from("app_users")
        .select("id")
        .eq("id", headerUserId)
        .maybeSingle();
      if (data?.id) {
        appUserId = data.id;
      }
    }
  }

  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const matches = await scanCalendarForProviders(appUserId);

    if (matches.length === 0) {
      return NextResponse.json({
        ok: true,
        new_providers: 0,
        matches: [],
      });
    }

    // Check which providers already exist for this user
    const { data: existingProviders } = await supabaseAdmin
      .from("providers")
      .select("name")
      .eq("app_user_id", appUserId);

    const existingNames = new Set(
      (existingProviders || []).map((p) => p.name.toLowerCase())
    );

    // Filter to only new providers
    const newMatches = matches.filter(
      (m) => !existingNames.has(m.name.toLowerCase())
    );

    // Insert new providers with source="calendar" and status="review_needed"
    let insertedCount = 0;
    for (const match of newMatches) {
      const { error } = await supabaseAdmin.from("providers").insert({
        app_user_id: appUserId,
        name: match.name,
        source: "calendar",
        status: "review_needed",
      });

      if (!error) {
        insertedCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      new_providers: insertedCount,
      matches: matches.map((m) => ({
        name: m.name,
        date: m.date,
        upcoming: m.upcoming,
        already_exists: existingNames.has(m.name.toLowerCase()),
      })),
    });
  } catch (err) {
    console.error("[calendar/scan] error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to scan calendar";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
