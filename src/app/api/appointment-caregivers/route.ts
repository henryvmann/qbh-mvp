export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { enqueueEmail } from "../../../lib/notifications/queue";
import {
  renderCaregiverInvite,
  summarizeAsks,
} from "../../../lib/notifications/templates/caregiver-invite";

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
  const shareUrl = `${origin}/caregiver/${data.share_token}`;

  // If the caregiver has an email address and the user opted into the
  // send (auto-on for now), queue an invite from kate@getquarterback.com.
  let invite_queued = false;
  if (data.caregiver_email && body?.send_email !== false) {
    const ctx = await loadInviteContext(appUserId, data);
    const rendered = renderCaregiverInvite({
      patientFirstName: ctx.patientFirstName,
      caregiverName: data.caregiver_name,
      appointmentWhen: ctx.appointmentWhen,
      providerLabel: ctx.providerLabel,
      asksSummary: summarizeAsks(data.asks),
      notes: data.notes ?? undefined,
      shareUrl,
    });
    const enq = await enqueueEmail({
      appUserId,
      to: data.caregiver_email,
      toName: data.caregiver_name,
      subject: rendered.subject,
      htmlBody: rendered.html,
      textBody: rendered.text,
      template: "caregiver_invite",
      metadata: {
        appointment_caregiver_id: data.id,
        calendar_event_id: data.calendar_event_id,
        schedule_attempt_id: data.schedule_attempt_id,
      },
    });
    invite_queued = enq.ok;
  }

  return NextResponse.json({
    ok: true,
    caregiver: data,
    share_url: shareUrl,
    invite_queued,
  });
}

type CaregiverRow = {
  id: string;
  caregiver_name: string;
  caregiver_email: string | null;
  calendar_event_id: string | null;
  schedule_attempt_id: number | null;
  provider_id: string | null;
  asks: Record<string, unknown> | null;
  notes: string | null;
};

async function loadInviteContext(appUserId: string, row: CaregiverRow) {
  // Patient first name. patient_profile is a jsonb column on app_users.
  let patientFirstName = "your friend";
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .maybeSingle();
  const profile = (appUser?.patient_profile ?? {}) as Record<string, unknown>;
  const fullName = typeof profile.full_name === "string" ? profile.full_name : "";
  const first =
    typeof profile.first_name === "string" && profile.first_name.trim()
      ? profile.first_name.trim()
      : fullName.split(" ")[0];
  if (first) patientFirstName = first;

  // Provider label
  let providerLabel: string | undefined;
  if (row.provider_id) {
    const { data: prov } = await supabaseAdmin
      .from("providers")
      .select("name, specialty, practice_name")
      .eq("id", row.provider_id)
      .maybeSingle();
    if (prov) {
      providerLabel = [prov.name, prov.specialty, prov.practice_name]
        .filter(Boolean)
        .join(" · ");
    }
  }

  // Appointment time
  let appointmentWhen: string | undefined;
  if (row.calendar_event_id) {
    const { data: ev } = await supabaseAdmin
      .from("calendar_events")
      .select("start_at")
      .eq("id", row.calendar_event_id)
      .maybeSingle();
    if (ev?.start_at) appointmentWhen = formatWhen(ev.start_at);
  }

  return { patientFirstName, providerLabel, appointmentWhen };
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
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
