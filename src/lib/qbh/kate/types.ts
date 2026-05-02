// Shared types for the Kate-state inference layer.
//
// The flow is: signals → rules → voice → state → API.
//   - SIGNALS gather raw facts from the DB (deterministic).
//   - RULES classify the user into a state bucket and pick the items
//     Kate should reference + the response chips she should offer.
//   - VOICE renders the message string (Phase 1: templates; Phase 2: LLM).
//   - STATE orchestrates the above and returns KateState to the API.

/** A single thing Kate is paying attention to right now. */
export type KateItem = {
  /** Stable id so the UI can attach actions / dismissals. */
  id: string;
  type:
    | "follow_up_overdue"
    | "new_provider_no_visits"
    | "appointment_upcoming"
    | "booking_in_progress"
    | "booking_failed"
    | "refill"
    | "recent_completion";
  /** What Kate is referencing (e.g. provider name, visit date). */
  title: string;
  /** Short context line — months since last visit, calendar date, etc. */
  detail: string;
  /** UI urgency band — drives presentation, not whether Kate mentions it. */
  urgency: "now" | "soon" | "later";
  /** When does this item lose relevance? (For dedup against next render.) */
  staleAfter?: string; // ISO
  /** Optional ids that link the item back to underlying rows so the UI's
   *  "Handle it" can fire the right action. */
  refs?: {
    provider_id?: string;
    schedule_attempt_id?: number;
    calendar_event_id?: string;
  };
};

/** A response option attached to Kate's current message. */
export type KateChip = {
  id: string;
  label: string;
  intent: "handle" | "elaborate" | "defer" | "thanks" | "custom";
  primary?: boolean;
};

/** What Kate is currently seeing — pre-voice, pre-presentation.
 *  Output of the rule layer. */
export type KateBucket =
  | "quiet"          // no urgent items
  | "one_thing"      // exactly 1 actionable
  | "couple_things"  // 2-4 actionable
  | "lots"           // 5+ actionable
  | "celebratory"    // recently completed something significant
  | "recap";         // weekly reset moment

/** Confidence band scales with how much Kate knows about this user. */
export type KateConfidence = "new" | "settled" | "established";

/** Full inference result returned by the API. */
export type KateState = {
  /** What bucket the user is in right now. */
  bucket: KateBucket;
  /** Kate's tone for this message — drives voice + UI presentation. */
  tone: "calm" | "active" | "celebratory" | "quiet";
  /** Days since the user signed up — drives confidence band. */
  daysSinceSignup: number;
  confidence: KateConfidence;
  /** Kate's message in her voice. Multi-line markdown allowed. */
  message: string;
  /** Items she's referencing in the message (UI can render badges /
   *  attach inline actions). */
  items: KateItem[];
  /** 1–3 response chips. Order matters; chips[0] is the primary action. */
  chips: KateChip[];
  /** Status band content above Kate (state text + score + delta). */
  status: {
    stateText: string; // "You're in a good place." / "A few things piling up."
    score: number | null; // null when we genuinely don't have one yet
    deltaText: string | null; // "↑ 6 this week" or null when we lack history
  };
  /** Telemetry — useful to log so we can review what Kate said over time
   *  without replaying the rule layer. */
  meta: {
    generatedAt: string;
    rulesVersion: string;
    voiceVersion: string;
  };
};

/** Raw output of the SIGNALS layer — pure DB facts, no judgment yet. */
export type KateFacts = {
  appUserId: string;
  daysSinceSignup: number;
  /** Active provider count (excludes pharmacy + dismissed). */
  activeProviderCount: number;
  /** Providers whose last visit is older than the overdue threshold. */
  overdueFollowUps: Array<{
    provider_id: string;
    name: string;
    monthsSinceVisit: number | null;
    lastVisitDate: string | null;
  }>;
  /** Providers added recently with no visit history and nothing in
   *  motion — Kate should offer to book a first appointment. */
  newProvidersNeverSeen: Array<{
    provider_id: string;
    name: string;
    addedDaysAgo: number;
  }>;
  /** Confirmed upcoming appointments in the next 14 days. */
  upcomingAppointments: Array<{
    provider_name: string;
    starts_at: string;
    calendar_event_id: string | null;
    schedule_attempt_id: number | null;
  }>;
  /** Schedule attempts currently in flight (CREATED / IN_PROGRESS). */
  inFlightAttempts: Array<{
    schedule_attempt_id: number;
    provider_name: string;
    started_at: string;
  }>;
  /** Schedule attempts that recently failed and might need user input. */
  failedAttempts: Array<{
    schedule_attempt_id: number;
    provider_name: string;
    failed_at: string;
  }>;
  /** Bookings completed in the last 7 days (for celebratory bucket). */
  recentCompletions: Array<{
    provider_name: string;
    booked_at: string;
  }>;
  /** Most recent message Kate sent to this user, with the items she
   *  referenced — used to avoid repeating herself on a refresh. */
  lastKateMessage: {
    sentAt: string;
    referencedItemIds: string[];
  } | null;
  /** Score signals — null when we genuinely don't have data yet. */
  score: number | null;
  scoreDelta: number | null; // +/- vs ~7d ago, null if we lack history
  /** User-selected priority areas Kate should bias toward (booking,
   *  reminders, mental health, preventive, etc.). Pulled from
   *  app_users.patient_profile.kate_focus_areas. Empty = no bias. */
  focusAreas: string[];
};
