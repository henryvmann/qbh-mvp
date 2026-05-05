export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";

/**
 * Per-appointment caregiver loop.
 *
 * GET    list current user's caregivers (optionally scoped to one event)
 * POST   add a caregiver to an appointment, returns the share URL
 * PATCH  update asks / notes / contact info for an existing row
 * DELETE remove a caregiver from an appointment
 */

export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const eventId = url.searchParams.get("calendar_event_id");
  const attemptId = url.searchParams.get("schedule_attempt_id");

  let query = supabaseAdmin
    .from("appointment_caregivers")
    .select("*")
    .eq("app_user_id", appUserId)
    .order("invited_at", { ascending: false });
  if (eventId) query = query.eq("calendar_event_id", eventId);
  if (attemptId) query = query.eq("schedule_attempt_id", Number(attemptId));

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, caregivers: data ?? [] });
}

export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));

  const caregiver_name = String(body?.caregiver_name ?? "").trim();
  if (!caregiver_name) {
    return NextResponse.json({ ok: false, error: "Caregiver name required" }, { status: 400 });
  }

  const insert = {
    app_user_id: appUserId,
    calendar_event_id: body?.calendar_event_id ?? null,
    schedule_attempt_id: body?.schedule_attempt_id ?? null,
    provider_id: body?.provider_id ?? null,
    caregiver_name,
    caregiver_email: body?.caregiver_email?.trim() || null,
    caregiver_phone: body?.caregiver_phone?.trim() || null,
    asks: body?.asks ?? {},
    notes: body?.notes?.trim() || null,
  };

  const { data, error } = await supabaseAdmin
    .from("appointment_caregivers")
    .insert(insert)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  // Build the share URL the user can copy to text/email the caregiver.
  const origin = req.headers.get("origin") ?? "https://www.getquarterback.com";
  return NextResponse.json({
    ok: true,
    caregiver: data,
    share_url: `${origin}/caregiver/${data.share_token}`,
  });
}

export async function PATCH(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }
  const updates: Record<string, unknown> = {};
  if (body?.caregiver_name !== undefined) updates.caregiver_name = body.caregiver_name;
  if (body?.caregiver_email !== undefined) updates.caregiver_email = body.caregiver_email || null;
  if (body?.caregiver_phone !== undefined) updates.caregiver_phone = body.caregiver_phone || null;
  if (body?.asks !== undefined) updates.asks = body.asks;
  if (body?.notes !== undefined) updates.notes = body.notes || null;

  const { data, error } = await supabaseAdmin
    .from("appointment_caregivers")
    .update(updates)
    .eq("id", id)
    .eq("app_user_id", appUserId)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, caregiver: data });
}

export async function DELETE(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("appointment_caregivers")
    .delete()
    .eq("id", id)
    .eq("app_user_id", appUserId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
