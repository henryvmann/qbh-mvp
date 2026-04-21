export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  tag: string;
  eventType: "visit" | "booked" | "discovered" | "upcoming";
};

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);

  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Get all active providers for name lookup
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, name, created_at")
    .eq("app_user_id", appUserId)
    .eq("status", "active");

  const providerRows = providers ?? [];
  const providerNameMap = new Map<string, string>();
  for (const p of providerRows) {
    providerNameMap.set(p.id, p.name);
  }

  const providerIds = providerRows.map((p) => p.id);
  const events: TimelineEvent[] = [];

  if (providerIds.length > 0) {
    // 1. Provider visits
    const { data: visits } = await supabaseAdmin
      .from("provider_visits")
      .select("id, provider_id, visit_date, amount")
      .eq("app_user_id", appUserId)
      .in("provider_id", providerIds)
      .order("visit_date", { ascending: false })
      .limit(100);

    for (const v of visits ?? []) {
      const name = providerNameMap.get(v.provider_id) ?? "Unknown Provider";
      const amountStr =
        v.amount != null ? ` — $${Number(v.amount).toFixed(2)}` : "";
      events.push({
        id: `visit-${v.id}`,
        date: v.visit_date ?? "",
        title: `Visit to ${name}`,
        detail: `Completed visit${amountStr}`,
        tag: "Visit",
        eventType: "visit",
      });
    }

    // 2. Booked schedule attempts
    const { data: attempts } = await supabaseAdmin
      .from("schedule_attempts")
      .select("id, provider_id, created_at, metadata")
      .eq("app_user_id", appUserId)
      .eq("status", "BOOKED_CONFIRMED")
      .in("provider_id", providerIds)
      .order("created_at", { ascending: false })
      .limit(100);

    for (const a of attempts ?? []) {
      const name = providerNameMap.get(a.provider_id) ?? "Unknown Provider";
      const meta =
        a.metadata && typeof a.metadata === "object"
          ? (a.metadata as Record<string, unknown>)
          : null;
      const bookingSummary =
        meta?.booking_summary && typeof meta.booking_summary === "object"
          ? (meta.booking_summary as Record<string, unknown>)
          : null;
      const displayTime =
        typeof bookingSummary?.display_time === "string"
          ? bookingSummary.display_time
          : null;

      events.push({
        id: `booked-${a.id}`,
        date: a.created_at,
        title: `Appointment booked with ${name}`,
        detail: displayTime ?? "Appointment confirmed by QBH",
        tag: "Booked",
        eventType: "booked",
      });
    }
  }

  // 3. Upcoming calendar events (confirmed appointments)
  if (providerIds.length > 0) {
    const { data: calEvents } = await supabaseAdmin
      .from("calendar_events")
      .select("id, provider_id, start_at, end_at, status")
      .eq("app_user_id", appUserId)
      .eq("status", "confirmed")
      .in("provider_id", providerIds)
      .order("start_at", { ascending: true })
      .limit(50);

    for (const ce of calEvents ?? []) {
      const name = providerNameMap.get(ce.provider_id) ?? "Unknown Provider";
      const start = new Date(ce.start_at);
      const isFuture = start.getTime() > Date.now();
      const timeStr = start.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      events.push({
        id: `cal-${ce.id}`,
        date: ce.start_at,
        title: `${isFuture ? "Upcoming" : "Past"} appointment with ${name}`,
        detail: timeStr,
        tag: isFuture ? "Upcoming" : "Past Appointment",
        eventType: isFuture ? "upcoming" : "visit",
      });
    }
  }

  // 4. Provider additions (only show if no visits exist for that provider — avoids noise)
  const providerIdsWithVisits = new Set(events.map((e) => {
    const match = e.id.match(/^visit-/);
    return match ? e.id : null;
  }).filter(Boolean));

  if (events.length === 0) {
    // Only show "profile started" if there's nothing else to show
    for (const p of providerRows) {
      events.push({
        id: `discovered-${p.id}`,
        date: p.created_at,
        title: `${p.name} added`,
        detail: "Provider added to your health profile",
        tag: "Added",
        eventType: "discovered",
      });
    }
  }

  // Sort by date descending
  events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Limit to 100
  const limited = events.slice(0, 100);

  return NextResponse.json({ ok: true, events: limited });
}
