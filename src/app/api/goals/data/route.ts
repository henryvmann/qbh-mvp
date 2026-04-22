export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

type GoalCategory = "overdue" | "preventive" | "medications" | "upcoming" | "setup";

type Goal = {
  id: string;
  title: string;
  category: GoalCategory;
  progress: number;
  detail: string;
  providerName?: string;
  providerId?: string;
};

type UserGoal = {
  id: string;
  title: string;
  progress: number;
};

const PHARMACY_KEYWORDS = ["cvs", "walgreens", "rite aid", "pharmacy"];
const DENTAL_KEYWORDS = ["dental", "dentist"];
const EYE_KEYWORDS = ["eye", "vision", "optical", "optometrist", "ophthalmolog"];

function nameMatches(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);

  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const goals: Goal[] = [];
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // --- Fetch all data ---

  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, name")
    .eq("app_user_id", appUserId)
    .eq("status", "active");

  const providerRows = providers ?? [];
  const providerIds = providerRows.map((p) => p.id);

  // Latest visit per provider
  const visitsByProvider = new Map<string, string>();
  if (providerIds.length > 0) {
    const { data: visits } = await supabaseAdmin
      .from("provider_visits")
      .select("provider_id, visit_date")
      .eq("app_user_id", appUserId)
      .in("provider_id", providerIds)
      .order("visit_date", { ascending: false });

    for (const v of visits ?? []) {
      if (v.visit_date && !visitsByProvider.has(v.provider_id)) {
        visitsByProvider.set(v.provider_id, v.visit_date);
      }
    }
  }

  // Schedule attempts
  const latestAttemptByProvider = new Map<
    string,
    { id: number; status: string; metadata?: unknown }
  >();
  if (providerIds.length > 0) {
    const { data: attempts } = await supabaseAdmin
      .from("schedule_attempts")
      .select("id,provider_id,status,created_at,metadata")
      .eq("app_user_id", appUserId)
      .in("provider_id", providerIds)
      .order("created_at", { ascending: false });

    for (const row of attempts ?? []) {
      if (!latestAttemptByProvider.has(row.provider_id)) {
        latestAttemptByProvider.set(row.provider_id, {
          id: Number(row.id),
          status: row.status,
          metadata: row.metadata ?? null,
        });
      }
    }
  }

  // Future confirmed calendar events
  const futureConfirmedProviderIds = new Set<string>();
  if (providerIds.length > 0) {
    const nowIso = now.toISOString();
    const { data: events } = await supabaseAdmin
      .from("calendar_events")
      .select("provider_id,start_at")
      .eq("app_user_id", appUserId)
      .in("provider_id", providerIds)
      .eq("status", "confirmed")
      .gte("start_at", nowIso);

    for (const e of events ?? []) {
      futureConfirmedProviderIds.add(e.provider_id);
    }
  }

  // Calendar integration
  const { data: calIntegration } = await supabaseAdmin
    .from("integrations")
    .select("id")
    .eq("app_user_id", appUserId)
    .eq("integration_type", "calendar")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  // Patient profile
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .maybeSingle();

  const patientProfile =
    appUser?.patient_profile && typeof appUser.patient_profile === "object"
      ? (appUser.patient_profile as Record<string, unknown>)
      : {};

  // Check dismissed provider types ("I don't have one")
  const dismissedTypes = Array.isArray(patientProfile.dismissed_provider_types)
    ? (patientProfile.dismissed_provider_types as string[])
    : [];

  // --- Generate goals ---

  let hasDental = false;
  let hasEye = false;

  for (const p of providerRows) {
    const isPharmacy = nameMatches(p.name, PHARMACY_KEYWORDS);
    const isDental = nameMatches(p.name, DENTAL_KEYWORDS);
    const isEye = nameMatches(p.name, EYE_KEYWORDS);

    if (isDental) hasDental = true;
    if (isEye) hasEye = true;

    const lastVisit = visitsByProvider.get(p.id);
    const lastVisitDate = lastVisit ? new Date(lastVisit) : null;
    const hasFutureEvent = futureConfirmedProviderIds.has(p.id);
    const attempt = latestAttemptByProvider.get(p.id);

    // Rule 2: Pharmacy refill check
    if (isPharmacy) {
      if (!lastVisitDate || lastVisitDate < threeMonthsAgo) {
        goals.push({
          id: `refill-${p.id}`,
          title: `Refill check at ${p.name}`,
          category: "medications",
          progress: 0,
          detail: lastVisitDate
            ? `Last visit: ${lastVisitDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
            : "No recent pharmacy visits on record",
          providerName: p.name,
          providerId: p.id,
        });
      }
      continue; // Don't generate overdue goals for pharmacies
    }

    // Rule 7: Booked appointments — upcoming goals
    if (attempt && /BOOKED/i.test(attempt.status)) {
      const meta =
        attempt.metadata && typeof attempt.metadata === "object"
          ? (attempt.metadata as Record<string, unknown>)
          : null;
      const bookingSummary =
        meta?.booking_summary && typeof meta.booking_summary === "object"
          ? (meta.booking_summary as Record<string, unknown>)
          : null;
      const displayTime =
        typeof bookingSummary?.display_time === "string"
          ? bookingSummary.display_time
          : "";

      goals.push({
        id: `attend-${p.id}`,
        title: `Attend appointment with ${p.name}`,
        category: "upcoming",
        progress: 100,
        detail: displayTime
          ? `Scheduled for ${displayTime}`
          : "Appointment confirmed — just need to go",
        providerName: p.name,
        providerId: p.id,
      });
      continue;
    }

    // Rule 1: Overdue providers (>6 months, no future event)
    if (lastVisitDate && lastVisitDate < sixMonthsAgo && !hasFutureEvent) {
      let progress = 0;
      if (attempt) {
        const s = attempt.status.toUpperCase();
        if (s.includes("BOOKED") || s.includes("CONFIRMED")) {
          progress = 100;
        } else if (
          s.includes("CALLING") ||
          s.includes("IN_PROGRESS") ||
          s.includes("QUEUED")
        ) {
          progress = 50;
        }
      }

      goals.push({
        id: `book-${p.id}`,
        title: `Book appointment with ${p.name}`,
        category: "overdue",
        progress,
        detail: `Last visit: ${lastVisitDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Time to schedule a follow-up.`,
        providerName: p.name,
        providerId: p.id,
      });
    }
  }

  // Rule 3: Dental checkup
  if (!hasDental && !dismissedTypes.includes("dentist")) {
    goals.push({
      id: "dental-checkup",
      title: "Schedule dental checkup",
      category: "preventive",
      progress: 0,
      detail: "No dentist found in your providers. Add one so Kate can help you stay on top of visits.",
      dismissKey: "dentist",
    } as any);
  } else if (hasDental) {
    // Check if any dental provider has a visit in the last 6 months
    const dentalProviders = providerRows.filter((p) =>
      nameMatches(p.name, DENTAL_KEYWORDS)
    );
    const hasRecentDental = dentalProviders.some((p) => {
      const lv = visitsByProvider.get(p.id);
      return lv && new Date(lv) >= sixMonthsAgo;
    });
    const hasFutureDental = dentalProviders.some((p) =>
      futureConfirmedProviderIds.has(p.id)
    );
    if (!hasRecentDental && !hasFutureDental) {
      goals.push({
        id: "dental-checkup",
        title: "Schedule dental checkup",
        category: "preventive",
        progress: 0,
        detail: "It's been over 6 months since your last dental visit.",
      });
    }
  }

  // Rule 4: Eye exam
  if (!hasEye && !dismissedTypes.includes("eye")) {
    goals.push({
      id: "eye-exam",
      title: "Schedule eye exam",
      category: "preventive",
      progress: 0,
      detail: "No eye care provider found. Add one so Kate can help you track appointments.",
      dismissKey: "eye",
    } as any);
  } else if (hasEye) {
    const eyeProviders = providerRows.filter((p) =>
      nameMatches(p.name, EYE_KEYWORDS)
    );
    const hasRecentEye = eyeProviders.some((p) => {
      const lv = visitsByProvider.get(p.id);
      return lv && new Date(lv) >= twelveMonthsAgo;
    });
    const hasFutureEye = eyeProviders.some((p) =>
      futureConfirmedProviderIds.has(p.id)
    );
    if (!hasRecentEye && !hasFutureEye) {
      goals.push({
        id: "eye-exam",
        title: "Schedule eye exam",
        category: "preventive",
        progress: 0,
        detail: "It's been over 12 months since your last eye exam.",
      });
    }
  }

  // Calendar connection removed from goals — handled on calendar page

  // Rule 6: Incomplete health profile
  const profileFields = [
    "first_name",
    "last_name",
    "date_of_birth",
    "insurance_carrier",
    "insurance_member_id",
    "phone",
  ];
  const filledCount = profileFields.filter(
    (f) => patientProfile[f] && String(patientProfile[f]).trim() !== ""
  ).length;
  if (filledCount < profileFields.length) {
    const profileProgress = Math.round(
      (filledCount / profileFields.length) * 100
    );
    goals.push({
      id: "complete-profile",
      title: "Complete your health profile",
      category: "setup",
      progress: profileProgress,
      detail: `${filledCount} of ${profileFields.length} profile fields filled. A complete profile helps Kate book appointments faster.`,
    });
  }

  // --- Health score ---
  const healthScore =
    goals.length > 0
      ? Math.round(
          goals.reduce((sum, g) => sum + g.progress, 0) / goals.length
        )
      : 100;

  // --- User-defined goals ---
  const customGoals = Array.isArray(patientProfile.custom_goals)
    ? (patientProfile.custom_goals as UserGoal[])
    : [];

  return NextResponse.json({
    ok: true,
    healthScore,
    goals,
    userGoals: customGoals,
  });
}
