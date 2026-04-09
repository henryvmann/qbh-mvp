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
      const { error: upsertError } = await supabaseAdmin
        .from("app_users")
        .upsert(
          { id: appUserId, auth_user_id: userData.user.id },
          { onConflict: "id" }
        );

      if (upsertError) {
        console.error("signup upsert app_users error:", upsertError);
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
