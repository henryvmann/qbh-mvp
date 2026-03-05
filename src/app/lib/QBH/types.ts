// src/lib/qbh/types.ts

/**
 * Core UI-layer types for QBH Dashboard.
 * These mirror backend truth but do NOT redefine it.
 * Booking state is derived from schedule_attempts + calendar_events.
 */

export type Provider = {
  id: string; // UUID (matches providers.id)
  name: string;
  phone?: string | null;
  specialty?: string | null;
  location?: string | null;
};

// DB stores status as text (default 'CREATED'). We keep known values,
// but allow others safely without breaking UI when backend adds more.
export type ScheduleAttemptStatus =
  | "CREATED"
  | "CALLING"
  | "PROPOSED"
  | "CONFIRMED"
  | "BOOKED_CONFIRMED"
  | "FAILED"
  | "CANCELLED"
  | (string & {});

export type ScheduleAttemptSnapshot = {
  id: number; // bigint in DB → number in TS
  status: ScheduleAttemptStatus;
  created_at: string; // ISO
};

export type CalendarEventStatus =
  | "confirmed"
  | "cancelled"
  | (string & {});

export type CalendarEventSnapshot = {
  id: string;
  start_at: string; // ISO
  end_at: string;   // ISO
  status: CalendarEventStatus; // DB is text default 'confirmed'
};

export type ProviderDashboardSnapshot = {
  provider: Provider;

  /**
   * Derived state for UI rendering only.
   * All truth comes from DB reads.
   */
  followUpNeeded: boolean;

  latestAttempt: ScheduleAttemptSnapshot | null;

  futureConfirmedEvent: CalendarEventSnapshot | null;
};