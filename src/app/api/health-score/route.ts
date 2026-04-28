export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { getDashboardProvidersForUser } from "../../../lib/qbh/queries/dashboard";

type ScoreBreakdown = {
  score: number;
  maxScore: number;
  factors: Array<{ label: string; points: number; earned: boolean }>;
  level: "getting-started" | "building" | "on-track" | "excellent";
  levelLabel: string;
};

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all data in parallel
    const [snapshots, profileRes, calendarRes, docsRes] = await Promise.all([
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
      supabaseAdmin
        .from("provider_visits")
        .select("id")
        .eq("app_user_id", appUserId)
        .eq("source", "document")
        .limit(1),
    ]);

    const profile = (profileRes.data?.patient_profile || {}) as Record<string, unknown>;
    const nonPharmacy = snapshots.filter((s) => s.provider.provider_type !== "pharmacy");

    const factors: ScoreBreakdown["factors"] = [];
    let earned = 0;

    // Provider count (up to 15 points: 3 per provider, max 5)
    const providerCount = Math.min(nonPharmacy.length, 5);
    const providerPoints = providerCount * 3;
    factors.push({ label: `${nonPharmacy.length} provider${nonPharmacy.length !== 1 ? "s" : ""} added`, points: providerPoints, earned: providerPoints > 0 });
    earned += providerPoints;

    // Profile completeness (up to 10 points)
    const hasName = !!(profile.full_name || profileRes.data?.auth_user_id);
    const hasDob = !!profile.date_of_birth;
    const hasInsurance = !!profile.insurance_provider;
    const hasPhone = !!profile.callback_phone;
    const profileComplete = [hasName, hasDob, hasInsurance, hasPhone].filter(Boolean).length;
    const profilePoints = Math.min(profileComplete * 3, 10);
    factors.push({ label: "Profile complete", points: profilePoints, earned: profilePoints >= 9 });
    earned += profilePoints;

    // Calendar connected (5 points)
    const calConnected = !!calendarRes.data;
    factors.push({ label: "Calendar connected", points: calConnected ? 5 : 0, earned: calConnected });
    if (calConnected) earned += 5;

    // Confirmed providers — not "Tracked" (3 per confirmed, max 15)
    const confirmedCount = nonPharmacy.filter((s) =>
      s.provider.confirmed_status === "confirmed" ||
      s.provider.confirmed_status === "recurring" ||
      s.provider.source === "manual" ||
      s.provider.source === "plaid"
    ).length;
    const confirmedPoints = Math.min(confirmedCount * 3, 15);
    factors.push({ label: `${confirmedCount} provider${confirmedCount !== 1 ? "s" : ""} confirmed`, points: confirmedPoints, earned: confirmedPoints > 0 });
    earned += confirmedPoints;

    // Overdue penalty (-5 per overdue provider)
    const overdueCount = nonPharmacy.filter((s) =>
      s.followUpNeeded &&
      s.booking_state?.status !== "BOOKED" &&
      s.booking_state?.status !== "IN_PROGRESS" &&
      s.provider.confirmed_status !== "recurring"
    ).length;
    const overduePenalty = overdueCount * -5;
    if (overdueCount > 0) {
      factors.push({ label: `${overdueCount} provider${overdueCount !== 1 ? "s" : ""} overdue`, points: overduePenalty, earned: false });
      earned += overduePenalty;
    }

    // Booked appointments bonus (10 per booked, max 20)
    const bookedCount = nonPharmacy.filter((s) => s.booking_state?.status === "BOOKED").length;
    const bookedPoints = Math.min(bookedCount * 10, 20);
    if (bookedCount > 0) {
      factors.push({ label: `${bookedCount} appointment${bookedCount !== 1 ? "s" : ""} booked`, points: bookedPoints, earned: true });
      earned += bookedPoints;
    }

    // Zero overdue bonus (15 points)
    const zeroOverdue = overdueCount === 0 && nonPharmacy.length > 0;
    if (zeroOverdue) {
      factors.push({ label: "All providers on track", points: 15, earned: true });
      earned += 15;
    }

    // Care recipients (3 per, max 9)
    const careRecipients = (profile.care_recipients as unknown[]) || [];
    const recipientPoints = Math.min(careRecipients.length * 3, 9);
    if (recipientPoints > 0) {
      factors.push({ label: `${careRecipients.length} care recipient${careRecipients.length !== 1 ? "s" : ""}`, points: recipientPoints, earned: true });
      earned += recipientPoints;
    }

    // Health history / documents (5 points)
    const hasHistory = !!(profile.health_history as string)?.trim();
    factors.push({ label: "Health history added", points: hasHistory ? 5 : 0, earned: hasHistory });
    if (hasHistory) earned += 5;

    // Clamp to 0-100
    const score = Math.max(0, Math.min(100, earned));

    // Determine level
    let level: ScoreBreakdown["level"];
    let levelLabel: string;
    if (score >= 85) { level = "excellent"; levelLabel = "Excellent"; }
    else if (score >= 60) { level = "on-track"; levelLabel = "On Track"; }
    else if (score >= 30) { level = "building"; levelLabel = "Building"; }
    else { level = "getting-started"; levelLabel = "Getting Started"; }

    return NextResponse.json({
      ok: true,
      score,
      maxScore: 100,
      level,
      levelLabel,
      factors: factors.filter((f) => f.points !== 0),
    });
  } catch (err) {
    console.error("[health-score] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to compute score" }, { status: 500 });
  }
}
