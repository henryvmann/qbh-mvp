import { createClient } from "../supabase/server";
import { supabaseAdmin } from "../supabase-server";

/**
 * Resolves the app_user_id for the currently authenticated Supabase session.
 * Returns null if the request is unauthenticated or has no app_users row.
 *
 * Use this in every user-facing API route instead of trusting a client-supplied
 * app_user_id. The session comes from the server-side cookie — the client cannot
 * spoof it.
 */
export async function getSessionAppUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data?.id ?? null;
}
