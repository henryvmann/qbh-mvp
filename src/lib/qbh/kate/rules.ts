// Rules layer — given KateFacts, decides which bucket the user is in,
// which items to surface, and which response chips to offer.
//
// All deterministic. No LLM. Output of this layer is the structural
// answer to "what is Kate paying attention to and what should the
// user be able to say back" — the voice layer turns it into prose.

import type { KateBucket, KateChip, KateConfidence, KateFacts, KateItem } from "./types";

export const RULES_VERSION = "kate-rules-v1";

export type RuleResult = {
  bucket: KateBucket;
  tone: "calm" | "active" | "celebratory" | "quiet";
  confidence: KateConfidence;
  items: KateItem[];
  chips: KateChip[];
};

export function classify(facts: KateFacts): RuleResult {
  const confidence = confidenceFrom(facts.daysSinceSignup);
  const items = pickItems(facts);

  // Bucket selection: celebratory beats quantity-based buckets if a
  // recent completion just landed (in the last 24h ideally; we use the
  // 7-day window from signals as a softer floor).
  if (facts.recentCompletions.length > 0 && hasFreshCompletion(facts)) {
    return {
      bucket: "celebratory",
      tone: "celebratory",
      confidence,
      items: items.slice(0, 1),
      chips: [
        { id: "thanks", label: "Thanks", intent: "thanks", primary: true },
        { id: "whats-next", label: "What's next?", intent: "elaborate" },
      ],
    };
  }

  // Quantity-based buckets, sorted by count of actionable items.
  const actionableCount = items.filter((i) => i.urgency !== "later").length;

  if (actionableCount === 0) {
    return {
      bucket: "quiet",
      tone: "quiet",
      confidence,
      items: items.slice(0, 0),
      chips: [{ id: "ok", label: "OK, thanks", intent: "thanks", primary: true }],
    };
  }

  if (actionableCount === 1) {
    return {
      bucket: "one_thing",
      tone: "active",
      confidence,
      items: items.slice(0, 1),
      chips: [
        { id: "handle", label: "Handle it", intent: "handle", primary: true },
        { id: "more", label: "Tell me more", intent: "elaborate" },
        { id: "defer", label: "Not now", intent: "defer" },
      ],
    };
  }

  if (actionableCount <= 4) {
    return {
      bucket: "couple_things",
      tone: "active",
      confidence,
      items: items.slice(0, 4),
      chips: [
        { id: "handle-all", label: "Handle it", intent: "handle", primary: true },
        { id: "more", label: "Tell me more", intent: "elaborate" },
        { id: "defer", label: "Not now", intent: "defer" },
      ],
    };
  }

  // 5+ items
  return {
    bucket: "lots",
    tone: "active",
    confidence,
    items: items.slice(0, 6),
    chips: [
      { id: "top", label: "Start with the top one", intent: "handle", primary: true },
      { id: "show-all", label: "Show me everything", intent: "elaborate" },
      { id: "defer", label: "Hold off", intent: "defer" },
    ],
  };
}

function confidenceFrom(days: number): KateConfidence {
  if (days < 8) return "new";
  if (days < 30) return "settled";
  return "established";
}

function hasFreshCompletion(facts: KateFacts): boolean {
  // Within the last 36 hours we treat as fresh — long enough to span
  // a typical sleep gap, short enough that the celebratory framing still
  // feels true. Beyond that, the booking is just a fact, not news.
  const cutoff = Date.now() - 36 * 60 * 60 * 1000;
  return facts.recentCompletions.some(
    (c) => new Date(c.booked_at).getTime() >= cutoff
  );
}

function pickItems(facts: KateFacts): KateItem[] {
  const items: KateItem[] = [];

  // 1. Failed booking attempts surface first — they need user input.
  for (const fa of facts.failedAttempts) {
    items.push({
      id: `failed-${fa.schedule_attempt_id}`,
      type: "booking_failed",
      title: `Booking with ${fa.provider_name}`,
      detail: "Office didn't book — want me to try a different angle?",
      urgency: "now",
      refs: { schedule_attempt_id: fa.schedule_attempt_id },
    });
  }

  // 1.5. Newly added providers with no visits yet — user just told us
  // these matter; offer to book the first appointment.
  for (const np of facts.newProvidersNeverSeen) {
    items.push({
      id: `new-${np.provider_id}`,
      type: "new_provider_no_visits",
      title: `${np.name}`,
      detail:
        np.addedDaysAgo <= 1
          ? "you just added them — want me to book a first visit?"
          : "no appointment booked yet — want me to set one up?",
      urgency: "soon",
      refs: { provider_id: np.provider_id },
    });
  }

  // 2. Overdue follow-ups, ordered by months since visit (oldest first).
  const overdueSorted = [...facts.overdueFollowUps].sort(
    (a, b) => (b.monthsSinceVisit ?? 0) - (a.monthsSinceVisit ?? 0)
  );
  for (const o of overdueSorted) {
    items.push({
      id: `overdue-${o.provider_id}`,
      type: "follow_up_overdue",
      title: `${o.name} follow-up`,
      detail:
        o.monthsSinceVisit !== null
          ? `last seen ${o.monthsSinceVisit} months ago`
          : `due for a visit`,
      urgency: "soon",
      refs: { provider_id: o.provider_id },
    });
  }

  // 3. In-flight bookings: surface as "later" — Kate's already on it,
  //    user doesn't need to act, but worth showing.
  for (const a of facts.inFlightAttempts) {
    items.push({
      id: `inflight-${a.schedule_attempt_id}`,
      type: "booking_in_progress",
      title: `${a.provider_name} — booking`,
      detail: "I'm working on this one",
      urgency: "later",
      refs: { schedule_attempt_id: a.schedule_attempt_id },
    });
  }

  // 4. Upcoming confirmed appointments — visible context, not action.
  for (const u of facts.upcomingAppointments) {
    items.push({
      id: `upcoming-${u.calendar_event_id ?? u.starts_at}`,
      type: "appointment_upcoming",
      title: `${u.provider_name}`,
      detail: friendlyDate(u.starts_at),
      urgency: "later",
      refs: u.calendar_event_id ? { calendar_event_id: u.calendar_event_id } : undefined,
    });
  }

  // 5. Recent completions — only attached when we're in celebratory bucket.
  for (const c of facts.recentCompletions) {
    items.push({
      id: `done-${c.provider_name}-${c.booked_at}`,
      type: "recent_completion",
      title: `${c.provider_name}`,
      detail: `booked ${friendlyRelative(c.booked_at)}`,
      urgency: "later",
    });
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────
// Friendly date helpers
// ─────────────────────────────────────────────────────────────────

function friendlyDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  if (!sameYear) opts.year = "numeric";
  return d.toLocaleString("en-US", opts);
}

function friendlyRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
