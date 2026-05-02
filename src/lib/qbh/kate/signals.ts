// Signals layer — pure DB facts about a user's current state.
//
// No LLM. No copy generation. Everything here is verifiable: given an
// app_user_id and a snapshot of the DB, we should produce the same
// KateFacts object every time.

import { supabaseAdmin } from "../../supabase-server";
import type { KateFacts } from "./types";

const UPCOMING_DAYS = 14; // Show appointments confirmed in the next 14 days
const COMPLETION_LOOKBACK_DAYS = 7; // Recent-completion celebratory window
const FAILED_LOOKBACK_DAYS = 14; // How recent a failed attempt has to be

/**
 * Specialty-aware overdue thresholds.
 *
 * "Overdue" means different things by specialty: a 6-month gap to a
 * dentist is a missed cleaning; a 6-month gap to a cardiologist with
 * an annual follow-up cadence is fine. We map provider_type → months
 * past last visit before Kate flags it. Defaults assume conservative
 * primary-care cadence (12 months) when type is unknown.
 *
 * If a user's actual visit cadence is shorter than the threshold (e.g.
 * they see their dermatologist every 4 months), we use cadence + 1
 * month as the personalized threshold instead of the default. This
 * way Kate respects "your" rhythm before falling back to ours.
 */
const OVERDUE_MONTHS_BY_TYPE: Record<string, number> = {
  dental: 6,
  dentist: 6,
  vision: 12,
  ophthalmology: 12,
  optometry: 12,
  dermatology: 12,
  derma: 12,
  primary_care: 12,
  internal_medicine: 12,
  family_medicine: 12,
  pediatric: 12,
  pediatrics: 12,
  obgyn: 12,
  gynecology: 12,
  cardiology: 12,
  neurology: 12,
  orthopedic: 12,
  orthopedics: 12,
  urology: 12,
  ent: 12,
  endocrinology: 12,
  rheumatology: 12,
  // Mental-health cadence is typically much shorter; overdue at 6 weeks.
  mental_health: 1.5,
  psychiatry: 1.5,
  psychology: 1.5,
  therapist: 1.5,
  // Specialist (catchall) — annual is the default expectation
  specialist: 12,
  doctor: 12,
};

const DEFAULT_OVERDUE_MONTHS = 12;

function overdueThresholdMonths(
  providerType: string | null,
  observedCadenceMonths: number | null
): number {
  const typeKey = (providerType || "").toLowerCase().trim();
  const fromType = OVERDUE_MONTHS_BY_TYPE[typeKey] ?? DEFAULT_OVERDUE_MONTHS;
  // Personalized: if the user's actual cadence is meaningfully shorter
  // than the type default, use cadence + 1 month buffer instead.
  if (observedCadenceMonths !== null && observedCadenceMonths > 0) {
    const personalized = observedCadenceMonths + 1;
    if (personalized < fromType) return personalized;
  }
  return fromType;
}

/**
 * Gather raw care-state facts for a user. Each section is wrapped in
 * tolerate() so a single failed query produces an empty signal rather
 * than tanking the whole Kate-state call. Kate going quiet is always
 * a safer failure mode than the API 500ing.
 */
