export type AvailabilitySourceKind =
  | "GOOGLE_CALENDAR"
  | "OUTLOOK_CALENDAR"
  | "PORTAL_APPOINTMENT"
  | "OFFICE_CONSTRAINT"
  | "BOOKING_RULE";

export type AvailabilityBlockKind =
  | "BUSY"
  | "FREE"
  | "HOLD"
  | "UNAVAILABLE";

export type AvailabilityConfidence = "HIGH" | "MEDIUM" | "LOW";

export type AvailabilityDecisionStatus =
  | "AVAILABLE"
  | "CONFLICT"
  | "OUTSIDE_WINDOW"
  | "INVALID";

export type AvailabilityDecisionReasonCode =
  | "OK"
  | "CALENDAR_CONFLICT"
  | "PORTAL_CONFLICT"
  | "OFFICE_BLOCKED"
  | "OUTSIDE_BOOKING_RULES"
  | "INVALID_RANGE";

export type ProposedSlotInput = {
  start_at: string;
  end_at: string;
  timezone: string;
};

export type OfficeConstraintInput = {
  id: string;
  start_at: string;
  end_at: string;
  timezone: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export type AvailabilityBlock = {
  id: string;
  kind: AvailabilityBlockKind;
  source: AvailabilitySourceKind;
  start_at: string;
  end_at: string;
  timezone: string;
  confidence: AvailabilityConfidence;
  title?: string | null;
  provider_id?: string | null;
  integration_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type AvailabilitySourceSummary = {
  source: AvailabilitySourceKind;
  ok: boolean;
  block_count: number;
  warning?: string | null;
};

export type AvailabilityDecision = {
  status: AvailabilityDecisionStatus;
  reason_code: AvailabilityDecisionReasonCode;
  blocking_block_ids: string[];
  notes: string[];
};

export type AvailabilityServiceInput = {
  app_user_id: string;
  window_start: string;
  window_end: string;
  timezone?: string;
  provider_id?: string | null;
  include_sources?: AvailabilitySourceKind[];
  office_constraints?: OfficeConstraintInput[];
  proposed_slot?: ProposedSlotInput | null;
};

export type AvailabilityContext = {
  app_user_id: string;
  timezone: string;
  window_start: string;
  window_end: string;
  blocks: AvailabilityBlock[];
  source_summaries: AvailabilitySourceSummary[];
  decision?: AvailabilityDecision | null;
};

export interface AvailabilitySourceAdapter {
  kind: AvailabilitySourceKind;
  getBlocks(input: AvailabilityServiceInput): Promise<AvailabilityBlock[]>;
}