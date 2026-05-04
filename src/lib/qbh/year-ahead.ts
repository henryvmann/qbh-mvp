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
  providerId: string | null;   // null = phantom recommendation, no provider yet
  providerName: string;
  providerType: string | null;
  title: string;             // "Annual physical", "Dental cleaning", etc.
  /** Plain-language WHY for phantom items so users understand the rec. */
  rationale?: string;
  status: YearAheadStatus;
  /** ISO date — when it's due (overdue/due) or when it's scheduled (scheduled). */
  date: string;
  /** Optional booking detail when scheduled. */
  detail?: string;
  /** True for phantom recommendations (no provider yet on the user's care team). */
  isPhantom?: boolean;
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
 *  provider history + future calendar events + in-flight schedule
 *  attempts, PLUS phantom recommendations based on USPSTF-style
 *  preventive-care guidelines (annual physical, dental cleaning,
 *  age- and sex-based screenings — colonoscopy at 45, mammogram at
 *  40, OB/GYN annual, skin check at 40, etc.) for gaps in the
 *  user's existing care team. */
export async function buildYearAhead(appUserId: string): Promise<{
  months: YearAheadMonth[];
  overdue: YearAheadItem[];
}> {
  const now = new Date();
  const horizon = addMonths(now.toISOString(), 12);

  // Patient profile drives phantom-recommendation logic — age + sex
  // determine which preventive screenings apply.
  const { data: appUserRow } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .maybeSingle();
  const profile = (appUserRow?.patient_profile ?? {}) as Record<string, unknown>;
  const dob = typeof profile.date_of_birth === "string" ? profile.date_of_birth : null;
  const sex = typeof profile.gender === "string"
    ? (profile.gender as string).toLowerCase()
    : typeof profile.sex === "string"
    ? (profile.sex as string).toLowerCase()
    : null;
  const age = dob ? Math.floor((now.getTime() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  // Active providers
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, name, provider_type")
    .eq("app_user_id", appUserId)
    .eq("status", "active");
  const providerRows = providers ?? [];
  const providerIds = providerRows.map((p) => p.id);

  // If no providers AND no profile data, nothing to show.
  if (providerIds.length === 0 && !dob && !sex) {
    return { months: [], overdue: [] };
  }

  // Latest visit per provider
  const lastVisitByProvider = new Map<string, string>();
  const futureEventByProvider = new Map<string, string>();
  const inFlightProviders = new Set<string>();
  if (providerIds.length > 0) {
    const { data: visits } = await supabaseAdmin
      .from("provider_visits")
      .select("provider_id, visit_date")
      .eq("app_user_id", appUserId)
      .in("provider_id", providerIds)
      .order("visit_date", { ascending: false });
    for (const v of visits ?? []) {
      if (v.visit_date && !lastVisitByProvider.has(v.provider_id)) {
        lastVisitByProvider.set(v.provider_id, v.visit_date);
      }
    }

    const { data: events } = await supabaseAdmin
      .from("calendar_events")
      .select("provider_id, start_at")
      .eq("app_user_id", appUserId)
      .in("provider_id", providerIds)
      .eq("status", "confirmed")
      .gte("start_at", now.toISOString())
      .order("start_at", { ascending: true });
    for (const e of events ?? []) {
      if (!futureEventByProvider.has(e.provider_id)) {
        futureEventByProvider.set(e.provider_id, e.start_at);
      }
    }

    const { data: attempts } = await supabaseAdmin
      .from("schedule_attempts")
      .select("provider_id, status, created_at")
      .eq("app_user_id", appUserId)
      .in("provider_id", providerIds)
      .order("created_at", { ascending: false });
    const seen = new Set<string>();
    for (const a of attempts ?? []) {
      if (seen.has(a.provider_id)) continue;
      seen.add(a.provider_id);
      const s = String(a.status ?? "").toUpperCase();
      if (s.includes("IN_PROGRESS") || s.includes("CALLING") || s.includes("QUEUED") || s.includes("PROPOSED")) {
        inFlightProviders.add(a.provider_id);
      }
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

  // ── Phantom recommendations ──
  // Surface preventive-care items the user *should* have on their
  // schedule even when there's no provider on file yet. Based on
  // USPSTF + AAFP/ACP guidance for adults. Each phantom item gets
  // a rationale ("recommended annually for adults"), placed in a
  // month within the next 12 weeks so it shows up early and the
  // user can act on it.
  const existingTypes = new Set(
    providerRows.map((p) => (p.provider_type ?? "").toLowerCase())
  );
  const isFemale = sex === "female" || sex === "f";
  const isMale = sex === "male" || sex === "m";

  type PhantomDef = {
    type: string;
    title: string;
    rationale: string;
    appliesIf: () => boolean;
    monthOffset: number; // months from now to slot the rec
  };

  const phantomDefs: PhantomDef[] = [
    {
      type: "doctor",
      title: "Annual physical",
      rationale: "Adults should have a wellness visit with a primary care doctor every year — covers blood pressure, weight, screenings, and any concerns.",
      appliesIf: () => !existingTypes.has("doctor"),
      monthOffset: 1,
    },
    {
      type: "dentist",
      title: "Dental cleaning",
      rationale: "Dentists recommend a cleaning + exam every 6 months for most adults.",
      appliesIf: () => !existingTypes.has("dentist"),
      monthOffset: 1,
    },
    {
      type: "vision",
      title: "Eye exam",
      rationale: age != null && age >= 40
        ? "Annual eye exam recommended for adults 40+ (earlier if you wear corrective lenses)."
        : "Eye exam every 1–2 years for healthy adults.",
      appliesIf: () => !existingTypes.has("vision") && !existingTypes.has("optometrist") && !existingTypes.has("ophthalmologist"),
      monthOffset: 2,
    },
    {
      type: "specialist",
      title: "Skin check",
      rationale: "Annual full-body skin check recommended starting at 40, earlier if you have risk factors (fair skin, family history of melanoma, lots of sun exposure).",
      appliesIf: () => age != null && age >= 40 && !existingTypes.has("specialist"),
      monthOffset: 3,
    },
    {
      type: "specialist",
      title: "OB/GYN annual visit",
      rationale: "Annual visit recommended for women 21+. Covers cervical screening, breast exam, and reproductive health.",
      appliesIf: () => isFemale && age != null && age >= 21 && !existingTypes.has("specialist"),
      monthOffset: 2,
    },
    {
      type: "imaging",
      title: "Mammogram",
      rationale: age != null && age >= 50
        ? "Mammogram every 1–2 years recommended for women 50–74."
        : "Mammogram screening starts between 40 and 50 depending on personal risk — talk to your OB/GYN about timing.",
      appliesIf: () => isFemale && age != null && age >= 40 && !existingTypes.has("imaging"),
      monthOffset: 4,
    },
    {
      type: "specialist",
      title: "Colonoscopy",
      rationale: "Colorectal cancer screening recommended starting at 45. Most adults need a colonoscopy every 10 years if results are normal.",
      appliesIf: () => age != null && age >= 45 && !existingTypes.has("specialist"),
      monthOffset: 5,
    },
    {
      type: "lab",
      title: "Lipid panel + metabolic blood work",
      rationale: "Cholesterol screening every 4–6 years for most adults; more often if you're 40+ or have risk factors.",
      appliesIf: () => age != null && age >= 20 && !existingTypes.has("lab"),
      monthOffset: 1,
    },
    {
      type: "lab",
      title: "Diabetes screening (A1C)",
      rationale: "Recommended every 3 years starting at 35, sooner with risk factors like family history or BMI ≥25.",
      appliesIf: () => age != null && age >= 35 && !existingTypes.has("lab"),
      monthOffset: 3,
    },
    {
      type: "imaging",
      title: "Bone density (DEXA) scan",
      rationale: "Recommended for women 65+ and men 70+ (earlier with risk factors). Detects osteoporosis before it leads to fractures.",
      appliesIf: () => age != null && ((isFemale && age >= 65) || (isMale && age >= 70)),
      monthOffset: 6,
    },
    {
      type: "doctor",
      title: "Flu shot",
      rationale: "Annual flu vaccination recommended for everyone 6 months and older. Best timing: September through October.",
      appliesIf: () => {
        // Only surface in late summer / fall
        const m = now.getMonth();
        return m >= 6 && m <= 10; // July–November
      },
      monthOffset: 1,
    },
    {
      type: "doctor",
      title: "Shingles vaccine (Shingrix)",
      rationale: "Two-dose Shingrix series recommended for adults 50+ to prevent shingles and post-herpetic neuralgia.",
      appliesIf: () => age != null && age >= 50,
      monthOffset: 4,
    },
  ];

  for (const def of phantomDefs) {
    if (!def.appliesIf()) continue;
    const target = new Date(now.getFullYear(), now.getMonth() + def.monthOffset, 15);
    const item: YearAheadItem = {
      providerId: null,
      providerName: "Find a provider",
      providerType: def.type,
      title: def.title,
      rationale: def.rationale,
      status: "due",
      date: target.toISOString(),
      isPhantom: true,
    };
    const key = monthKey(target);
    const arr = monthBuckets.get(key) ?? [];
    arr.push(item);
    monthBuckets.set(key, arr);
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
