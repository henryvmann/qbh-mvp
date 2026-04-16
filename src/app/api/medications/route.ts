export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";

export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Medications are stored in patient_profile.medications array
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const medications = data?.patient_profile?.medications || [];
  return NextResponse.json({ ok: true, medications });
}

export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, dosage, frequency, provider_id, pharmacy_id, prescribed_date } = body;

  if (!name?.trim()) {
    return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  const profile = existing?.patient_profile || {};
  const medications = profile.medications || [];

  const newMed = {
    id: crypto.randomUUID(),
    name: name.trim(),
    dosage: dosage?.trim() || null,
    frequency: frequency?.trim() || null,
    provider_id: provider_id || null,
    pharmacy_id: pharmacy_id || null,
    prescribed_date: prescribed_date || null,
    created_at: new Date().toISOString(),
  };

  medications.push(newMed);

  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: { ...profile, medications } })
    .eq("id", appUserId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, medication: newMed });
}

export async function DELETE(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID is required" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  const profile = existing?.patient_profile || {};
  const medications = (profile.medications || []).filter((m: any) => m.id !== id);

  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: { ...profile, medications } })
    .eq("id", appUserId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
