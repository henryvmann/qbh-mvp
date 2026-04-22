export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

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

  return NextResponse.json({
    ok: true,
    upcoming,
    years,
    providerCount: providerRows.length,
  });
}
