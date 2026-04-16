export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

type UpdateBody = {
  provider_id?: string;
  display_name?: string | null;
  doctor_name?: string | null;
  specialty?: string | null;
  phone_number?: string | null;
  notes?: string | null;
};

export async function POST(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as UpdateBody;
  const providerId = (body.provider_id || "").trim();

  if (!providerId) {
    return NextResponse.json(
      { ok: false, error: "provider_id is required" },
      { status: 400 }
    );
  }

  // Verify the provider belongs to this user
  const { data: provider, error: fetchErr } = await supabaseAdmin
    .from("providers")
    .select("id, app_user_id")
    .eq("id", providerId)
    .eq("app_user_id", appUserId)
    .single();

  if (fetchErr || !provider) {
    return NextResponse.json(
      { ok: false, error: "Provider not found" },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (body.display_name !== undefined) updates.display_name = body.display_name;
  if (body.doctor_name !== undefined) updates.doctor_name = body.doctor_name;
  if (body.specialty !== undefined) updates.specialty = body.specialty;
  if (body.phone_number !== undefined) updates.phone_number = body.phone_number;
  if (body.notes !== undefined) updates.notes = body.notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, message: "Nothing to update" });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("providers")
    .update(updates)
    .eq("id", providerId);

  if (updateErr) {
    return NextResponse.json(
      { ok: false, error: updateErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
