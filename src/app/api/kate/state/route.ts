export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { getOpeningKateState } from "../../../../lib/qbh/kate/state";
import {
  getActiveConversation,
  getRecentMessages,
  openConversation,
  recordKateTurn,
  updateLastFacts,
} from "../../../../lib/qbh/kate/conversation";
import { safeFallback, validateKateOutput } from "../../../../lib/qbh/kate/safety";

/**
 * GET /api/kate/state
 *
 * Returns Kate's current view for the authenticated user.
 *
 * Behavior:
 *  - If an active conversation exists within the resume window AND has
 *    at least one Kate turn, return that turn (don't recompute, don't
 *    repeat herself on a refresh).
 *  - Otherwise, compute a fresh KateState from the inference layer,
 *    open a new conversation, record her opening turn, return it.
 *
 * Conversation persistence is best-effort. If the kate_conversations /
 * kate_messages tables haven't been migrated yet, the API still works —
 * it just operates statelessly (no resume, no dedup).
 */
export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Try to resume an active conversation
    const active = await getActiveConversation(appUserId);
    if (active) {
      const recent = await getRecentMessages(active.id, 20);
      const lastKate = [...recent].reverse().find((m) => m.role === "kate");
      if (lastKate) {
        return NextResponse.json({
          ok: true,
          conversationId: active.id,
          resumed: true,
          state: {
            bucket: lastKate.kate_bucket ?? "quiet",
            tone: lastKate.kate_tone ?? "calm",
            confidence: lastKate.kate_confidence ?? "settled",
            daysSinceSignup: 0, // not stored on the message; UI doesn't use this on resume
            message: lastKate.content,
            items: lastKate.items_referenced,
            chips: lastKate.chips_offered,
            status: {
              stateText: "",
              score: null,
              deltaText: null,
            },
            meta: {
              generatedAt: lastKate.created_at,
              rulesVersion: "resumed",
              voiceVersion: "resumed",
            },
          },
          history: recent,
        });
      }
    }

    // Fresh start
    const candidate = await getOpeningKateState(appUserId);
    const safety = validateKateOutput(candidate);
    let state = candidate;
    if (!safety.ok) {
      state = safeFallback();
      console.warn(
        "[kate/state] safety blocked output:",
        safety.reason,
        safety.violatedPattern
      );
    }

    const convo = await openConversation(appUserId, state);
    if (convo) {
      await recordKateTurn(convo.id, appUserId, state);
      await updateLastFacts(convo.id, state);
    }

    return NextResponse.json({
      ok: true,
      conversationId: convo?.id ?? null,
      resumed: false,
      state,
      history: [],
    });
  } catch (err) {
    console.error("[kate/state] error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to compute Kate state" },
      { status: 500 }
    );
  }
}
