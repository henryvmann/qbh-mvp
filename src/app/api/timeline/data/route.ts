export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getStoredGoogleCalendarConnection, getValidGoogleCalendarAccessToken } from "../../../../lib/google-calendar";

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
        const HEALTH_PATTERN = /doctor|dr\.|dr |dentist|dental|medical|clinic|hospital|health|therapy|physical therapy|chiropractic|optom|eye exam|eye doctor|derma|cardio|ortho|urgent care|checkup|check-?up|appointment|annual exam|wellness visit|psychiatr|psycholog|nutrit/i;

        for (const event of gcalData.items || []) {
          const summary = event.summary || "";
          if (!HEALTH_PATTERN.test(summary)) continue;

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
            if (lower.includes(pLower) || pLower.includes(lower)) {
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
  });
}