export async function gatherKateFacts(appUserId: string): Promise<KateFacts> {
  const now = new Date();

  // ── 1. Provider list (active only, with junk filter) ────────────
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, name, status, provider_type, created_at")
    .eq("app_user_id", appUserId)
    .eq("status", "active");

  const realProviders = (providers ?? []).filter(isRealCareProvider);
  const activeProviderCount = realProviders.length;

  // ── 2. Visit history per provider → overdue + cadence ───────────
  const providerIds = realProviders.map((p) => p.id);
  const visitsByProvider = new Map<string, string[]>();
  if (providerIds.length > 0) {
    const { data: visits } = await supabaseAdmin
      .from("provider_visits")
      .select("provider_id, visit_date")
      .in("provider_id", providerIds)
      .eq("app_user_id", appUserId)
      .order("visit_date", { ascending: false });

    for (const v of visits ?? []) {
      const list = visitsByProvider.get(v.provider_id) ?? [];
      list.push(v.visit_date);
      visitsByProvider.set(v.provider_id, list);
    }
  }

  const overdueFollowUps: KateFacts["overdueFollowUps"] = [];
  for (const p of realProviders) {
    const dates = visitsByProvider.get(p.id) ?? [];
    if (dates.length === 0) continue; // No history → can't compute overdue
    const lastVisit = dates[0]; // Already sorted desc
    const months = monthsBetween(lastVisit, now);
    const cadence = computeCadenceMonths(dates);
    const threshold = overdueThresholdMonths(p.provider_type, cadence);
    if (months >= threshold) {
      overdueFollowUps.push({
        provider_id: p.id,
        name: p.name,
        monthsSinceVisit: months,
        lastVisitDate: lastVisit,
      });
    }
  }

  // ── 3. Upcoming confirmed appointments ───────────────────────────
  const upcomingCutoff = new Date(now.getTime());
  upcomingCutoff.setDate(upcomingCutoff.getDate() + UPCOMING_DAYS);

  const { data: events } = await supabaseAdmin
    .from("calendar_events")
    .select("id, provider_id, start_at, end_at, status")
    .eq("app_user_id", appUserId)
    .gte("start_at", now.toISOString())
    .lte("start_at", upcomingCutoff.toISOString())
    .order("start_at", { ascending: true });

  const providerNameById = new Map(realProviders.map((p) => [p.id, p.name]));
  const upcomingAppointments: KateFacts["upcomingAppointments"] = [];
  for (const e of events ?? []) {
    if (e.status && String(e.status).toUpperCase() === "CANCELLED") continue;
    const providerName = e.provider_id
      ? providerNameById.get(e.provider_id) ?? "Upcoming visit"
      : "Upcoming visit";
    upcomingAppointments.push({
      provider_name: providerName,
      starts_at: e.start_at,
      calendar_event_id: e.id,
      schedule_attempt_id: null,
    });
  }

  // ── 4. In-flight + recently-failed schedule attempts ─────────────
  const { data: attempts } = await supabaseAdmin
    .from("schedule_attempts")
    .select("id, provider_id, status, created_at, updated_at")
    .eq("app_user_id", appUserId)
    .order("updated_at", { ascending: false })
    .limit(40);

  const inFlightAttempts: KateFacts["inFlightAttempts"] = [];
  const failedAttempts: KateFacts["failedAttempts"] = [];
  const failedCutoff = new Date(now.getTime());
  failedCutoff.setDate(failedCutoff.getDate() - FAILED_LOOKBACK_DAYS);

  for (const a of attempts ?? []) {
    const status = String(a.status || "").toUpperCase();
    const providerName = a.provider_id
      ? providerNameById.get(a.provider_id) ?? "Scheduling attempt"
      : "Scheduling attempt";
    if (["CREATED", "IN_PROGRESS", "PENDING"].includes(status)) {
      inFlightAttempts.push({
        schedule_attempt_id: Number(a.id),
        provider_name: providerName,
        started_at: a.created_at,
      });
    } else if (status === "FAILED" && new Date(a.updated_at) >= failedCutoff) {
      failedAttempts.push({
        schedule_attempt_id: Number(a.id),
        provider_name: providerName,
        failed_at: a.updated_at,
      });
    }
  }

  // ── 4.5. Newly added providers with no visits / nothing in motion ──
  // If a user just added Dr. Smith and hasn't booked anything yet, Kate
  // should notice and offer to handle the first appointment. Without
  // this, the rule layer goes quiet on a user who just signaled exactly
  // what they want help with. Filter out providers that already have
  // upcoming appointments or in-flight booking attempts to avoid
  // double-surfacing.
  const NEW_PROVIDER_DAYS = 30;
  const upcomingProviderIds = new Set(
    upcomingAppointments
      .map((u) => realProviders.find((p) => p.name === u.provider_name)?.id)
      .filter(Boolean) as string[]
  );
  const inFlightProviderIds = new Set(
    inFlightAttempts
      .map((a) => realProviders.find((p) => p.name === a.provider_name)?.id)
      .filter(Boolean) as string[]
  );

  const newProvidersNeverSeen: KateFacts["newProvidersNeverSeen"] = [];
  for (const p of realProviders) {
    if (visitsByProvider.has(p.id)) continue; // Has visit history → overdue path
    if (upcomingProviderIds.has(p.id)) continue; // Already booked
    if (inFlightProviderIds.has(p.id)) continue; // Booking in progress
    const addedAt = new Date(p.created_at);
    const daysAgo = Math.floor((now.getTime() - addedAt.getTime()) / 86400000);
    if (daysAgo > NEW_PROVIDER_DAYS) continue;
    newProvidersNeverSeen.push({
      provider_id: p.id,
      name: p.name,
      addedDaysAgo: daysAgo,
    });
  }

  // ── 5. Recent completions (celebratory) ──────────────────────────
  const completionCutoff = new Date(now.getTime());
  completionCutoff.setDate(completionCutoff.getDate() - COMPLETION_LOOKBACK_DAYS);
  const recentCompletions: KateFacts["recentCompletions"] = [];
  for (const a of attempts ?? []) {
    const status = String(a.status || "").toUpperCase();
    if (
      (status === "CONFIRMED" || status === "BOOKED" || status === "COMPLETED") &&
      new Date(a.updated_at) >= completionCutoff
    ) {
      const providerName = a.provider_id
        ? providerNameById.get(a.provider_id) ?? "Recent booking"
        : "Recent booking";
      recentCompletions.push({
        provider_name: providerName,
        booked_at: a.updated_at,
      });
    }
  }

  // ── 6. Days since signup (for confidence scaling) ────────────────
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("created_at")
    .eq("id", appUserId)
    .maybeSingle();
  const daysSinceSignup = appUser?.created_at
    ? Math.max(0, Math.floor((now.getTime() - new Date(appUser.created_at).getTime()) / 86400000))
    : 0;

  // ── 7. Score + delta — best-effort from health_score_snapshots ──
  // Both null when the snapshot table is empty / not yet migrated;
  // signals returns honest "I don't know" instead of fabricating.
  const [score, scoreDelta] = await Promise.all([
    fetchScore(appUserId),
    fetchScoreDelta(appUserId),
  ]);

  // ── 8. Last Kate message (continuity) ────────────────────────────
  // Phase 1: we don't have a kate_messages table yet, so leave null.
  // Phase 2 of the inference layer will add persistence + dedup.
  const lastKateMessage = null;

  return {
    appUserId,
    daysSinceSignup,
    activeProviderCount,
    overdueFollowUps,
    newProvidersNeverSeen,
    upcomingAppointments,
    inFlightAttempts,
    failedAttempts,
    recentCompletions,
    lastKateMessage,
    score,
    scoreDelta,
  };
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Junk-provider filter — keeps Kate from looking dumb when the
 * discovery classifier leaks pharmacies, insurance companies, billing
 * platforms, or other non-clinical merchants into the providers table.
 *
 * Phase 1 is auto-derived: provider_type denylist + name-pattern
 * matching against known platforms / insurers / pharmacy chains. We
 * intentionally err on the side of EXCLUDING — Kate going quiet on a
 * legitimate provider is recoverable (user can poke her), but Kate
 * surfacing "you're due for a follow-up with Lemonade Insurance"
 * destroys trust on first impression.
 */
const NON_CLINICAL_PROVIDER_TYPES = new Set([
  "pharmacy",
  "calendar",
  "insurance",
  "platform",
  "billing",
]);

const NON_CLINICAL_NAME_PATTERNS = [
  // Pharmacy chains the classifier sometimes labels as "active"
  /\bcvs\b/i, /\bwalgreens?\b/i, /\brite\s*aid\b/i, /\bduane\s*reade\b/i,
  /\bweston\s*pharmacy\b/i, /\bpharmacy\b/i, /\bdrug\s*store\b/i,
  // Insurance carriers
  /\binsurance\b/i, /\bgeico\b/i, /\bstate\s*farm\b/i, /\ballstate\b/i,
  /\bprogressive\b/i, /\blemonade\b/i, /\baetna\b/i, /\bcigna\b/i,
  /\banthem\b/i, /\bblue\s*cross\b/i, /\bbcbs\b/i, /\bunited\s*health/i,
  /\bhumana\b/i, /\bmetlife\b/i, /\bguardian\b/i, /\bprudential\b/i,
  /\bwilliam\s*penn\b/i,
  // Billing / EHR / booking platforms
  /\bsimplepractice\b/i, /\btherapynotes\b/i, /\bheadway\b/i, /\bzocdoc\b/i,
  /\bhealthgrades\b/i, /\balma\b/i, /\bbetterhelp\b/i, /\btalkspace\b/i,
  /\bgrow\s*therapy\b/i, /\bspring\s*health\b/i, /\blyra\s*health\b/i,
  /\bmodern\s*health\b/i, /\bpsychology\s*today\b/i,
  // Wellness products / supplements (not providers)
  /\bdesigns\s*for\s*health\b/i, /\bnoom\b/i, /\bweight\s*watchers\b/i,
  // Gyms / fitness with health-y names
  /\bhealth\s*club\b/i, /\bfitness\s*club\b/i, /\bequinox\b/i, /\bsoulcycle\b/i,
];

function isRealCareProvider(p: {
  name: string;
  provider_type: string | null;
}): boolean {
  if (p.provider_type && NON_CLINICAL_PROVIDER_TYPES.has(p.provider_type)) {
    return false;
  }
  const name = (p.name || "").trim();
  if (!name) return false;
  for (const re of NON_CLINICAL_NAME_PATTERNS) {
    if (re.test(name)) return false;
  }
  return true;
}

function monthsBetween(isoDate: string, now: Date): number {
  const d = new Date(isoDate);
  const ms = now.getTime() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44));
}

