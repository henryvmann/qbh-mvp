export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

export async function POST(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const providerId = (body.provider_id || "").trim();

  if (!providerId) {
    return NextResponse.json({ ok: false, error: "provider_id required" }, { status: 400 });
  }

  // Verify ownership
  const { data: provider } = await supabaseAdmin
    .from("providers")
    .select("id, app_user_id, care_recipient")
    .eq("id", providerId)
    .eq("app_user_id", appUserId)
    .single();

  if (!provider) {
    return NextResponse.json({ ok: false, error: "Provider not found" }, { status: 404 });
  }

  // Mode 1: Link to existing provider (soft-delete calendar entry)
  if (body.link_to_provider_id) {
    const linkId = body.link_to_provider_id.trim();
    // Verify the target also belongs to user
    const { data: target } = await supabaseAdmin
      .from("providers")
      .select("id, care_recipient")
      .eq("id", linkId)
      .eq("app_user_id", appUserId)
      .single();

    if (!target) {
      return NextResponse.json({ ok: false, error: "Target provider not found" }, { status: 404 });
    }

    // Transfer care_recipient if the calendar provider had one assigned
    if (provider.care_recipient && !target.care_recipient) {
      await supabaseAdmin
        .from("providers")
        .update({ care_recipient: provider.care_recipient })
        .eq("id", linkId);
    }

    // Soft-delete the calendar provider
    await supabaseAdmin
      .from("providers")
      .update({ status: "inactive" })
      .eq("id", providerId);

    return NextResponse.json({ ok: true, mode: "linked", linked_to: linkId });
  }

  // Mode 2: Mark as recurring
  if (body.recurring === true) {
    await supabaseAdmin
      .from("providers")
      .update({ confirmed_status: "recurring" })
      .eq("id", providerId);

    return NextResponse.json({ ok: true, mode: "recurring" });
  }

  // Mode 3: Confirm with updated info
  const updates: Record<string, unknown> = { confirmed_status: "confirmed" };
  if (body.name) updates.name = body.name;
  if (body.phone_number) updates.phone_number = body.phone_number;
  if (body.specialty) updates.specialty = body.specialty;
  if (body.npi) updates.npi = body.npi;

  await supabaseAdmin
    .from("providers")
    .update(updates)
    .eq("id", providerId);

  return NextResponse.json({ ok: true, mode: "confirmed" });
}
