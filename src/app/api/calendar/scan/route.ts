export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { scanCalendarForProviders } from "../../../../lib/google-calendar";
import { lookupPlaceDetails } from "../../../../lib/google/places-lookup";

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

    const existingProviderList = (existingProviders || []).map((p) => p.name.toLowerCase());

    // Word-level matching to catch duplicates like
    // "Dr. Echelman yearly appointment" vs "D.D.S. ERIC ECHELMAN"
    function isDuplicate(calName: string): boolean {
      const lower = calName.toLowerCase();
      for (const existing of existingProviderList) {
        if (lower === existing || lower.includes(existing) || existing.includes(lower)) return true;
        // Word overlap — any significant word (4+ chars) match
        const calWords = lower.split(/[\s.,]+/).filter((w) => w.length >= 4);
        const existWords = existing.split(/[\s.,]+/).filter((w) => w.length >= 4);
        const overlap = calWords.filter((cw) => existWords.some((ew) => cw.includes(ew) || ew.includes(cw)));
        if (overlap.length >= 1) return true;
      }
      return false;
    }

    // Filter to only truly new providers
    const newMatches = matches.filter((m) => !isDuplicate(m.name));

    // Insert new providers with source="calendar" and status="active"
    // Auto-lookup phone numbers and addresses
    let insertedCount = 0;
    for (const match of newMatches) {
      // Look up phone and address from Google Places
      let phone: string | null = null;
      let address: string | null = null;
      try {
        const placeInfo = await lookupPlaceDetails(match.name);
        phone = placeInfo.phone;
        address = placeInfo.address;
      } catch {}

      const { error } = await supabaseAdmin.from("providers").insert({
        app_user_id: appUserId,
        name: match.name,
        source: "calendar",
        status: "active",
        phone_number: phone,
        address: address,
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
