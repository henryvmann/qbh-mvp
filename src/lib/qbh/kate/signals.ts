// Signals layer — pure DB facts about a user's current state.
//
// No LLM. No copy generation. Everything here is verifiable: given an
// app_user_id and a snapshot of the DB, we should produce the same
// KateFacts object every time.

import { supabaseAdmin } from "../../supabase-server";
import type { KateFacts } from "./types";

const OVERDUE_MONTHS = 11; // Provider with no visit in 11+ months → overdue
const UPCOMING_DAYS = 14; // Show appointments confirmed in the next 14 days
const COMPLETION_LOOKBACK_DAYS = 7; // Recent-completion celebratory window
const FAILED_LOOKBACK_DAYS = 14; // How recent a failed attempt has to be

export async function gatherKateFacts(appUserId: string): Promise<KateFacts> {
  const now = new Date();

  // ── 1. Provider list (active only) ───────────────────────────────
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, name, status, provider_type, created_at")
    .eq("app_user_id", appUserId)
    .eq("status", "active");

  const realProviders = (providers ?? []).filter(
    (p) => p.provider_type !== "pharmacy" && p.provider_type !== "calendar"
  );
  const activeProviderCount = realProviders.length;

  // ── 2. Latest visit per provider, derive overdue ─────────────────
  const providerIds = realProviders.map((p) => p.id);
  let lastVisitByProvider = new Map<string, string>();
  if (providerIds.length > 0) {
    const { data: visits } = await supabaseAdmin
      .from("provider_visits")
      .select("provider_id, visit_date")
      .in("provider_id", providerIds)
      .eq("app_user_id", appUserId)
      .order("visit_date", { ascending: false });

    for (const v of visits ?? []) {
      // Map keeps the first (most recent) since we ordered desc.
      if (!lastVisitByProvider.has(v.provider_id)) {
        lastVisitByProvider.set(v.provider_id, v.visit_date);
      }
    }
  }

  const overdueFollowUps: KateFacts["overdueFollowUps"] = [];
  for (const p of realProviders) {
    const lastVisit = lastVisitByProvider.get(p.id);
    const months = lastVisit ? monthsBetween(lastVisit, now) : null;
    // We only flag overdue when we have evidence of a prior visit AND
    // it's older than threshold. Providers with NO visit data go
    // unflagged here — they're caught by a separate "new provider,
    // never seen" signal in a future iteration.
    if (months !== null && months >= OVERDUE_MONTHS) {
      overdueFollowUps.push({
        provider_id: p.id,
        name: p.name,
        monthsSinceVisit: months,
        lastVisitDate: lastVisit ?? null,
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

  // ── 7. Score + delta (best-effort) ───────────────────────────────
  // We pull from the same source as /api/health-score. Delta requires
  // historical snapshots we don't currently store, so it's null until
  // we add a `health_score_snapshots` table.
  const score = await fetchScore(appUserId);
  const scoreDelta = null;

  // ── 8. Last Kate message (continuity) ────────────────────────────
  // Phase 1: we don't have a kate_messages table yet, so leave null.
  // Phase 2 of the inference layer will add persistence + dedup.
  const lastKateMessage = null;

  return {
    appUserId,
    daysSinceSignup,
    activeProviderCount,
    overdueFollowUps,
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

function monthsBetween(isoDate: string, now: Date): number {
  const d = new Date(isoDate);
  const ms = now.getTime() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44));
}

async function fetchScore(appUserId: string): Promise<number | null> {
  // The health-score endpoint is internal; we read the same provider /
  // visit data directly for now and compute a rough proxy. When the
  // canonical score moves to a stored column we'll switch to that.
  // For Phase 1, just return null when we can't compute confidently.
  // Reading via a self-fetch is brittle (no internal token), so skip.
  void appUserId;
  return null;
}
