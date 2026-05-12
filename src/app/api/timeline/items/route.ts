export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

type CustomTimelineItem = {
  id: string;
  title: string;
  description?: string | null;
  target_month?: string | null; // "YYYY-MM" or null for "anytime this year"
  created_at: string;
};

function readItems(profile: Record<string, unknown> | null | undefined): CustomTimelineItem[] {
  if (!profile) return [];
  const raw = profile.custom_timeline_items;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is CustomTimelineItem => {
    return typeof x === "object" && x !== null && typeof (x as { id?: unknown }).id === "string" && typeof (x as { title?: unknown }).title === "string";
  });
}

/** Create a user-added timeline item. Body: { title, description?, target_month? } */
export async function POST(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let body: { title?: string; description?: string; target_month?: string } = {};
  try { body = await req.json(); } catch {}
  const title = (body.title || "").trim();
  if (!title) {
    return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
  }
  // target_month must be "YYYY-MM" if provided
  const targetMonth =
    body.target_month && /^\d{4}-\d{2}$/.test(body.target_month) ? body.target_month : null;

  const { data: existing } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();
  const profile = (existing?.patient_profile || {}) as Record<string, unknown>;
  const items = readItems(profile);
  const newItem: CustomTimelineItem = {
    id: crypto.randomUUID(),
    title,
    description: (body.description || "").trim() || null,
    target_month: targetMonth,
    created_at: new Date().toISOString(),
  };
  items.unshift(newItem);
  await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: { ...profile, custom_timeline_items: items } })
    .eq("id", appUserId);
  return NextResponse.json({ ok: true, item: newItem });
}

/** Remove a user-added timeline item. Query: ?id=... */
export async function DELETE(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }
  const { data: existing } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();
  const profile = (existing?.patient_profile || {}) as Record<string, unknown>;
  const items = readItems(profile).filter((x) => x.id !== id);
  await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: { ...profile, custom_timeline_items: items } })
    .eq("id", appUserId);
  return NextResponse.json({ ok: true });
}
