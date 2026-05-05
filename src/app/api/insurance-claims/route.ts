export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";

/**
 * Manual claims tracker. Phase 0 has no payer integration — the
 * user logs that they submitted a superbill or claim, sets status,
 * Kate sets a 28-day follow-up reminder. Phase 1 will swap in
 * Flexpa for auto-pulled status; for now this is the workflow
 * layer the user manages by hand.
 *
 * GET   /api/insurance-claims      list current user's claims
 * POST  /api/insurance-claims      create a claim (auto-sets followup)
 * PATCH /api/insurance-claims      update status / amount_received / notes
 */

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("insurance_claims")
    .select("*")
    .eq("app_user_id", appUserId)
    .order("date_submitted", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, claims: data ?? [] });
}

export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));

  const date_submitted = body?.date_submitted ?? new Date().toISOString().slice(0, 10);
  // Default Kate-watches-this window: 28 days. Most payers process
  // clean claims in 14-30 days; 28 is the right "you haven't heard
  // back, time to call" prompt.
  const followup = new Date(date_submitted);
  followup.setDate(followup.getDate() + 28);

  const { data, error } = await supabaseAdmin
    .from("insurance_claims")
    .insert({
      app_user_id: appUserId,
      related_provider_id: body?.related_provider_id ?? null,
      related_eob_id: body?.related_eob_id ?? null,
      related_visit_id: body?.related_visit_id ?? null,
      amount_submitted: body?.amount_submitted ?? null,
      payer: body?.payer ?? null,
      date_submitted,
      date_of_service: body?.date_of_service ?? null,
      status: body?.status ?? "submitted",
      expected_followup_date: body?.expected_followup_date ?? followup.toISOString().slice(0, 10),
      notes: body?.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, claim: data });
}

export async function PATCH(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing claim id" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.status !== undefined) updates.status = body.status;
  if (body?.amount_received !== undefined) updates.amount_received = body.amount_received;
  if (body?.date_resolved !== undefined) updates.date_resolved = body.date_resolved;
  if (body?.expected_followup_date !== undefined) updates.expected_followup_date = body.expected_followup_date;
  if (body?.notes !== undefined) updates.notes = body.notes;
  if (body?.payer !== undefined) updates.payer = body.payer;
  if (body?.amount_submitted !== undefined) updates.amount_submitted = body.amount_submitted;

  const { data, error } = await supabaseAdmin
    .from("insurance_claims")
    .update(updates)
    .eq("id", id)
    .eq("app_user_id", appUserId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, claim: data });
}

export async function DELETE(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("insurance_claims")
    .delete()
    .eq("id", id)
    .eq("app_user_id", appUserId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
