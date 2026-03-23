import { supabaseAdmin } from "../../supabase-server";
import type {
  ProviderDashboardSnapshot,
  Provider,
  ScheduleAttemptSnapshot,
  CalendarEventSnapshot,
} from "../../../app/lib/QBH/types";

export type DashboardDiscoverySummary = {
  chargesAnalyzed: number;
  providersFound: number;
};

const ACTIVE_ATTEMPT_STATUSES = new Set([
  "CREATED",
  "CALLING",
  "PROPOSED",
]);

type JsonRecord = Record<string, unknown>;

type ProviderRow = {
  id: string;
  app_user_id: string;
  name: string;
  status: string;
  created_at: string;
};

type AttemptRow = {
  id: number | string;
  provider_id: string;
  status: string;
  created_at: string;
  metadata: unknown;
};

type EventRow = {
  id: string;
  provider_id: string;
  start_at: string;
  end_at: string;
  timezone: string | null;
  status: string;
  created_at: string;
};

type VisitRow = {
  provider_id: string;
  visit_date: string | null;
  created_at: string;
};

type CallNoteRow = {
  attempt_id: number | string;
  summary: string | null;
  created_at: string;
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

export async function getDashboardProvidersForUser(
  userId: string
): Promise<ProviderDashboardSnapshot[]> {
  const cleanedUserId = String(userId || "").trim();

  const { data: providers, error: providersError } = await supabaseAdmin
    .from("providers")
    .select("id,name,status,created_at,app_user_id")
    .eq("app_user_id", cleanedUserId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (providersError) throw providersError;

  const providerRows = (providers ?? []) as ProviderRow[];

  if (providerRows.length === 0) return [];

  const providerIds = providerRows.map((p) => p.id);

  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from("schedule_attempts")
    .select("id,provider_id,status,created_at,metadata")
    .in("provider_id", providerIds)
    .order("created_at", { ascending: false });

  if (attemptsError) throw attemptsError;

  const latestAttemptByProvider = new Map<
    string,
    ScheduleAttemptSnapshot & { metadata?: unknown }
  >();

  for (const row of (attempts ?? []) as AttemptRow[]) {
    if (!latestAttemptByProvider.has(row.provider_id)) {
      latestAttemptByProvider.set(row.provider_id, {
        id: Number(row.id),
        status: row.status as ScheduleAttemptSnapshot["status"],
        created_at: row.created_at,
        metadata: row.metadata ?? null,
      });
    }
  }

  const nowIso = new Date().toISOString();

  const { data: events, error: eventsError } = await supabaseAdmin
    .from("calendar_events")
    .select("id,provider_id,start_at,end_at,timezone,status,created_at")
    .in("provider_id", providerIds)
    .eq("status", "confirmed")
    .gte("start_at", nowIso)
    .order("start_at", { ascending: true });

  if (eventsError) throw eventsError;

  const futureConfirmedByProvider = new Map<string, CalendarEventSnapshot>();

  for (const row of (events ?? []) as EventRow[]) {
    if (!futureConfirmedByProvider.has(row.provider_id)) {
      futureConfirmedByProvider.set(row.provider_id, {
        id: row.id,
        start_at: row.start_at,
        end_at: row.end_at,
        timezone: row.timezone,
        status: row.status as CalendarEventSnapshot["status"],
      });
    }
  }

  const { data: visits, error: visitsError } = await supabaseAdmin
    .from("provider_visits")
    .select("provider_id,visit_date,created_at")
    .eq("app_user_id", cleanedUserId)
    .in("provider_id", providerIds)
    .order("visit_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (visitsError) throw visitsError;

  const visitCountByProvider = new Map<string, number>();

  for (const row of (visits ?? []) as VisitRow[]) {
    visitCountByProvider.set(
      row.provider_id,
      (visitCountByProvider.get(row.provider_id) ?? 0) + 1
    );
  }

  const latestAttemptIds = Array.from(
    new Set(
      Array.from(latestAttemptByProvider.values())
        .map((a) => a.id)
        .filter((id) => Number.isFinite(id))
    )
  );

  const latestNoteByAttemptId = new Map<number, { summary: string | null }>();

  if (latestAttemptIds.length > 0) {
    const { data: notes, error: notesError } = await supabaseAdmin
      .from("call_notes")
      .select("attempt_id,summary,created_at")
      .in("attempt_id", latestAttemptIds)
      .order("created_at", { ascending: false });

    if (notesError) throw notesError;

    for (const row of (notes ?? []) as CallNoteRow[]) {
      const attemptId = Number(row.attempt_id);

      if (!latestNoteByAttemptId.has(attemptId)) {
        latestNoteByAttemptId.set(attemptId, {
          summary: row.summary,
        });
      }
    }
  }

  return providerRows.map((pRow): ProviderDashboardSnapshot => {
    const provider: Provider = {
      id: pRow.id,
      name: pRow.name,
      phone: null,
      specialty: null,
      location: null,
    };

    const futureConfirmedEvent =
      futureConfirmedByProvider.get(pRow.id) ?? null;

    const latestAttempt = latestAttemptByProvider.get(pRow.id) ?? null;

    const latestNote = latestAttempt
      ? latestNoteByAttemptId.get(latestAttempt.id) ?? null
      : null;

    const visitCount = visitCountByProvider.get(pRow.id) ?? 0;
    const hasVisitHistory = visitCount > 0;
    const hasActiveBookingAttempt = latestAttempt
      ? ACTIVE_ATTEMPT_STATUSES.has(String(latestAttempt.status).toUpperCase())
      : false;

    const metadata = asRecord(latestAttempt?.metadata);
    const bookingSummary = asRecord(metadata?.booking_summary);

    const bookingSummaryStatus =
      typeof bookingSummary?.status === "string" ? bookingSummary.status : null;
    const lastEvent =
      typeof metadata?.last_event === "string" ? metadata.last_event : null;

    const isBooked =
      bookingSummaryStatus === "BOOKED_CONFIRMED" ||
      latestAttempt?.status === "BOOKED_CONFIRMED" ||
      lastEvent === "BOOKED_CONFIRMED";

    const booking_state: ProviderDashboardSnapshot["booking_state"] = {
      status: isBooked
        ? "BOOKED"
        : hasActiveBookingAttempt
        ? "IN_PROGRESS"
        : hasVisitHistory
        ? "FOLLOW_UP"
        : "NONE",
      displayTime:
        typeof bookingSummary?.display_time === "string"
          ? bookingSummary.display_time
          : null,
      appointmentStart:
        typeof bookingSummary?.appointment_start === "string"
          ? bookingSummary.appointment_start
          : null,
      appointmentEnd:
        typeof bookingSummary?.appointment_end === "string"
          ? bookingSummary.appointment_end
          : null,
      timezone:
        typeof bookingSummary?.timezone === "string"
          ? bookingSummary.timezone
          : null,
    };

    const followUpNeeded = booking_state.status === "FOLLOW_UP";

    return {
      provider,
      followUpNeeded,
      latestAttempt,
      futureConfirmedEvent,
      latestNote,
      booking_state,
    };
  });
}

export async function getDashboardDiscoverySummaryForUser(
  userId: string
): Promise<DashboardDiscoverySummary> {
  const cleanedUserId = String(userId || "").trim();

  const [
    { count: chargesCount, error: visitsError },
    { count: providersCount, error: providersError },
  ] = await Promise.all([
    supabaseAdmin
      .from("provider_visits")
      .select("*", { count: "exact", head: true })
      .eq("app_user_id", cleanedUserId),
    supabaseAdmin
      .from("providers")
      .select("*", { count: "exact", head: true })
      .eq("app_user_id", cleanedUserId)
      .eq("status", "active"),
  ]);

  if (visitsError) throw visitsError;
  if (providersError) throw providersError;

  return {
    chargesAnalyzed: chargesCount ?? 0,
    providersFound: providersCount ?? 0,
  };
}

export async function getGoogleCalendarConnectionForUser(
  userId: string
): Promise<boolean> {
  const cleanedUserId = String(userId || "").trim();

  if (!cleanedUserId) return false;

  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select("id")
    .eq("app_user_id", cleanedUserId)
    .eq("integration_type", "calendar")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data?.id);
}