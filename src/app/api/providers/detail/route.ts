export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const providerId = url.searchParams.get("id");
  if (!providerId) {
    return NextResponse.json({ ok: false, error: "Missing provider id" }, { status: 400 });
  }

  // Fetch provider
  const { data: provider } = await supabaseAdmin
    .from("providers")
    .select("*")
    .eq("id", providerId)
    .eq("app_user_id", appUserId)
    .maybeSingle();

  if (!provider) {
    return NextResponse.json({ ok: false, error: "Provider not found" }, { status: 404 });
  }

  // Fetch in parallel: visits, calendar events, notes, call history
  const [visitsRes, eventsRes, notesRes, attemptsRes] = await Promise.all([
    supabaseAdmin
      .from("provider_visits")
      .select("id, visit_date, amount, source")
      .eq("app_user_id", appUserId)
      .eq("provider_id", providerId)
      .order("visit_date", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("calendar_events")
      .select("id, start_at, end_at, status, source")
      .eq("app_user_id", appUserId)
      .eq("provider_id", providerId)
      .order("start_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("patient_notes")
      .select("id, content, note_type, created_at")
      .eq("app_user_id", appUserId)
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("schedule_attempts")
      .select("id, status, created_at, metadata")
      .eq("app_user_id", appUserId)
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const visits = visitsRes.data || [];
  const calendarEvents = eventsRes.data || [];
  const notes = notesRes.data || [];
  const attempts = attemptsRes.data || [];

  const now = new Date();
  const upcomingEvents = calendarEvents.filter(
    (e) => e.status === "confirmed" && new Date(e.start_at) > now
  );
  const pastEvents = calendarEvents.filter(
    (e) => e.status === "confirmed" && new Date(e.start_at) <= now
  );

  return NextResponse.json({
    ok: true,
    provider,
    visits,
    upcomingEvents,
    pastEvents,
    notes,
    callHistory: attempts.map((a) => {
      const meta = (a.metadata || {}) as Record<string, unknown>;
      const booking = meta.booking_summary as Record<string, unknown> | null;
      return {
        id: a.id,
        status: a.status,
        date: a.created_at,
        displayTime: booking?.display_time || null,
      };
    }),
  });
}
