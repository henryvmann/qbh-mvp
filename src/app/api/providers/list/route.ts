export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

/**
 * GET /api/providers/list?status=<status>
 *
 * Returns the session user's providers filtered by status. Used by
 * /providers/archived to render the soft-archived list. Default is
 * 'active' — the dashboard query has its own optimized path for that
 * shape, so callers should generally only use this for non-active
 * states (archived, dismissed, review_needed).
 */
export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "active";

  const { data, error } = await supabaseAdmin
    .from("providers")
    .select("id, name, display_name, specialty, doctor_name, phone_number, npi, provider_type, source, status, created_at, care_recipient, care_team, is_primary")
    .eq("app_user_id", appUserId)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, providers: data ?? [] });
}
