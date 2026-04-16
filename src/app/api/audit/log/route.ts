export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const appUserId = await getSessionAppUserId(req);
    if (!appUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, resource_type, resource_id, details } = body;

    if (!action || !resource_type) {
      return NextResponse.json(
        { ok: false, error: "action and resource_type are required" },
        { status: 400 }
      );
    }

    // Extract IP from request headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const { error } = await supabaseAdmin.from("audit_logs").insert({
      app_user_id: appUserId,
      action,
      resource_type,
      resource_id: resource_id || null,
      details: details || null,
      ip_address: ip,
    });

    if (error) {
      console.error("[audit/log] insert error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[audit/log] error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
