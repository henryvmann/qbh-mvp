import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { supabaseAdmin } from "../../../lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const appUserId = searchParams.get("app_user_id");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("AUTH_CALLBACK_ERROR:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  if (appUserId) {
    // New user completing onboarding — link auth identity to existing app_users row
    const { error: linkError } = await supabaseAdmin
      .from("app_users")
      .update({ auth_user_id: user.id })
      .eq("id", appUserId)
      .is("auth_user_id", null);

    if (linkError) {
      console.error("AUTH_LINK_ERROR:", linkError.message);
    }

    // Redirect to dashboard with analyzing flag — DashboardAnalyzer will
    // trigger discovery client-side and show a loading screen until complete.
    return NextResponse.redirect(`${origin}/dashboard?analyzing=1`);
  }

  // Returning user — look up their app_users row by auth_user_id
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!appUser) {
    // Auth exists but no app_users row — send them through onboarding
    return NextResponse.redirect(`${origin}/start`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
