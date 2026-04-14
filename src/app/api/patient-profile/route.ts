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

  // Handle provider-specific patient status
  const providerStatus = body?.provider_status;
  if (providerStatus?.provider_id && providerStatus?.status === "existing") {
    // Create a synthetic visit so the system knows they're existing
    const { data: existingVisit } = await supabaseAdmin
      .from("provider_visits")
      .select("id")
      .eq("app_user_id", appUserId)
      .eq("provider_id", providerStatus.provider_id)
      .limit(1)
      .maybeSingle();

    if (!existingVisit) {
      try {
        await supabaseAdmin.from("provider_visits").insert({
          app_user_id: appUserId,
          provider_id: providerStatus.provider_id,
          source: "user_confirmed",
          visit_date: new Date().toISOString().slice(0, 10),
          amount_cents: 0,
          source_transaction_id: `user_confirmed_${Date.now()}`,
        });
      } catch {
        // Non-critical
      }
    }
  }

  return NextResponse.json({ ok: true });
}
