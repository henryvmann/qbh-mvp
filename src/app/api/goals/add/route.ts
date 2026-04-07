export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(req: Request) {
  const appUserId = await getSessionAppUserId(req);

  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json(
      { ok: false, error: "Title is required" },
      { status: 400 }
    );
  }

  // Fetch current patient_profile
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .maybeSingle();

  const profile =
    appUser?.patient_profile && typeof appUser.patient_profile === "object"
      ? (appUser.patient_profile as Record<string, unknown>)
      : {};

  const customGoals = Array.isArray(profile.custom_goals)
    ? (profile.custom_goals as Array<Record<string, unknown>>)
    : [];

  const newGoal = {
    id: crypto.randomUUID(),
    title,
    progress: 0,
    created_at: new Date().toISOString(),
  };

  customGoals.push(newGoal);

  const updatedProfile = { ...profile, custom_goals: customGoals };

  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: updatedProfile })
    .eq("id", appUserId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, goal: newGoal });
}
