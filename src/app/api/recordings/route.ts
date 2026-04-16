export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";

export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("patient_notes")
    .select("*")
    .eq("app_user_id", appUserId)
    .eq("note_type", "recording")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recordings: data || [] });
}

export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Accept FormData with audio file
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("audio") as File | null;
  const title = (formData.get("title") as string) || "Visit Recording";

  if (!file) {
    return NextResponse.json({ ok: false, error: "No audio file provided" }, { status: 400 });
  }

  // Store metadata as a patient_note with note_type="recording"
  // Actual file processing (transcription + AI summary) will be wired up later
  const { data, error } = await supabaseAdmin
    .from("patient_notes")
    .insert({
      app_user_id: appUserId,
      title,
      body: "Recording uploaded — Kate will analyze this shortly.",
      note_type: "recording",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
