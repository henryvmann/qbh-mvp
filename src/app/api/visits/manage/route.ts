export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

/** Update or delete a past visit */
export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string; // "update" | "delete" | "add"
  const visitId = body.visit_id as string | undefined;

  if (action === "delete" && visitId) {
    const { error } = await supabaseAdmin
      .from("provider_visits")
      .delete()
      .eq("id", visitId)
      .eq("app_user_id", appUserId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "update" && visitId) {
    const updates: Record<string, unknown> = {};
    if (body.visit_date) updates.visit_date = body.visit_date;
    if (body.provider_id) updates.provider_id = body.provider_id;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("provider_visits")
      .update(updates)
      .eq("id", visitId)
      .eq("app_user_id", appUserId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "add") {
    const providerId = body.provider_id as string;
    const visitDate = body.visit_date as string;

    if (!providerId || !visitDate) {
      return NextResponse.json({ ok: false, error: "Missing provider_id or visit_date" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("provider_visits")
      .insert({
        app_user_id: appUserId,
        provider_id: providerId,
        visit_date: visitDate,
        source: "manual",
      });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
}
