import { supabaseAdmin } from "../../supabase-server";
import type {
  ProviderDashboardSnapshot,
  Provider,
  ScheduleAttemptSnapshot,
  CalendarEventSnapshot,
  BookingHistoryEvent,
  SystemActionItem,
  SystemActionsState,
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
  end_at: string | null;
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

function getAttemptMetadata(
  attempt: AttemptRow | null | undefined
): JsonRecord | null {
  return asRecord(attempt?.metadata);
}

function getAttemptBookingSummary(
  attempt: AttemptRow | null | undefined
): JsonRecord | null {
  const metadata = getAttemptMetadata(attempt);
  return asRecord(metadata?.booking_summary);
}

function getAttemptBookingString(
  attempt: AttemptRow | null | undefined,
  key:
    | "display_time"
    | "appointment_start"
    | "appointment_end"
    | "timezone"
    | "calendar_event_id"
): string | null {
  const bookingSummary = getAttemptBookingSummary(attempt);
  const value = bookingSummary?.[key];
  return typeof value === "string" ? value : null;
}

function getAttemptFlowMode(
  attempt: AttemptRow | null | undefined
): "BOOK" | "ADJUST" | null {
  const metadata = getAttemptMetadata(attempt);
  const flowMode = metadata?.flow_mode;

  if (flowMode === "BOOK" || flowMode === "ADJUST") {
    return flowMode;
  }

  return null;
}

function getAttemptLastEvent(
  attempt: AttemptRow | null | undefined
): string | null {
  const metadata = getAttemptMetadata(attempt);
  return typeof metadata?.last_event === "string" ? metadata.last_event : null;
}

function getPrimaryActionType(
  attempt: AttemptRow | null | undefined
): SystemActionItem["type"] {
  return getAttemptFlowMode(attempt) === "ADJUST"
    ? "RESCHEDULE_APPOINTMENT"
    : "BOOK_APPOINTMENT";
}

function buildSystemActionItem(params: {
  type: SystemActionItem["type"];
  status: SystemActionItem["status"];
  occurredAt?: string | null;
  scheduleAttemptId?: number | null;
  calendarEventId?: string | null;
  userInputRequired?: boolean;
  requiredBy?: SystemActionItem["requiredBy"];
  blockingReason?: string | null;
}): SystemActionItem {
  return {
    type: params.type,
    status: params.status,
    occurredAt: params.occurredAt ?? null,
    scheduleAttemptId: params.scheduleAttemptId ?? null,
    calendarEventId: params.calendarEventId ?? null,
    userInputRequired: params.userInputRequired ?? false,
    requiredBy: params.requiredBy ?? "NONE",
    blockingReason: params.blockingReason ?? null,
  };
}

function mapHistoryEventToSystemAction(
  event: BookingHistoryEvent | null | undefined
): SystemActionItem | null {
  if (!event) return null;

  if (event.event_type === "failed") {
    return buildSystemActionItem({
      type: "BOOK_APPOINTMENT",
      status: "BLOCKED",
      occurredAt: event.occurred_at,
      scheduleAttemptId: event.schedule_attempt_id,
      calendarEventId: event.calendar_event_id,
      requiredBy: "SYSTEM",
      blockingReason: "LATEST_ATTEMPT_FAILED",
    });
  }

  if (event.event_type === "rescheduled") {
    return buildSystemActionItem({
      type: "RESCHEDULE_APPOINTMENT",
      status: "COMPLETED",
      occurredAt: event.occurred_at,
      scheduleAttemptId: event.schedule_attempt_id,
      calendarEventId: event.calendar_event_id,
      requiredBy: "NONE",
    });
  }

  return buildSystemActionItem({
    type: "BOOK_APPOINTMENT",
    status: "COMPLETED",
    occurredAt: event.occurred_at,
    scheduleAttemptId: event.schedule_attempt_id,
    calendarEventId: event.calendar_event_id,
    requiredBy: "NONE",
  });
}

function buildProviderHistory(params: {
  appUserId: string;
  providerId: string;
  events: EventRow[];
  attempts: AttemptRow[];
  currentEventId: string | null;
}): BookingHistoryEvent[] {
  const { appUserId, providerId, events, attempts, currentEventId } = params;
  const history: BookingHistoryEvent[] = [];

  const sortedEvents = [...events].sort((a, b) => {
    return new Date(b.start_at).getTime() - new Date(a.start_at).getTime();
  });

  const currentEvent = currentEventId
    ? sortedEvents.find((event) => event.id === currentEventId) ?? null
    : null;

  for (const event of sortedEvents) {
    const isCurrent = currentEventId === event.id;

    let eventType: "booked" | "rescheduled";

    if (isCurrent) {
      eventType = "booked";
    } else if (currentEvent) {
      const isBeforeCurrent =
        new Date(event.start_at).getTime() <
        new Date(currentEvent.start_at).getTime();

      eventType = isBeforeCurrent ? "rescheduled" : "booked";
    } else {
      eventType = "booked";
    }

    history.push({
      id: `calendar_event:${event.id}`,
      provider_id: providerId,
      app_user_id: appUserId,
      event_type: eventType,
      occurred_at: event.created_at ?? event.start_at,
      appointment_start: event.start_at,
      appointment_end: event.end_at,
      timezone: event.timezone,
      display_time: null,
      schedule_attempt_id: null,
      calendar_event_id: event.id,
      superseded_by_calendar_event_id: isCurrent ? null : currentEventId,
    });
  }

  for (const attempt of attempts) {
    const normalizedStatus = String(attempt.status || "").toUpperCase();

    if (normalizedStatus !== "FAILED") {
      continue;
    }

    history.push({
      id: `schedule_attempt:${Number(attempt.id)}`,
      provider_id: providerId,
      app_user_id: appUserId,
      event_type: "failed",
      occurred_at: attempt.created_at,
      appointment_start: null,
      appointment_end: null,
      timezone: null,
      display_time: null,
      schedule_attempt_id: Number(attempt.id),
      calendar_event_id: null,
      superseded_by_calendar_event_id: null,
    });
  }

  const deduped = new Map<string, BookingHistoryEvent>();

  for (const item of history) {
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    return (
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    );
  });
}

