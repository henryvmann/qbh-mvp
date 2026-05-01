export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { getKateState } from "../../../../lib/qbh/kate/state";

/**
 * GET /api/kate/state
 *
 * Returns the current Kate-state for the authenticated user — what she'd
 * say right now, the items she's referencing, the response chips. The
 * UI's Today screen calls this on mount and on user actions to refresh.
 *
 * Phase 1: rule-based voice templates. Same endpoint shape will work
 * when we swap in the LLM voice layer.
 */
export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const state = await getKateState(appUserId);
    return NextResponse.json({ ok: true, state });
  } catch (err) {
    console.error("[kate/state] error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to compute Kate state" },
      { status: 500 }
    );
  }
}
