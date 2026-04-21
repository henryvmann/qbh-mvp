export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getDashboardProvidersForUser } from "../../../../lib/qbh/queries/dashboard";
import {
  getStoredGoogleCalendarConnection,
  getValidGoogleCalendarAccessToken,
} from "../../../../lib/google-calendar";

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);

  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const nowIso = new Date().toISOString();

  // 1. Upcoming visits from calendar_events
  const { data: upcomingEvents } = await supabaseAdmin
    .from("calendar_events")
    .select("id, provider_id, start_at, end_at, timezone, status")
    .eq("app_user_id", appUserId)
    .eq("status", "confirmed")
    .gte("start_at", nowIso)
    .order("start_at", { ascending: true });

  // Get provider names for upcoming events
  const upcomingProviderIds = [
    ...new Set((upcomingEvents ?? []).map((e) => e.provider_id)),
  ];
  let providerNameMap = new Map<string, string>();

  if (upcomingProviderIds.length > 0) {
    const { data: upProviders } = await supabaseAdmin
      .from("providers")
      .select("id, name")
      .in("id", upcomingProviderIds);

    for (const p of upProviders ?? []) {
      providerNameMap.set(p.id, p.name);
    }
  }

  const upcoming: Array<{ eventId: string; providerId: string; providerName: string; startAt: string; endAt: string; timezone: string | null }> = (upcomingEvents ?? []).map((e) => ({
    eventId: e.id,
    providerId: e.provider_id,
    providerName: providerNameMap.get(e.provider_id) ?? "Unknown Provider",
    startAt: e.start_at,
    endAt: e.end_at,
    timezone: e.timezone,
  }));

  // 2. Past visits from provider_visits
  const { data: pastVisitRows } = await supabaseAdmin
    .from("provider_visits")
    .select("id, provider_id, visit_date, amount, created_at")
    .eq("app_user_id", appUserId)
    .order("visit_date", { ascending: false, nullsFirst: false })
    .limit(50);

  // Get provider names for past visits
  const pastProviderIds = [
    ...new Set((pastVisitRows ?? []).map((v) => v.provider_id)),
  ];
  if (pastProviderIds.length > 0) {
    const { data: pastProviders } = await supabaseAdmin
      .from("providers")
      .select("id, name")
      .in("id", pastProviderIds);

    for (const p of pastProviders ?? []) {
      if (!providerNameMap.has(p.id)) {
        providerNameMap.set(p.id, p.name);
      }
    }
  }

  const past = (pastVisitRows ?? []).map((v) => ({
    id: v.id,
    providerId: v.provider_id,
    providerName: providerNameMap.get(v.provider_id) ?? "Unknown Provider",
    visitDate: v.visit_date,
    amount: v.amount ?? null,
  }));

  // 3. Follow-ups from dashboard providers
  const snapshots = await getDashboardProvidersForUser(appUserId);
  const followUps = snapshots
    .filter((s) => s.followUpNeeded)
    .map((s) => ({
      providerId: s.provider.id,
      providerName: s.provider.name,
    }));

  // 4. Merge Google Calendar events if connected
  try {
    const gcalConn = await getStoredGoogleCalendarConnection(appUserId);
    if (gcalConn) {
      const connection = await getValidGoogleCalendarAccessToken(appUserId);
      const now = new Date();
      const timeMax = new Date(now);
      timeMax.setMonth(timeMax.getMonth() + 3);

      const GOOGLE_EVENTS_URL =
        "https://www.googleapis.com/calendar/v3/calendars/primary/events";
      const params = new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
      });

      const gcalRes = await fetch(`${GOOGLE_EVENTS_URL}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${connection.access_token}` },
        cache: "no-store",
      });

      if (gcalRes.ok) {
        const gcalData = (await gcalRes.json()) as {
          items?: Array<{
            id?: string;
            summary?: string;
            start?: { dateTime?: string; date?: string; timeZone?: string };
            end?: { dateTime?: string; date?: string };
          }>;
        };

        // Healthcare keywords to filter relevant events
        const HEALTH_PATTERN =
          /doctor|dr\.|dr |dentist|dental|medical|clinic|hospital|health|therapy|physical therapy|chiropractic|optom|eye exam|eye doctor|derma|cardio|ortho|urgent care|checkup|check-?up|appointment|annual exam|wellness visit/i;

        // Build a set of existing upcoming event start times + names for dedup
        const existingKeys = new Set(
          upcoming.map(
            (e) => `${e.providerName.toLowerCase()}|${new Date(e.startAt).getTime()}`
          )
        );

        for (const event of gcalData.items || []) {
          const summary = event.summary || "";
          if (!HEALTH_PATTERN.test(summary)) continue;

          const startAt = event.start?.dateTime || event.start?.date || "";
          const endAt = event.end?.dateTime || event.end?.date || "";
          if (!startAt) continue;

          // Strip common appointment prefixes for a cleaner provider name
          let providerName = summary.trim();
          providerName = providerName.replace(
            /^(appointment|visit|checkup|check-?up|annual exam|wellness visit)\s*(with|at|[-:@])\s*/i,
            ""
          );

          const dedupeKey = `${providerName.toLowerCase()}|${new Date(startAt).getTime()}`;
          if (existingKeys.has(dedupeKey)) continue;
          existingKeys.add(dedupeKey);

          upcoming.push({
            eventId: `gcal-${event.id || startAt}`,
            providerId: "",
            providerName,
            startAt,
            endAt,
            timezone: event.start?.timeZone || null,
          });
        }

        // Re-sort by start time
        upcoming.sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        );
      }
    }
  } catch (err) {
    // Google Calendar fetch is best-effort — don't fail the whole response
    console.error("[visits/data] Google Calendar merge error:", err);
  }

  return NextResponse.json({ ok: true, upcoming, past, followUps });
}
