export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";

export async function GET(req: NextRequest) {
  let appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    const url = new URL(req.url);
    appUserId = url.searchParams.get("app_user_id");
  }
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: data?.patient_profile || {} });
}

export async function POST(req: NextRequest) {
  let appUserId = await getSessionAppUserId(req);
  const body = await req.json().catch(() => ({}));

  if (!appUserId) {
    appUserId = String(body?.app_user_id || "").trim() || null;
  }
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const incoming = body?.profile || {};

  // Merge with existing profile so we don't overwrite fields not in this request
  const { data: existing } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  const merged = { ...(existing?.patient_profile || {}), ...incoming };

  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: merged })
    .eq("id", appUserId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
