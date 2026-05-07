export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { scanCalendarForProviders } from "../../../../lib/google-calendar";
import { lookupPlaceCandidates } from "../../../../lib/google/places-lookup";
import { stateFromZip } from "../../../../lib/qbh/state-from-zip";

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
    const { providers: matches, allEvents } = await scanCalendarForProviders(appUserId);

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

    // Filter to only truly new providers — first against pre-existing rows
    // in providers, then against each other so a recurring calendar event
    // (e.g. "Dr. Echelman yearly appointment" appearing on multiple dates)
    // doesn't insert duplicate provider rows.
    const seenInBatch = new Set<string>();
    const newMatches = matches.filter((m) => {
      if (isDuplicate(m.name)) return false;
      const key = m.name.toLowerCase().trim();
      if (seenInBatch.has(key)) return false;
      seenInBatch.add(key);
      // Also feed this name into existingProviderList so subsequent matches
      // in the same batch see it for the word-overlap dedupe rule.
      existingProviderList.push(key);
      return true;
    });

    // Pull user's state from zip so Places searches are scoped to
    // the right state. Without this, "Modern Dermatology" matches
    // any practice with that name across the country.
    const { data: userRow } = await supabaseAdmin
      .from("app_users")
      .select("patient_profile")
      .eq("id", appUserId)
      .maybeSingle();
    const profile = (userRow?.patient_profile || {}) as Record<string, unknown>;
    const userZip =
      (profile.zip_code as string | undefined) ||
      (profile.zip as string | undefined) ||
      null;
    const userState = stateFromZip(userZip);

    // Insert new providers with source="calendar" and status="active".
    // Phone resolution: 1 confident Places match → write phone_number;
    // 2+ → store as phone_candidates so the user picks the right one
    // on the provider detail page; 0 → leave phone null.
    let insertedCount = 0;
    for (const match of newMatches) {
      let phoneNumber: string | null = null;
      let phoneCandidates:
        | Array<{ name: string; phone: string; address: string | null }>
        | null = null;
      let address: string | null = null;
      try {
        const candidates = await lookupPlaceCandidates(match.name, userState, 5, userZip);
        if (candidates.length === 1) {
          phoneNumber = candidates[0].phone;
          address = candidates[0].address;
        } else if (candidates.length > 1) {
          phoneCandidates = candidates.map((c) => ({
            name: c.name,
            phone: c.phone,
            address: c.address,
          }));
        }
      } catch {}

      const { error } = await supabaseAdmin.from("providers").insert({
        app_user_id: appUserId,
        name: match.name,
        source: "calendar",
        status: "active",
        phone_number: phoneNumber,
        phone_candidates: phoneCandidates,
        address: address,
      });

      if (!error) {
        insertedCount++;
      }
    }

    // Create provider_visits for past calendar events so they show in Past Visits
    const { data: allProviders } = await supabaseAdmin
      .from("providers")
      .select("id, name")
      .eq("app_user_id", appUserId)
      .eq("status", "active");

    const providerByName = new Map<string, string>();
    for (const p of allProviders || []) {
      providerByName.set(p.name.toLowerCase(), p.id);
    }

    const now = new Date();
    let visitsCreated = 0;
    for (const evt of allEvents) {
      const evtDate = new Date(evt.date);
      if (evtDate >= now) continue; // Only past events

      const providerId = providerByName.get(evt.name.toLowerCase());
      if (!providerId) continue;

      const visitDate = evt.date.split("T")[0];
      // Check if visit already exists to avoid duplicates
      const { data: existing } = await supabaseAdmin
        .from("provider_visits")
        .select("id")
        .eq("app_user_id", appUserId)
        .eq("provider_id", providerId)
        .eq("visit_date", visitDate)
        .maybeSingle();

      if (!existing) {
        const { error: visitErr } = await supabaseAdmin
          .from("provider_visits")
          .insert({ app_user_id: appUserId, provider_id: providerId, visit_date: visitDate, source: "calendar" });
        if (!visitErr) visitsCreated++;
      }
    }

    return NextResponse.json({
      ok: true,
      new_providers: insertedCount,
      past_visits_created: visitsCreated,
      matches: matches.map((m) => ({
        name: m.name,
        date: m.date,
        upcoming: m.upcoming,
        already_exists: isDuplicate(m.name),
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
