// Year Ahead — derive a forward 12-month preventive-care calendar
// from each provider's last visit + cadence. Powers /timeline's
// "Year ahead" view. Answers the typeform signal: "I want to feel
// thorough, proactive, and mapped out for the year."
//
// V1 scope: surface what's inferable from existing providers. We
// skip "phantom" recommendations (e.g. "you should have a PCP") for
// now — that's a v2 onboarding-driven feature.

import { supabaseAdmin } from "../supabase-server";

/** Months between recommended visits per provider type. null = skip. */
const CADENCE_MONTHS: Record<string, number | null> = {
  doctor: 12,            // primary care annual physical
  dentist: 6,
  specialist: 12,        // dermatology, OB/GYN, cardiology, etc.
  vision: 12,
  optometrist: 12,
  ophthalmologist: 12,
  chiropractic: null,    // ad-hoc, not annual
  pt: null,
  mental_health: null,   // weekly/biweekly recurring, not annual
  pharmacy: null,
  urgent_care: null,
  hospital: null,
  lab: null,
  imaging: null,
  other_healthcare: null,
};

export type YearAheadStatus =
  | "scheduled"   // confirmed future calendar event
  | "in_progress" // Kate is actively booking
  | "overdue"     // due date already passed
  | "due";        // due in the next 12 months

export type YearAheadItem = {
  providerId: string;
  providerName: string;
  providerType: string | null;
  title: string;             // "Annual physical", "Dental cleaning", etc.
  status: YearAheadStatus;
  /** ISO date — when it's due (overdue/due) or when it's scheduled (scheduled). */
  date: string;
  /** Optional booking detail when scheduled. */
  detail?: string;
};

export type YearAheadMonth = {
  key: string;     // "2026-05"
  label: string;   // "May 2026"
  items: YearAheadItem[];
};

const TYPE_TITLE: Record<string, string> = {
  doctor: "Annual physical",
  dentist: "Dental cleaning",
  specialist: "Specialist follow-up",
  vision: "Eye exam",
  optometrist: "Eye exam",
  ophthalmologist: "Eye exam",
};

function addMonths(iso: string, months: number): Date {
  const d = new Date(iso);
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Build a 12-month forward window of preventive-care items from
 *  provider history + future calendar events + in-flight schedule attempts. */
export async function buildYearAhead(appUserId: string): Promise<{
  months: YearAheadMonth[];
  overdue: YearAheadItem[];
}> {
  const now = new Date();
  const horizon = addMonths(now.toISOString(), 12);

  // Active providers
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, name, provider_type")
    .eq("app_user_id", appUserId)
    .eq("status", "active");
  const providerRows = providers ?? [];
  const providerIds = providerRows.map((p) => p.id);
  if (providerIds.length === 0) {
    return { months: [], overdue: [] };
  }

  // Latest visit per provider
  const { data: visits } = await supabaseAdmin
    .from("provider_visits")
    .select("provider_id, visit_date")
    .eq("app_user_id", appUserId)
    .in("provider_id", providerIds)
    .order("visit_date", { ascending: false });
  const lastVisitByProvider = new Map<string, string>();
  for (const v of visits ?? []) {
    if (v.visit_date && !lastVisitByProvider.has(v.provider_id)) {
      lastVisitByProvider.set(v.provider_id, v.visit_date);
    }
  }

  // Future confirmed calendar events
  const { data: events } = await supabaseAdmin
    .from("calendar_events")
    .select("provider_id, start_at")
    .eq("app_user_id", appUserId)
    .in("provider_id", providerIds)
    .eq("status", "confirmed")
    .gte("start_at", now.toISOString())
    .order("start_at", { ascending: true });
  const futureEventByProvider = new Map<string, string>();
  for (const e of events ?? []) {
    if (!futureEventByProvider.has(e.provider_id)) {
      futureEventByProvider.set(e.provider_id, e.start_at);
    }
  }

  // In-flight schedule attempts
  const { data: attempts } = await supabaseAdmin
    .from("schedule_attempts")
    .select("provider_id, status, created_at")
    .eq("app_user_id", appUserId)
    .in("provider_id", providerIds)
    .order("created_at", { ascending: false });
  const inFlightProviders = new Set<string>();
  const seen = new Set<string>();
  for (const a of attempts ?? []) {
    if (seen.has(a.provider_id)) continue;
    seen.add(a.provider_id);
    const s = String(a.status ?? "").toUpperCase();
    if (s.includes("IN_PROGRESS") || s.includes("CALLING") || s.includes("QUEUED") || s.includes("PROPOSED")) {
      inFlightProviders.add(a.provider_id);
    }
  }

  const overdueItems: YearAheadItem[] = [];
  const monthBuckets = new Map<string, YearAheadItem[]>();

  for (const p of providerRows) {
    const cadence = CADENCE_MONTHS[p.provider_type ?? ""] ?? null;
    if (cadence === null) continue; // skip non-annual provider types

    const futureEvent = futureEventByProvider.get(p.id);
    const lastVisit = lastVisitByProvider.get(p.id);

    let status: YearAheadStatus;
    let date: string;
    let detail: string | undefined;

    if (futureEvent) {
      status = "scheduled";
      date = futureEvent;
      detail = `Scheduled with ${p.name}`;
    } else if (inFlightProviders.has(p.id)) {
      status = "in_progress";
      date = now.toISOString();
      detail = "Kate is on it";
    } else if (lastVisit) {
      const due = addMonths(lastVisit, cadence);
      if (due < now) {
        status = "overdue";
        date = due.toISOString();
      } else if (due <= horizon) {
        status = "due";
        date = due.toISOString();
      } else {
        continue; // due past the 12-month window
      }
    } else {
      // Provider on file, never visited — treat as "due now" so it
      // shows up in the current month.
      status = "due";
      date = now.toISOString();
    }

    const title = TYPE_TITLE[p.provider_type ?? ""] ?? `Visit with ${p.name}`;
    const item: YearAheadItem = {
      providerId: p.id,
      providerName: p.name,
      providerType: p.provider_type,
      title,
      status,
      date,
      detail,
    };

    if (status === "overdue") {
      overdueItems.push(item);
    } else {
      const key = monthKey(new Date(date));
      const arr = monthBuckets.get(key) ?? [];
      arr.push(item);
      monthBuckets.set(key, arr);
    }
  }

  // Build the month list — every month from current through +12, even
  // if empty, so the timeline renders as a calendar.
  const months: YearAheadMonth[] = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = monthKey(d);
    months.push({
      key,
      label: monthLabel(d),
      items: monthBuckets.get(key) ?? [],
    });
  }

  // Sort items within each month by date
  for (const m of months) {
    m.items.sort((a, b) => a.date.localeCompare(b.date));
  }

  return { months, overdue: overdueItems };
}
