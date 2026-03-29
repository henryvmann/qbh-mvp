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

    // Retry discovery in the background — Plaid transactions are often not
    // ready at the time of initial connection (PRODUCT_NOT_READY), so we
    // re-run here after the user clicks the magic link. Fire-and-forget so
    // the redirect is immediate.
    supabaseAdmin
      .from("plaid_items")
      .select("access_token")
      .eq("app_user_id", appUserId)
      .limit(1)
      .then(({ data: items }) => {
        if (items?.[0]?.access_token) {
          fetch(`${origin}/api/discovery/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app_user_id: appUserId }),
          }).catch((err) => console.error("AUTH_CALLBACK_DISCOVERY_ERROR:", err));
        }
      })
      .catch((err) => console.error("AUTH_CALLBACK_PLAID_ITEM_ERROR:", err));

    return NextResponse.redirect(`${origin}/dashboard`);
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
