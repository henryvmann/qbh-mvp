export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const appUserId = String(body?.app_user_id || "").trim();
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone_number || "").trim() || null;
    const specialty = String(body?.specialty || "").trim() || null;
    const careRecipients = Array.isArray(body?.care_recipients) ? body.care_recipients :
      body?.care_recipient ? [body.care_recipient] : [];

    if (!appUserId || !name) {
      return NextResponse.json({ ok: false, error: "Missing app_user_id or name" }, { status: 400 });
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from("providers")
      .select("id")
      .eq("app_user_id", appUserId)
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, provider_id: existing.id, duplicate: true });
    }

    const { data, error } = await supabaseAdmin
      .from("providers")
      .insert({
        app_user_id: appUserId,
        name,
        phone_number: phone,
        status: "active",
        care_recipient: careRecipients.length > 0 ? JSON.stringify(careRecipients) : null,
        source: "manual",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[add-manual] error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, provider_id: data.id });
  } catch (err) {
    console.error("[add-manual] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to add provider" }, { status: 500 });
  }
}
