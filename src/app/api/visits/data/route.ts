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
  const providerNameMap = new Map<string, string>();

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

  // 2. Past visits from provider_visits (all, no limit for aggregation)
  const { data: pastVisitRows } = await supabaseAdmin
    .from("provider_visits")
    .select("id, provider_id, visit_date, amount_cents, source, created_at")
    .eq("app_user_id", appUserId)
    .order("visit_date", { ascending: false, nullsFirst: false });

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
    amountCents: v.amount_cents ?? null,
    source: v.source ?? null,
  }));

  // 3. Follow-ups from dashboard providers
  const snapshots = await getDashboardProvidersForUser(appUserId);
  const followUps = snapshots
    .filter((s) => s.followUpNeeded)
    .map((s) => ({
      providerId: s.provider.id,
      providerName: s.provider.name,
    }));

  // 4. Booking attempts from schedule_attempts + call_notes
  const { data: attemptRows } = await supabaseAdmin
    .from("schedule_attempts")
    .select("id, provider_id, status, created_at")
    .eq("app_user_id", appUserId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Get provider names for attempts
  const attemptProviderIds = [
    ...new Set((attemptRows ?? []).map((a) => a.provider_id).filter(Boolean)),
  ];
  if (attemptProviderIds.length > 0) {
    const { data: attemptProviders } = await supabaseAdmin
      .from("providers")
      .select("id, name")
      .in("id", attemptProviderIds);

    for (const p of attemptProviders ?? []) {
      if (!providerNameMap.has(p.id)) {
        providerNameMap.set(p.id, p.name);
      }
    }
  }

  // Get call_notes for attempt summaries
  const attemptIds = (attemptRows ?? []).map((a) => a.id);
  const callNoteMap = new Map<number, string>();
  if (attemptIds.length > 0) {
    const { data: callNotes } = await supabaseAdmin
      .from("call_notes")
      .select("attempt_id, summary")
      .in("attempt_id", attemptIds);

    for (const cn of callNotes ?? []) {
      if (cn.summary && !callNoteMap.has(cn.attempt_id)) {
        callNoteMap.set(cn.attempt_id, cn.summary);
      }
    }
  }

  const bookingAttempts = (attemptRows ?? []).map((a) => ({
    id: String(a.id),
    providerName: providerNameMap.get(a.provider_id) ?? "Unknown Provider",
    status: a.status,
    createdAt: a.created_at,
    callSummary: callNoteMap.get(a.id) ?? null,
  }));

  // 5. Provider visit summaries
  const now = new Date();
  const providerSummaryMap = new Map<
    string,
    { totalVisits: number; totalCents: number; lastVisitDate: string | null; hasAmount: number }
  >();

  for (const v of pastVisitRows ?? []) {
    const existing = providerSummaryMap.get(v.provider_id);
    const amt = v.amount_cents ?? 0;
    const hasAmt = v.amount_cents != null ? 1 : 0;
    if (existing) {
      existing.totalVisits += 1;
      existing.totalCents += amt;
      existing.hasAmount += hasAmt;
      if (
        v.visit_date &&
        (!existing.lastVisitDate || v.visit_date > existing.lastVisitDate)
      ) {
        existing.lastVisitDate = v.visit_date;
      }
    } else {
      providerSummaryMap.set(v.provider_id, {
        totalVisits: 1,
        totalCents: amt,
        lastVisitDate: v.visit_date ?? null,
        hasAmount: hasAmt,
      });
    }
  }

  const providerSummaries = Array.from(providerSummaryMap.entries()).map(
    ([providerId, s]) => {
      let monthsSinceLastVisit: number | null = null;
      if (s.lastVisitDate) {
        const last = new Date(s.lastVisitDate);
        monthsSinceLastVisit =
          (now.getFullYear() - last.getFullYear()) * 12 +
          (now.getMonth() - last.getMonth());
      }
      return {
        providerId,
        providerName: providerNameMap.get(providerId) ?? "Unknown Provider",
        totalVisits: s.totalVisits,
        lastVisitDate: s.lastVisitDate,
        averageCost: s.hasAmount > 0 ? Math.round(s.totalCents / s.hasAmount) : null,
        monthsSinceLastVisit,
      };
    }
  );

  // Sort by most recent visit first
  providerSummaries.sort((a, b) => {
    if (!a.lastVisitDate && !b.lastVisitDate) return 0;
    if (!a.lastVisitDate) return 1;
    if (!b.lastVisitDate) return -1;
    return b.lastVisitDate.localeCompare(a.lastVisitDate);
  });

  // 6. Monthly spending aggregation
  const monthlyMap = new Map<string, { totalCents: number; visitCount: number }>();
  for (const v of pastVisitRows ?? []) {
    if (!v.visit_date) continue;
    const month = v.visit_date.slice(0, 7); // "2026-03"
    const existing = monthlyMap.get(month);
    const amt = v.amount_cents ?? 0;
    if (existing) {
      existing.totalCents += amt;
      existing.visitCount += 1;
    } else {
      monthlyMap.set(month, { totalCents: amt, visitCount: 1 });
    }
  }

  const monthlySpending = Array.from(monthlyMap.entries())
    .map(([month, s]) => ({
      month,
      totalCents: s.totalCents,
      visitCount: s.visitCount,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json({
    ok: true,
    upcoming,
    past,
    followUps,
    bookingAttempts,
    providerSummaries,
    monthlySpending,
  });
}
