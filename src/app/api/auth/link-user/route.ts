export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

/**
 * Links a Supabase auth user to an app_users row.
 * Called during onboarding after signUp so the session
 * can resolve to the correct app_user_id.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const appUserId = String(body?.app_user_id || "").trim();
    const authUserId = String(body?.auth_user_id || "").trim();

    if (!appUserId || !authUserId) {
      return NextResponse.json(
        { ok: false, error: "Missing app_user_id or auth_user_id" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("app_users")
      .update({ auth_user_id: authUserId })
      .eq("id", appUserId)
      .is("auth_user_id", null);

    if (error) {
      console.error("link-user error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to link user" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("link-user error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