/**
 * Compute the user's typical visit cadence to a provider in months,
 * based on the median gap between consecutive visits. Returns null
 * when there's not enough data (need ≥3 visits to call something a
 * "cadence" rather than a coincidence).
 */
function computeCadenceMonths(datesDesc: string[]): number | null {
  if (datesDesc.length < 3) return null;
  const gaps: number[] = [];
  for (let i = 0; i < datesDesc.length - 1; i++) {
    const newer = new Date(datesDesc[i]).getTime();
    const older = new Date(datesDesc[i + 1]).getTime();
    const months = (newer - older) / (1000 * 60 * 60 * 24 * 30.44);
    if (months > 0) gaps.push(months);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];
}

async function fetchScore(appUserId: string): Promise<number | null> {
  // Latest score snapshot. Cron / score-write code is responsible
  // for inserting daily rows into health_score_snapshots; we just read.
  const { data, error } = await supabaseAdmin
    .from("health_score_snapshots")
    .select("score")
    .eq("app_user_id", appUserId)
    .order("measured_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return Number(data.score);
}

async function fetchScoreDelta(appUserId: string): Promise<number | null> {
  // Compare today's score to the closest snapshot 6-8 days ago.
  // If we don't have a snapshot in that window, return null rather
  // than fabricate the delta.
  const { data: latest } = await supabaseAdmin
    .from("health_score_snapshots")
    .select("score, measured_on")
    .eq("app_user_id", appUserId)
    .order("measured_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return null;

  const targetEarlier = new Date(latest.measured_on);
  targetEarlier.setDate(targetEarlier.getDate() - 7);
  const earlierStart = new Date(targetEarlier);
  earlierStart.setDate(earlierStart.getDate() - 1);
  const earlierEnd = new Date(targetEarlier);
  earlierEnd.setDate(earlierEnd.getDate() + 1);

  const { data: earlier } = await supabaseAdmin
    .from("health_score_snapshots")
    .select("score")
    .eq("app_user_id", appUserId)
    .gte("measured_on", earlierStart.toISOString().slice(0, 10))
    .lte("measured_on", earlierEnd.toISOString().slice(0, 10))
    .order("measured_on", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!earlier) return null;
  return Math.round(Number(latest.score) - Number(earlier.score));
}