function buildSystemActions(params: {
  latestAttempt: AttemptRow | null;
  futureConfirmedEvents: EventRow[];
  futureConfirmedEvent: CalendarEventSnapshot | null;
  hasVisitHistory: boolean;
  history: BookingHistoryEvent[];
}): SystemActionsState {
  const {
    latestAttempt,
    futureConfirmedEvents,
    futureConfirmedEvent,
    hasVisitHistory,
    history,
  } = params;

  const futureConfirmedEventCount = futureConfirmedEvents.length;
  const hasMultipleFutureConfirmedEvents = futureConfirmedEventCount > 1;

  if (hasMultipleFutureConfirmedEvents) {
    return {
      current: buildSystemActionItem({
        type: "REVIEW_BROKEN_STATE",
        status: "BLOCKED",
        occurredAt: futureConfirmedEvents[0]?.created_at ?? null,
        calendarEventId: futureConfirmedEvents[0]?.id ?? null,
        requiredBy: "SYSTEM",
        userInputRequired: false,
        blockingReason: "MULTIPLE_FUTURE_CONFIRMED_EVENTS",
      }),
      last: mapHistoryEventToSystemAction(history[0]),
      next: buildSystemActionItem({
        type: "REVIEW_BROKEN_STATE",
        status: "BLOCKED",
        occurredAt: null,
        requiredBy: "SYSTEM",
        userInputRequired: false,
        blockingReason: "MULTIPLE_FUTURE_CONFIRMED_EVENTS",
      }),
      integrity: {
        hasMultipleFutureConfirmedEvents,
        futureConfirmedEventCount,
      },
    };
  }

  if (futureConfirmedEvent) {
    return {
      current: buildSystemActionItem({
        type: getPrimaryActionType(latestAttempt),
        status: "COMPLETED",
        occurredAt: futureConfirmedEvent.start_at,
        scheduleAttemptId: latestAttempt ? Number(latestAttempt.id) : null,
        calendarEventId: futureConfirmedEvent.id,
        requiredBy: "NONE",
      }),
      last: mapHistoryEventToSystemAction(history[0]),
      next: null,
      integrity: {
        hasMultipleFutureConfirmedEvents,
        futureConfirmedEventCount,
      },
    };
  }

  if (latestAttempt) {
    const normalizedStatus = String(latestAttempt.status || "").toUpperCase();
    const lastEvent = getAttemptLastEvent(latestAttempt);

    if (ACTIVE_ATTEMPT_STATUSES.has(normalizedStatus)) {
      return {
        current: buildSystemActionItem({
          type: getPrimaryActionType(latestAttempt),
          status: "IN_PROGRESS",
          occurredAt: latestAttempt.created_at,
          scheduleAttemptId: Number(latestAttempt.id),
          calendarEventId: getAttemptBookingString(
            latestAttempt,
            "calendar_event_id"
          ),
          requiredBy: "SYSTEM",
        }),
        last: mapHistoryEventToSystemAction(history[0]),
        next: buildSystemActionItem({
          type: getPrimaryActionType(latestAttempt),
          status: "IN_PROGRESS",
          occurredAt: null,
          scheduleAttemptId: Number(latestAttempt.id),
          requiredBy: "SYSTEM",
        }),
        integrity: {
          hasMultipleFutureConfirmedEvents,
          futureConfirmedEventCount,
        },
      };
    }

    if (
      normalizedStatus === "FAILED" ||
      lastEvent === "CALENDAR_CONFLICT_AT_CONFIRM"
    ) {
      return {
        current: buildSystemActionItem({
          type: getPrimaryActionType(latestAttempt),
          status: "BLOCKED",
          occurredAt: latestAttempt.created_at,
          scheduleAttemptId: Number(latestAttempt.id),
          calendarEventId: getAttemptBookingString(
            latestAttempt,
            "calendar_event_id"
          ),
          requiredBy:
            lastEvent === "CALENDAR_CONFLICT_AT_CONFIRM" ? "USER" : "SYSTEM",
          userInputRequired: lastEvent === "CALENDAR_CONFLICT_AT_CONFIRM",
          blockingReason:
            lastEvent === "CALENDAR_CONFLICT_AT_CONFIRM"
              ? "CALENDAR_CONFLICT_AT_CONFIRM"
              : "LATEST_ATTEMPT_FAILED",
        }),
        last: mapHistoryEventToSystemAction(history[0]),
        next: hasVisitHistory
          ? buildSystemActionItem({
              type: getPrimaryActionType(latestAttempt),
              status: "PENDING",
              occurredAt: null,
              requiredBy: "USER",
              userInputRequired: true,
              blockingReason:
                lastEvent === "CALENDAR_CONFLICT_AT_CONFIRM"
                  ? "CALENDAR_CONFLICT_AT_CONFIRM"
                  : "LATEST_ATTEMPT_FAILED",
            })
          : null,
        integrity: {
          hasMultipleFutureConfirmedEvents,
          futureConfirmedEventCount,
        },
      };
    }
  }

  if (hasVisitHistory) {
    return {
      current: null,
      last: mapHistoryEventToSystemAction(history[0]),
      next: buildSystemActionItem({
        type: "BOOK_APPOINTMENT",
        status: "PENDING",
        occurredAt: null,
        requiredBy: "USER",
        userInputRequired: true,
      }),
      integrity: {
        hasMultipleFutureConfirmedEvents,
        futureConfirmedEventCount,
      },
    };
  }

  return {
    current: null,
    last: mapHistoryEventToSystemAction(history[0]),
    next: null,
    integrity: {
      hasMultipleFutureConfirmedEvents,
      futureConfirmedEventCount,
    },
  };
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
    .eq("app_user_id", cleanedUserId)
    .in("provider_id", providerIds)
    .order("created_at", { ascending: false });

  if (attemptsError) throw attemptsError;

  const attemptRows = (attempts ?? []) as AttemptRow[];

  const latestAttemptByProvider = new Map<
    string,
    ScheduleAttemptSnapshot & { metadata?: unknown }
  >();

  const rawLatestAttemptByProvider = new Map<string, AttemptRow>();
  const attemptsByProvider = new Map<string, AttemptRow[]>();

  for (const row of attemptRows) {
    if (!latestAttemptByProvider.has(row.provider_id)) {
      latestAttemptByProvider.set(row.provider_id, {
        id: Number(row.id),
        status: row.status as ScheduleAttemptSnapshot["status"],
        created_at: row.created_at,
        metadata: row.metadata ?? null,
      });

      rawLatestAttemptByProvider.set(row.provider_id, row);
    }

    const existing = attemptsByProvider.get(row.provider_id) ?? [];
    existing.push(row);
    attemptsByProvider.set(row.provider_id, existing);
  }

  const nowIso = new Date().toISOString();

  const { data: events, error: eventsError } = await supabaseAdmin
    .from("calendar_events")
    .select("id,provider_id,start_at,end_at,timezone,status,created_at")
    .eq("app_user_id", cleanedUserId)
    .in("provider_id", providerIds)
    .eq("status", "confirmed")
    .order("start_at", { ascending: true });

  if (eventsError) throw eventsError;

  const eventRows = (events ?? []) as EventRow[];

  const futureConfirmedByProvider = new Map<string, CalendarEventSnapshot>();
  const futureConfirmedEventsByProvider = new Map<string, EventRow[]>();
  const confirmedEventsByProvider = new Map<string, EventRow[]>();

  for (const row of eventRows) {
    const allConfirmed = confirmedEventsByProvider.get(row.provider_id) ?? [];
    allConfirmed.push(row);
    confirmedEventsByProvider.set(row.provider_id, allConfirmed);

    if (row.start_at >= nowIso) {
      const futureConfirmed =
        futureConfirmedEventsByProvider.get(row.provider_id) ?? [];
      futureConfirmed.push(row);
      futureConfirmedEventsByProvider.set(row.provider_id, futureConfirmed);

      if (!futureConfirmedByProvider.has(row.provider_id)) {
        futureConfirmedByProvider.set(row.provider_id, {
          id: row.id,
          start_at: row.start_at,
          end_at: row.end_at ?? row.start_at,
          timezone: row.timezone,
          status: row.status as CalendarEventSnapshot["status"],
        });
      }
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

    const futureConfirmedEvent = futureConfirmedByProvider.get(pRow.id) ?? null;
    const futureConfirmedEvents =
      futureConfirmedEventsByProvider.get(pRow.id) ?? [];
    const latestAttempt = latestAttemptByProvider.get(pRow.id) ?? null;
    const rawLatestAttempt = rawLatestAttemptByProvider.get(pRow.id) ?? null;

    const latestNote = latestAttempt
      ? latestNoteByAttemptId.get(latestAttempt.id) ?? null
      : null;

    const visitCount = visitCountByProvider.get(pRow.id) ?? 0;
    const hasVisitHistory = visitCount > 0;
    const hasMultipleFutureConfirmedEvents = futureConfirmedEvents.length > 1;

    const hasActiveBookingAttempt = latestAttempt
      ? ACTIVE_ATTEMPT_STATUSES.has(String(latestAttempt.status).toUpperCase())
      : false;

    const booking_state: ProviderDashboardSnapshot["booking_state"] = {
      status: hasMultipleFutureConfirmedEvents
        ? "IN_PROGRESS"
        : futureConfirmedEvent
          ? "BOOKED"
          : hasActiveBookingAttempt
            ? "IN_PROGRESS"
            : hasVisitHistory
              ? "FOLLOW_UP"
              : "NONE",
      displayTime: getAttemptBookingString(rawLatestAttempt, "display_time"),
      appointmentStart:
        futureConfirmedEvent?.start_at ??
        getAttemptBookingString(rawLatestAttempt, "appointment_start"),
      appointmentEnd:
        futureConfirmedEvent?.end_at ??
        getAttemptBookingString(rawLatestAttempt, "appointment_end"),
      timezone:
        futureConfirmedEvent?.timezone ??
        getAttemptBookingString(rawLatestAttempt, "timezone"),
    };

    const history = buildProviderHistory({
      appUserId: pRow.app_user_id,
      providerId: pRow.id,
      events: confirmedEventsByProvider.get(pRow.id) ?? [],
      attempts: attemptsByProvider.get(pRow.id) ?? [],
      currentEventId: futureConfirmedEvent?.id ?? null,
    });

    const system_actions = buildSystemActions({
      latestAttempt: rawLatestAttempt,
      futureConfirmedEvents,
      futureConfirmedEvent,
      hasVisitHistory,
      history,
    });

    const followUpNeeded =
      booking_state.status === "FOLLOW_UP" &&
      !system_actions.integrity.hasMultipleFutureConfirmedEvents;

    return {
      provider,
      followUpNeeded,
      latestAttempt,
      futureConfirmedEvent,
      latestNote,
      booking_state,
      history,
      system_actions,
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