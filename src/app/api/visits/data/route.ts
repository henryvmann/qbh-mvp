export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getDashboardProvidersForUser } from "../../../../lib/qbh/queries/dashboard";

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

  const upcoming = (upcomingEvents ?? []).map((e) => ({
    eventId: e.id,
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

  return NextResponse.json({ ok: true, upcoming, past, followUps });
}
