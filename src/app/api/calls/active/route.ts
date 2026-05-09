export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

// GET /api/calls/active
// Returns the user's most recent schedule_attempt with enough metadata
// for the site-wide call status bar to render in-progress / success /
// failure states. Polled by the LiveCallBar component.

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: attempt, error } = await supabaseAdmin
    .from("schedule_attempts")
    .select("id, provider_id, status, created_at, updated_at, metadata")
    .eq("app_user_id", appUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!attempt) {
    return NextResponse.json({ ok: true, attempt: null });
  }

  // Hydrate provider name for the bar copy.
  let providerName: string | null = null;
  if (attempt.provider_id) {
    const { data: prov } = await supabaseAdmin
      .from("providers")
      .select("name, display_name")
      .eq("id", attempt.provider_id)
      .maybeSingle();
    providerName = (prov?.display_name as string | null) || (prov?.name as string | null) || null;
  }

  const meta = (attempt.metadata || {}) as Record<string, unknown>;
  const classification = meta.openai_call_classification as Record<string, unknown> | undefined;
  const lastEvent = (meta.last_event as string | null) || null;

  // Bar shows for ~10 minutes after a terminal status — long enough for
  // a user to see and dismiss, short enough to not leave stale chrome.
  const updatedAt = (attempt.updated_at || attempt.created_at) as string;
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const TERMINAL_VISIBILITY_MS = 10 * 60 * 1000;

  return NextResponse.json(
    {
      ok: true,
      attempt: {
        id: attempt.id,
        provider_id: attempt.provider_id,
        provider_name: providerName,
        status: attempt.status,
        last_event: lastEvent,
        created_at: attempt.created_at,
        updated_at: updatedAt,
        age_ms: ageMs,
        terminal_visibility_remaining_ms: Math.max(0, TERMINAL_VISIBILITY_MS - ageMs),
        outcome_type: (classification?.outcome_type as string | null) || null,
        failure_class: (classification?.failure_class as string | null) || null,
        call_summary: (classification?.call_summary as string | null) || null,
        reason_summary: (classification?.reason_summary as string | null) || null,
        retry_policy_hint: (classification?.retry_policy_hint as string | null) || null,
        user_input_required: !!classification?.user_input_required,
        callback_requested: !!classification?.callback_requested,
        suggested_retry_after_iso: (classification?.suggested_retry_after_iso as string | null) || null,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
