// Compute a user's readiness score (0-100) from their care state.
// Lifted from the inline math in /api/health-score so the daily
// snapshot cron can call it without going through the HTTP layer.
//
// Source of truth: this function. The /api/health-score route should
// be refactored to call this too — for now, it has its own copy of
// the math (matched line-for-line) and we keep them in sync manually.
// When the score formula changes, update both places.

import { supabaseAdmin } from "../supabase-server";
import { getDashboardProvidersForUser } from "./queries/dashboard";

export async function computeReadinessScore(appUserId: string): Promise<number | null> {
  try {
    const [snapshots, profileRes, calendarRes] = await Promise.all([
      getDashboardProvidersForUser(appUserId),
      supabaseAdmin
        .from("app_users")
        .select("patient_profile, auth_user_id")
        .eq("id", appUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("integrations")
        .select("id")
        .eq("app_user_id", appUserId)
        .eq("provider", "google_calendar")
        .maybeSingle(),
    ]);

    const profile = (profileRes.data?.patient_profile || {}) as Record<string, unknown>;
    const nonPharmacy = snapshots.filter((s) => s.provider.provider_type !== "pharmacy");

    let earned = 0;

    // Provider count (3 per, max 15)
    earned += Math.min(nonPharmacy.length, 5) * 3;

    // Profile completeness (up to ~12, capped 10)
    const hasName = !!(profile.full_name || profileRes.data?.auth_user_id);
    const hasDob = !!profile.date_of_birth;
    const hasInsurance = !!profile.insurance_provider;
    const hasPhone = !!profile.callback_phone;
    earned += Math.min(
      [hasName, hasDob, hasInsurance, hasPhone].filter(Boolean).length * 3,
      10
    );

    // Calendar connected (5)
    if (calendarRes.data) earned += 5;

    // Confirmed providers (3 per, max 15)
    const confirmedCount = nonPharmacy.filter(
      (s) =>
        s.provider.confirmed_status === "confirmed" ||
        s.provider.confirmed_status === "recurring" ||
        s.provider.source === "manual" ||
        s.provider.source === "plaid"
    ).length;
    earned += Math.min(confirmedCount * 3, 15);

    // No more overdue penalty — score never punishes the user for
    // falling behind. "Waiting on a follow-up" is data, not a deficit.
    // Compute the count for the "all caught up" bonus only.
    const overdueCount = nonPharmacy.filter(
      (s) =>
        s.followUpNeeded &&
        s.booking_state?.status !== "BOOKED" &&
        s.booking_state?.status !== "IN_PROGRESS" &&
        s.provider.confirmed_status !== "recurring"
    ).length;

    // Booked bonus (10 per, max 20)
    const bookedCount = nonPharmacy.filter((s) => s.booking_state?.status === "BOOKED").length;
    earned += Math.min(bookedCount * 10, 20);

    // All-caught-up bonus
    if (overdueCount === 0 && nonPharmacy.length > 0) earned += 15;

    // Care recipients (3 per, max 9)
    const careRecipients = (profile.care_recipients as unknown[]) || [];
    earned += Math.min(careRecipients.length * 3, 9);

    // Health history (5)
    if ((profile.health_history as string)?.trim()) earned += 5;

    // Intake completion — every answered question buys readiness points
    // (each one tells Kate something about how to personalize). Cap at
    // 15 so the intake alone can't pin the score; the rest comes from
    // active care management.
    const intake = profile.intake as { answers?: Record<string, unknown>; completed_at?: string | null } | undefined;
    if (intake?.answers) {
      const answered = Object.values(intake.answers).filter((v) => {
        if (v === undefined || v === null) return false;
        if (v === "__skipped__") return false;
        if (typeof v === "string") return v.trim().length > 0;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "object") {
          const av = v as { selection?: unknown[]; notes?: string };
          const hasSelection = Array.isArray(av.selection) && av.selection.length > 0;
          const hasNotes = typeof av.notes === "string" && av.notes.trim().length > 0;
          return hasSelection || hasNotes;
        }
        return false;
      }).length;
      // 1 point per answered question, cap at 15. Completion bonus +3.
      earned += Math.min(answered, 15);
      if (intake.completed_at) earned += 3;
    }

    return Math.max(0, Math.min(100, earned));
  } catch (err) {
    console.error("[health-score] computeReadinessScore failed for", appUserId, err);
    return null;
  }
}

/**
 * Persist today's score for a user. Upserts so re-running the cron the
 * same day overwrites instead of creating a duplicate. Returns true
 * when a snapshot was written.
 */
export async function writeTodaysSnapshot(appUserId: string): Promise<boolean> {
  const score = await computeReadinessScore(appUserId);
  if (score === null) return false;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const { error } = await supabaseAdmin
    .from("health_score_snapshots")
    .upsert(
      { app_user_id: appUserId, score, measured_on: today },
      { onConflict: "app_user_id,measured_on" }
    );
  if (error) {
    console.error("[health-score] snapshot upsert failed for", appUserId, error.message);
    return false;
  }
  return true;
}
