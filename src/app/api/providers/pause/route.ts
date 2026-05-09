export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

// POST /api/providers/pause
// Body: { provider_id: string, kind: "not_today" | "few_days" | "until_done" | "forever" }
//
// Stores a per-provider pause window in patient_profile.paused_providers
// jsonb so the dashboard's "feeling stuck?" prompt suppresses the
// matching provider for that window.
//   not_today → 24 hours
//   few_days  → 3 days
//   until_done → 30 days
//   forever   → far-future date (effectively permanent until user clears)
// Pass { provider_id, clear: true } to unpause a single provider.
export async function POST(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    provider_id?: string;
    kind?: "not_today" | "few_days" | "until_done" | "forever";
    clear?: boolean;
  };

  const { data: row } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .maybeSingle();

  const profile = (row?.patient_profile || {}) as Record<string, unknown>;
  const existing = (profile.paused_providers || {}) as Record<
    string,
    { until: string; kind: string }
  >;

  let next: Record<string, { until: string; kind: string }> = { ...existing };

  if (body.clear && body.provider_id) {
    delete next[body.provider_id];
  } else if (body.provider_id && body.kind) {
    const day = 24 * 60 * 60 * 1000;
    const ms =
      body.kind === "not_today"
        ? 1 * day
        : body.kind === "few_days"
        ? 3 * day
        : body.kind === "until_done"
        ? 30 * day
        : 100 * 365 * day; // "forever" — far-future date
    next[body.provider_id] = {
      until: new Date(Date.now() + ms).toISOString(),
      kind: body.kind,
    };
  } else {
    return NextResponse.json(
      { ok: false, error: "provider_id + kind required (or clear=true with provider_id)" },
      { status: 400 }
    );
  }

  // Garbage-collect expired entries while we're in here.
  const now = Date.now();
  for (const [pid, entry] of Object.entries(next)) {
    if (Date.parse(entry.until) < now) delete next[pid];
  }

  const { error } = await supabaseAdmin
    .from("app_users")
    .update({
      patient_profile: { ...profile, paused_providers: next },
    })
    .eq("id", appUserId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paused_providers: next });
}
