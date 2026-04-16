import { createClient } from "../supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase-server";

/**
 * Resolves the app_user_id for the currently authenticated request.
 *
 * - Native (Capacitor): reads Authorization: Bearer <token> from the request header
 * - Web: reads the Supabase session cookie (set by middleware)
 *
 * Always pass `req` from the route handler. The client cannot spoof either path.
 */
export async function getSessionAppUserId(req?: Request): Promise<string | null> {
  let authUserId: string | null = null;
  let debugSource = "";
  let debugError: string | null = null;

  const authHeader = req?.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    debugSource = "bearer";
    const token = authHeader.slice(7);
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    authUserId = user?.id ?? null;
    debugError = error?.message ?? null;
  } else {
    debugSource = "cookie";
    const cookieHeader = req?.headers.get('cookie') ?? "";
    const sbCookieNames = cookieHeader
      .split(";")
      .map((c) => c.trim().split("=")[0])
      .filter((n) => n.startsWith("sb-"));
    console.log("[auth] cookie names:", sbCookieNames);

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    authUserId = user?.id ?? null;
    debugError = error?.message ?? null;
  }

  console.log("[auth]", { source: debugSource, authUserId, debugError });

  if (!authUserId) return null;

  const { data, error: lookupError } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  console.log("[auth] app_users lookup:", { authUserId, appUserId: data?.id, lookupError: lookupError?.message });

  return data?.id ?? null;
}
