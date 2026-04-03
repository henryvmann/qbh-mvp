export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

type Goal = {
  id: string;
  title: string;
  status: "overdue" | "needs_attention" | "upcoming" | "pending";
  detail: string;
  category: string;
};

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);

  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const goals: Goal[] = [];
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // 1. Get providers with their latest visit dates
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, name")
    .eq("app_user_id", appUserId)
    .eq("status", "active");

  const providerRows = providers ?? [];
  const providerIds = providerRows.map((p) => p.id);

  // Get latest visit per provider
  let visitsByProvider = new Map<string, string>();
  if (providerIds.length > 0) {
    const { data: visits } = await supabaseAdmin
      .from("provider_visits")
      .select("provider_id, visit_date")
      .eq("app_user_id", appUserId)
      .in("provider_id", providerIds)
      .order("visit_date", { ascending: false });

    for (const v of visits ?? []) {
      if (v.visit_date && !visitsByProvider.has(v.provider_id)) {
        visitsByProvider.set(v.provider_id, v.visit_date);
      }
    }
  }

  // 2 & 3. Generate goals based on visit recency
  for (const p of providerRows) {
    const lastVisit = visitsByProvider.get(p.id);
    if (!lastVisit) continue;

    const lastVisitDate = new Date(lastVisit);

    if (lastVisitDate < twelveMonthsAgo) {
      goals.push({
        id: `reconnect-${p.id}`,
        title: `Reconnect with ${p.name}`,
        status: "needs_attention",
        detail: `No visits in over 12 months. Last visit: ${lastVisitDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
        category: "care",
      });
    } else if (lastVisitDate < sixMonthsAgo) {
      goals.push({
        id: `schedule-${p.id}`,
        title: `Schedule a visit with ${p.name}`,
        status: "overdue",
        detail: `Last visit was ${lastVisitDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Consider scheduling a follow-up.`,
        category: "care",
      });
    }
  }

  // 4. Check Google Calendar connection
  const { data: calIntegration } = await supabaseAdmin
    .from("integrations")
    .select("id")
    .eq("app_user_id", appUserId)
    .eq("integration_type", "calendar")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!calIntegration) {
    goals.push({
      id: "connect-calendar",
      title: "Connect Google Calendar",
      status: "pending",
      detail:
        "Link your calendar so QBH can check availability and confirm appointments automatically.",
      category: "setup",
    });
  }

  // 5. Upcoming booked appointments
  if (providerIds.length > 0) {
    const { data: bookedAttempts } = await supabaseAdmin
      .from("schedule_attempts")
      .select("id, provider_id, metadata")
      .eq("app_user_id", appUserId)
      .eq("status", "BOOKED_CONFIRMED")
      .in("provider_id", providerIds);

    for (const attempt of bookedAttempts ?? []) {
      const provider = providerRows.find((p) => p.id === attempt.provider_id);
      if (!provider) continue;

      const meta =
        attempt.metadata && typeof attempt.metadata === "object"
          ? (attempt.metadata as Record<string, unknown>)
          : null;
      const bookingSummary =
        meta?.booking_summary && typeof meta.booking_summary === "object"
          ? (meta.booking_summary as Record<string, unknown>)
          : null;
      const displayTime =
        typeof bookingSummary?.display_time === "string"
          ? bookingSummary.display_time
          : "";

      goals.push({
        id: `attend-${attempt.id}`,
        title: `Attend appointment with ${provider.name}`,
        status: "upcoming",
        detail: displayTime
          ? `Scheduled for ${displayTime}`
          : "Appointment confirmed",
        category: "appointment",
      });
    }
  }

  // Sort: overdue first, then needs_attention, then upcoming, then pending
  const statusOrder: Record<string, number> = {
    overdue: 0,
    needs_attention: 1,
    upcoming: 2,
    pending: 3,
  };
  goals.sort(
    (a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
  );

  return NextResponse.json({ ok: true, goals });
}
