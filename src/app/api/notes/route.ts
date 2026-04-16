export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";

export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const providerId = url.searchParams.get("provider_id");

  let query = supabaseAdmin
    .from("patient_notes")
    .select("*")
    .eq("app_user_id", appUserId)
    .order("created_at", { ascending: false });

  if (providerId) {
    query = query.eq("provider_id", providerId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notes: data || [] });
}

export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { provider_id, title, body: noteBody, note_type } = body;

  if (!title || !noteBody) {
    return NextResponse.json(
      { ok: false, error: "title and body are required" },
      { status: 400 }
    );
  }

  const validTypes = ["question", "visit_note", "symptom", "general"];
  const type = validTypes.includes(note_type) ? note_type : "general";

  const { data, error } = await supabaseAdmin
    .from("patient_notes")
    .insert({
      app_user_id: appUserId,
      provider_id: provider_id || null,
      title,
      body: noteBody,
      note_type: type,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, note: data });
}

export async function DELETE(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const noteId = url.searchParams.get("id");

  if (!noteId) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("patient_notes")
    .delete()
    .eq("id", noteId)
    .eq("app_user_id", appUserId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
