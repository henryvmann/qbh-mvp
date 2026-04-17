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

  const authHeader = req?.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    authUserId = user?.id ?? null;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    authUserId = user?.id ?? null;
  }

  if (!authUserId) return null;

  // Look up existing app_users row
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (data?.id) return data.id;

  // Auto-provision: create app_users row if auth user exists but row is missing
  const { data: newRow } = await supabaseAdmin
    .from("app_users")
    .insert({ auth_user_id: authUserId })
    .select("id")
    .single();

  return newRow?.id ?? null;
}
