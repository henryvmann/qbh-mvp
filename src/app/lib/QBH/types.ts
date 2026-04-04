export type Provider = {
  id: string;
  name: string;
  phone?: string | null;
  specialty?: string | null;
  location?: string | null;
};

export type ScheduleAttemptStatus =
  | "CREATED"
  | "CALLING"
  | "PROPOSED"
  | "CONFIRMED"
  | "BOOKED_CONFIRMED"
  | "FAILED"
  | "CANCELLED"
  | (string & {});

export type BookingSummary = {
  status?: string | null;
  timezone?: string | null;
  provider_id?: string | null;
  display_time?: string | null;
  appointment_start?: string | null;
  appointment_end?: string | null;
  calendar_event_id?: string | null;
  proof?: {
    calendar_event_created?: boolean;
    portal_fact_written?: boolean;
  };
};

export type ExistingBookedAppointment = {
  source_attempt_id: number;
  booking_summary: {
    status: "BOOKED_CONFIRMED";
    timezone: string | null;
    provider_id: string | null;
    display_time: string | null;
    appointment_start: string | null;
    appointment_end: string | null;
    calendar_event_id: string | null;
  };
};

export type AvailabilityContext = {
  calendar_connected?: boolean;
  time_min?: string | null;
  time_max?: string | null;
  time_zone?: string | null;
  busy_blocks?: unknown[];
  busy_block_count?: number;
  source_summaries?: unknown[];
  availability_error?: string;
};

export type ScheduleAttemptMetadata = {
  booking_summary?: BookingSummary;
  last_event?: string | null;
  source?: string | null;
  flow_mode?: "BOOK" | "ADJUST" | (string & {});
  availability_context?: AvailabilityContext;
  existing_booking?: ExistingBookedAppointment | null;
  vapi_status?: number;
  vapi_error?: unknown;
};

export type ScheduleAttemptSnapshot = {
  id: number;
  status: ScheduleAttemptStatus;
  created_at: string;
  metadata?: ScheduleAttemptMetadata | null;
};

export type CalendarEventStatus =
  | "confirmed"
  | "cancelled"
  | (string & {});

export type CalendarEventSnapshot = {
  id: string;
  start_at: string;
  end_at: string;
  timezone?: string | null;
  status: CalendarEventStatus;
};

export type BookingStateStatus =
  | "BOOKED"
  | "IN_PROGRESS"
  | "FOLLOW_UP"
  | "NONE";

export type BookingState = {
  status: BookingStateStatus;
  displayTime: string | null;
  appointmentStart: string | null;
  appointmentEnd: string | null;
  timezone: string | null;
};

export type BookingHistoryEventType =
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "failed";

export type BookingHistoryEvent = {
  id: string;
  provider_id: string;
  app_user_id: string;
  event_type: BookingHistoryEventType;
  occurred_at: string;
  appointment_start: string | null;
  appointment_end: string | null;
  timezone: string | null;
  display_time: string | null;
  schedule_attempt_id: number | null;
  calendar_event_id: string | null;
  superseded_by_calendar_event_id: string | null;
};

export type SystemActionType =
  | "BOOK_APPOINTMENT"
  | "RESCHEDULE_APPOINTMENT"
  | "REVIEW_BROKEN_STATE"
  | "NONE";

export type SystemActionStatus =
  | "NONE"
  | "PENDING"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED";

export type SystemActionRequiredBy =
  | "USER"
  | "SYSTEM"
  | "OFFICE"
  | "NONE";

export type SystemActionItem = {
  type: SystemActionType;
  status: SystemActionStatus;
  occurredAt: string | null;
  scheduleAttemptId: number | null;
  calendarEventId: string | null;
  userInputRequired: boolean;
  requiredBy: SystemActionRequiredBy;
  blockingReason: string | null;
};

export type SystemActionIntegrity = {
  hasMultipleFutureConfirmedEvents: boolean;
  futureConfirmedEventCount: number;
};

export type SystemActionsState = {
  current: SystemActionItem | null;
  last: SystemActionItem | null;
  next: SystemActionItem | null;
  integrity: SystemActionIntegrity;
};

export type ProviderDashboardSnapshot = {
  provider: Provider;
  followUpNeeded: boolean;
  latestAttempt: ScheduleAttemptSnapshot | null;
  futureConfirmedEvent: CalendarEventSnapshot | null;
  latestNote?: {
    summary: string | null;
  } | null;
  booking_state: BookingState;
  history: BookingHistoryEvent[];
  system_actions: SystemActionsState;
  visitCount: number;
  lastVisitDate: string | null;
};