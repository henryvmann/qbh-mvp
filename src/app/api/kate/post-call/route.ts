export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

/**
 * Returns pending follow-up questions for the user based on call outcomes.
 * Kate generates these after calls where info was missing.
 */
export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Get providers where we don't know new/existing status
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, name, source, provider_type")
    .eq("app_user_id", appUserId)
    .eq("status", "active")
    .neq("provider_type", "calendar")
    .neq("provider_type", "pharmacy");

  const { data: visits } = await supabaseAdmin
    .from("provider_visits")
    .select("provider_id")
    .eq("app_user_id", appUserId);

  const { data: profile } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  const patientProfile = (profile?.patient_profile || {}) as Record<string, any>;
  const visitProviderIds = new Set((visits || []).map((v) => v.provider_id));

  const questions: Array<{
    id: string;
    type: string;
    provider_id: string | null;
    provider_name: string | null;
    question: string;
    options?: string[];
  }> = [];

  // Check for missing callback phone
  if (!patientProfile.callback_phone) {
    questions.push({
      id: "callback_phone",
      type: "input",
      provider_id: null,
      provider_name: null,
      question: "What's the best phone number for offices to reach you at?",
    });
  }

  // Check providers where we don't know if new/existing
  for (const provider of providers || []) {
    if (provider.provider_type === "pharmacy") continue;

    const hasVisitHistory = visitProviderIds.has(provider.id);
    const isManual = provider.source === "manual";

    // If manually added and no visit history, ask
    if (isManual && !hasVisitHistory) {
      questions.push({
        id: `patient_status_${provider.id}`,
        type: "choice",
        provider_id: provider.id,
        provider_name: provider.name,
        question: `Have you been seen at ${provider.name} before?`,
        options: ["Yes, I'm an existing patient", "No, I'm new there", "I'm not sure"],
      });
    }
  }

  return NextResponse.json({ ok: true, questions });
}

/**
 * Save the user's answer to a follow-up question.
 */
export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const questionId = String(body.question_id || "").trim();
  const answer = String(body.answer || "").trim();

  if (!questionId || !answer) {
    return NextResponse.json({ ok: false, error: "question_id and answer required" }, { status: 400 });
  }

  // Handle callback phone
  if (questionId === "callback_phone") {
    await supabaseAdmin
      .from("app_users")
      .update({
        patient_profile: supabaseAdmin.rpc ? undefined : undefined, // handled below
      })
      .eq("id", appUserId);

    // Merge into profile
    const { data: existing } = await supabaseAdmin
      .from("app_users")
      .select("patient_profile")
      .eq("id", appUserId)
      .single();

    const merged = { ...(existing?.patient_profile || {}), callback_phone: answer };
    await supabaseAdmin
      .from("app_users")
      .update({ patient_profile: merged })
      .eq("id", appUserId);

    return NextResponse.json({ ok: true });
  }

  // Handle patient status for a provider
  if (questionId.startsWith("patient_status_")) {
    const providerId = questionId.replace("patient_status_", "");

    // If they said "yes existing", add a synthetic visit so the system knows
    if (answer.toLowerCase().includes("yes") || answer.toLowerCase().includes("existing")) {
      // Check if visit already exists
      const { data: existingVisit } = await supabaseAdmin
        .from("provider_visits")
        .select("id")
        .eq("app_user_id", appUserId)
        .eq("provider_id", providerId)
        .limit(1)
        .maybeSingle();

      if (!existingVisit) {
        await supabaseAdmin
          .from("provider_visits")
          .insert({
            app_user_id: appUserId,
            provider_id: providerId,
            source: "user_confirmed",
            visit_date: new Date().toISOString().slice(0, 10),
            amount_cents: 0,
            source_transaction_id: `user_confirmed_${Date.now()}`,
          });
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown question type" }, { status: 400 });
}
