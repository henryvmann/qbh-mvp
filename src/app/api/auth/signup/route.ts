export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

/**
 * Creates a user with auto-confirmed email so they can sign in immediately.
 * Used during onboarding — no email confirmation step needed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "").trim();
    const appUserId = String(body?.app_user_id || "").trim();
    const name = String(body?.name || "").trim();
    const surveyAnswers = body?.survey_answers || null;
    const consents = body?.consents || null;
    const careRecipients = body?.care_recipients || null;
    const manualProviders = body?.manual_providers || null;

    if (!email || !password || !appUserId) {
      return NextResponse.json(
        { ok: false, error: "Missing email, password, or app_user_id" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Create user with admin API — auto-confirms email
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        app_user_id: appUserId,
        survey_answers: surveyAnswers,
        consents: consents || undefined,
      },
    });

    if (createError) {
      console.error("signup createUser error:", createError);
      return NextResponse.json(
        { ok: false, error: createError.message },
        { status: 400 }
      );
    }

    // Ensure app_users row exists and link auth user to it
    if (userData.user) {
      // Upsert the app_users row — may not exist on manual provider path (no Plaid step)
      // Build patient_profile with care recipients if provided
      const patientProfile: Record<string, unknown> = {};
      if (name) patientProfile.full_name = name;
      if (careRecipients) patientProfile.care_recipients = careRecipients;

      const { error: upsertError } = await supabaseAdmin
        .from("app_users")
        .upsert(
          {
            id: appUserId,
            auth_user_id: userData.user.id,
            ...(consents ? { consents } : {}),
            ...(Object.keys(patientProfile).length > 0 ? { patient_profile: patientProfile } : {}),
          },
          { onConflict: "id" }
        );

      if (upsertError) {
        console.error("signup upsert app_users error:", upsertError);
      }

      // Add manual providers if provided
      console.log("[signup] manual_providers received:", JSON.stringify(manualProviders));
      if (manualProviders && Array.isArray(manualProviders)) {
        for (const prov of manualProviders) {
          const provName = String(prov.name || "").trim();
          if (!provName) continue;
          const insertRow: Record<string, unknown> = {
            app_user_id: appUserId,
            name: provName,
            phone_number: prov.phone_number || prov.phone || null,
            specialty: prov.specialty || null,
            status: "active",
            source: "manual",
          };
          if (prov.npi) insertRow.npi = prov.npi;
          console.log("[signup] inserting provider:", provName, "for app_user_id:", appUserId);
          const { error: provError } = await supabaseAdmin.from("providers").insert(insertRow);
          if (provError) {
            console.error("[signup] add provider error:", provName, provError.message, provError.details, provError.code);
          } else {
            console.log("[signup] provider added successfully:", provName);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("signup error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create account" },
      { status: 500 }
    );
  }
}
