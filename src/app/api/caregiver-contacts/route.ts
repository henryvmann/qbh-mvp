export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";

/**
 * Caregiver contacts (the rolodex). The user pre-populates a list of
 * people who might be invited to appointments later. Per-visit invites
 * still go through /api/appointment-caregivers.
 *
 *   GET    list current user's contacts
 *   POST   add a contact (name required; email/phone optional)
 *   PATCH  edit a contact by id
 *   DELETE remove a contact by id
 */

export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("caregiver_contacts")
    .select("*")
    .eq("app_user_id", appUserId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, contacts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  }
  const email = body?.email ? String(body.email).trim().toLowerCase() : null;
  const phone = body?.phone ? String(body.phone).trim() : null;
  const relationship = body?.relationship ? String(body.relationship).trim() : null;
  const notes = body?.notes ? String(body.notes).trim() : null;

  const { data, error } = await supabaseAdmin
    .from("caregiver_contacts")
    .insert({
      app_user_id: appUserId,
      name,
      email: email || null,
      phone: phone || null,
      relationship: relationship || null,
      notes: notes || null,
    })
    .select()
    .single();
  if (error) {
    // Duplicate email under the unique partial index — surface a
    // friendly error instead of the Postgres code.
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "You already have a contact with this email." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, contact: data });
}

export async function PATCH(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }
  const updates: Record<string, string | null> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if ("email" in body) updates.email = body.email ? String(body.email).trim().toLowerCase() : null;
  if ("phone" in body) updates.phone = body.phone ? String(body.phone).trim() : null;
  if ("relationship" in body) updates.relationship = body.relationship ? String(body.relationship).trim() : null;
  if ("notes" in body) updates.notes = body.notes ? String(body.notes).trim() : null;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "no fields to update" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("caregiver_contacts")
    .update(updates)
    .eq("id", id)
    .eq("app_user_id", appUserId)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, contact: data });
}

export async function DELETE(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("caregiver_contacts")
    .delete()
    .eq("id", id)
    .eq("app_user_id", appUserId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
