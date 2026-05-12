export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getStoredGoogleCalendarConnection, getValidGoogleCalendarAccessToken, HEALTHCARE_PATTERN } from "../../../../lib/google-calendar";

type TimelineVisit = {
  id: string;
  date: string;
  amount: number | null;
  source: string;
};

type TimelineProvider = {
  providerId: string;
  providerName: string;
  visits: TimelineVisit[];
};

type TimelineYear = {
  year: string;
  providers: TimelineProvider[];
  totalVisits: number;
};

type UpcomingEvent = {
  id: string;
  providerId: string;
  providerName: string;
  date: string;
  detail: string;
  needsProviderMatch?: boolean;
};

type CalendarHealthEvent = {
  id: string;
  summary: string;
  date: string;
  providerId: string | null;
  providerName: string | null;
  needsProviderMatch: boolean;
};

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);

  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // User-dismissed timeline events — events the keyword filter let
  // through but the user manually marked "not relevant." Stored on the
  // patient_profile so they survive across sessions and devices.
  const { data: userProfile } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .maybeSingle();
  const dismissedIdsRaw = userProfile?.patient_profile?.dismissed_calendar_event_ids;
  const dismissedEventIds = new Set<string>(
    Array.isArray(dismissedIdsRaw)
      ? dismissedIdsRaw.filter((x: unknown): x is string => typeof x === "string")
      : []
  );
  // User-added custom timeline items — surfaced in the year-ahead view
  // so users can hand-add goals (GLP-1 start, cancer annual, etc.) that
  // aren't derivable from providers or guidelines. Stored on
  // patient_profile.custom_timeline_items.
  const customRaw = userProfile?.patient_profile?.custom_timeline_items;
  const customTimelineItems = Array.isArray(customRaw)
    ? customRaw.filter((x: unknown): x is {
        id: string;
        title: string;
        description?: string | null;
        target_month?: string | null;
        created_at: string;
      } => {
        return typeof x === "object" && x !== null
          && typeof (x as { id?: unknown }).id === "string"
          && typeof (x as { title?: unknown }).title === "string";
      })
    : [];

  // Get all active providers
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, name, specialty, provider_type")
    .eq("app_user_id", appUserId)
    .eq("status", "active");

  const providerRows = providers ?? [];
  const providerNameMap = new Map<string, string>();
  for (const p of providerRows) {
    providerNameMap.set(p.id, p.name);
  }

  const providerIds = providerRows.map((p) => p.id);

  // Fetch all visits
  const { data: visits } = providerIds.length > 0
    ? await supabaseAdmin
        .from("provider_visits")
        .select("id, provider_id, visit_date, amount, source")
        .eq("app_user_id", appUserId)
        .in("provider_id", providerIds)
        .order("visit_date", { ascending: false })
        .limit(200)
    : { data: [] };

  // Fetch upcoming calendar events
  const { data: calEvents } = providerIds.length > 0
    ? await supabaseAdmin
        .from("calendar_events")
        .select("id, provider_id, start_at, end_at, status")
        .eq("app_user_id", appUserId)
        .eq("status", "confirmed")
        .gte("start_at", new Date().toISOString())
        .in("provider_id", providerIds)
        .order("start_at", { ascending: true })
        .limit(20)
    : { data: [] };

  // Build upcoming events
  const upcoming: UpcomingEvent[] = (calEvents ?? []).map((ce) => ({
    id: ce.id,
    providerId: ce.provider_id,
    providerName: providerNameMap.get(ce.provider_id) ?? "Unknown Provider",
    date: ce.start_at,
    detail: new Date(ce.start_at).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  }));

  // Group visits by year, then by provider
  const yearMap = new Map<string, Map<string, TimelineVisit[]>>();

  for (const v of visits ?? []) {
    if (!v.visit_date) continue;
    const year = new Date(v.visit_date).getFullYear().toString();
    if (!yearMap.has(year)) yearMap.set(year, new Map());
    const provMap = yearMap.get(year)!;
    const pid = v.provider_id;
    if (!provMap.has(pid)) provMap.set(pid, []);
    provMap.get(pid)!.push({
      id: String(v.id),
      date: v.visit_date,
      amount: v.amount != null ? Number(v.amount) : null,
      source: v.source || "unknown",
    });
  }

  // Build year sections sorted descending
  const years: TimelineYear[] = [];
  const sortedYears = [...yearMap.keys()].sort((a, b) => Number(b) - Number(a));

  for (const year of sortedYears) {
    const provMap = yearMap.get(year)!;
    const yearProviders: TimelineProvider[] = [];
    let totalVisits = 0;

    for (const [pid, pvVisits] of provMap) {
      const name = providerNameMap.get(pid) ?? "Unknown Provider";
      yearProviders.push({
        providerId: pid,
        providerName: name,
        visits: pvVisits,
      });
      totalVisits += pvVisits.length;
    }

    // Sort providers by visit count descending
    yearProviders.sort((a, b) => b.visits.length - a.visits.length);

    years.push({ year, providers: yearProviders, totalVisits });
  }

  // Fetch Google Calendar events for timeline
  const calendarEvents: CalendarHealthEvent[] = [];
  try {
    const gcalConn = await getStoredGoogleCalendarConnection(appUserId);
    if (gcalConn) {
      const connection = await getValidGoogleCalendarAccessToken(appUserId);
      const timeMin = new Date();
      timeMin.setFullYear(timeMin.getFullYear() - 2);
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 3);

      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "200",
      });

      const gcalRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${connection.access_token}` }, cache: "no-store" }
      );

      if (gcalRes.ok) {
        const gcalData = await gcalRes.json();
        // Use the shared HEALTHCARE_PATTERN (from lib/google-calendar.ts)
        // instead of an inline regex. The previous inline pattern matched
        // bare "appointment" / "annual exam" / "checkup" / "health", which
        // let through obvious non-healthcare events ("Wayfair Home Services
        // appointment", "United Health Group meeting", etc). The shared
        // pattern is tighter — requires specific specialty / credential /
        // place terms.
        for (const event of gcalData.items || []) {
          const summary = event.summary || "";
          if (!HEALTHCARE_PATTERN.test(summary)) continue;
          if (dismissedEventIds.has(event.id)) continue;

          const startAt = event.start?.dateTime || event.start?.date || "";
          if (!startAt) continue;

          let providerName = summary.trim().replace(
            /^(appointment|visit|checkup|check-?up|annual exam|wellness visit)\s*(with|at|[-:@])\s*/i, ""
          );

          // Try to match to existing provider
          const lower = providerName.toLowerCase();
          let matchedId: string | null = null;
          let matchedName: string | null = null;

          for (const p of providerRows) {
            const pLower = p.name.toLowerCase();
            // Full containment
            if (lower.includes(pLower) || pLower.includes(lower)) {
              matchedId = p.id;
              matchedName = p.name;
              break;
            }
            // Word-level match: any significant word from provider name found in event
            const provWords = pLower.split(/[\s.,]+/).filter((w) => w.length > 3);
            const eventWords = lower.split(/[\s.,]+/).filter((w) => w.length > 3);
            const overlap = provWords.filter((pw) => eventWords.some((ew) => ew.includes(pw) || pw.includes(ew)));
            if (overlap.length >= 1 && provWords.length > 0) {
              matchedId = p.id;
              matchedName = p.name;
              break;
            }
          }

          // Specialty keyword match
          if (!matchedId) {
            const specialtyMap: Record<string, RegExp> = {
              eye: /eye|vision|optom|ophthal/i,
              dental: /dent|dds|oral/i,
              therapy: /therap|psych|counsel|mental/i,
              derma: /derm|skin/i,
            };
            for (const [keyword, pattern] of Object.entries(specialtyMap)) {
              if (lower.includes(keyword)) {
                const match = providerRows.find((p) => pattern.test(p.name.toLowerCase()));
                if (match) { matchedId = match.id; matchedName = match.name; break; }
              }
            }
          }

          calendarEvents.push({
            id: event.id || startAt,
            summary: providerName,
            date: startAt,
            providerId: matchedId,
            providerName: matchedName,
            needsProviderMatch: !matchedId,
          });
        }
      }
    }
  } catch {
    // Google Calendar is best-effort
  }

  // Add unmatched calendar events to year map as "calendar" source visits
  for (const ce of calendarEvents) {
    const eventDate = new Date(ce.date);
    const isFuture = eventDate.getTime() > Date.now();

    if (isFuture) {
      // Add to upcoming if not already there
      const alreadyInUpcoming = upcoming.some((u) =>
        Math.abs(new Date(u.date).getTime() - eventDate.getTime()) < 3600000
      );
      if (!alreadyInUpcoming) {
        upcoming.push({
          id: `gcal-${ce.id}`,
          providerId: ce.providerId || "",
          providerName: ce.providerName || ce.summary,
          date: ce.date,
          detail: eventDate.toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          }),
          needsProviderMatch: ce.needsProviderMatch,
        });
      }
    } else {
      // Add past events to year map
      const year = eventDate.getFullYear().toString();
      const displayName = ce.providerName || ce.summary;
      const pid = ce.providerId || `gcal-${ce.summary.toLowerCase().replace(/\s+/g, "-")}`;

      if (!yearMap.has(year)) yearMap.set(year, new Map());
      const provMap = yearMap.get(year)!;
      if (!provMap.has(pid)) provMap.set(pid, []);
      provMap.get(pid)!.push({
        id: `gcal-${ce.id}`,
        date: ce.date.split("T")[0],
        amount: null,
        source: "calendar",
      });

      // Make sure provider name is in the map
      if (!providerNameMap.has(pid)) {
        providerNameMap.set(pid, displayName);
      }
    }
  }

  // Rebuild year sections with calendar events included
  const finalYears: TimelineYear[] = [];
  const allYearKeys = [...yearMap.keys()].sort((a, b) => Number(b) - Number(a));

  for (const year of allYearKeys) {
    const provMap = yearMap.get(year)!;
    const yearProviders: TimelineProvider[] = [];
    let totalVisits = 0;

    for (const [pid, pvVisits] of provMap) {
      const name = providerNameMap.get(pid) ?? "Unknown Provider";
      yearProviders.push({ providerId: pid, providerName: name, visits: pvVisits });
      totalVisits += pvVisits.length;
    }

    yearProviders.sort((a, b) => b.visits.length - a.visits.length);
    finalYears.push({ year, providers: yearProviders, totalVisits });
  }

  // Sort upcoming by date
  upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({
    ok: true,
    upcoming,
    years: finalYears,
    providerCount: providerRows.length,
    customTimelineItems,
  });
}

/**
 * Dismiss a timeline calendar event the user says isn't healthcare-
 * related. Persists the event ID in patient_profile.dismissed_calendar_event_ids
 * so the next GET filters it out. Cheap escape hatch for events that
 * slip past the keyword filter.
 */
export async function POST(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let body: { dismissed_event_id?: string } = {};
  try { body = await req.json(); } catch {}
  const eventId = body.dismissed_event_id;
  if (typeof eventId !== "string" || !eventId.trim()) {
    return NextResponse.json({ ok: false, error: "Missing dismissed_event_id" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();
  const profile = (existing?.patient_profile || {}) as Record<string, unknown>;
  const currentList = Array.isArray(profile.dismissed_calendar_event_ids)
    ? (profile.dismissed_calendar_event_ids as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const next = Array.from(new Set([...currentList, eventId]));
  await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: { ...profile, dismissed_calendar_event_ids: next } })
    .eq("id", appUserId);

  return NextResponse.json({ ok: true });
}
