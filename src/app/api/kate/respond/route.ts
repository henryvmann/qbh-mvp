export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { getKateReplyState } from "../../../../lib/qbh/kate/state";
import {
  getActiveConversation,
  getRecentMessages,
  recordMessage,
  recordKateTurn,
} from "../../../../lib/qbh/kate/conversation";
import { safeFallback, validateKateOutput } from "../../../../lib/qbh/kate/safety";

/**
 * POST /api/kate/respond
 *
 * The user just replied — either by tapping a chip or typing free-form
 * text. We:
 *   1. Record the user's reply in the active conversation.
 *   2. Compute Kate's next message via the reply-side rule layer.
 *   3. Record Kate's reply.
 *   4. Return Kate's new turn to the UI.
 *
 * Body:
 *   {
 *     conversationId?: string,    // optional; we'll find/open one if missing
 *     chipIntent?: "handle" | "elaborate" | "defer" | "thanks" | "custom",
 *     chipLabel?: string,         // human-readable label for logging
 *     typedText?: string          // for free-form replies
 *   }
 *
 * Phase 1 uses deterministic reply templates. Phase 2 swaps in the LLM
 * voice layer with the conversation history as context.
 */
export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    conversationId?: string;
    chipIntent?: string;
    chipLabel?: string;
    typedText?: string;
  };

  const chipIntent = body.chipIntent?.trim() || undefined;
  const typedText = body.typedText?.trim() || undefined;

  if (!chipIntent && !typedText) {
    return NextResponse.json(
      { ok: false, error: "Provide chipIntent or typedText" },
      { status: 400 }
    );
  }

  try {
    // Find the active conversation. If body.conversationId is provided
    // we honor it; otherwise look up the user's active one.
    const convo =
      (body.conversationId ? { id: body.conversationId } : null) ||
      (await getActiveConversation(appUserId));

    // Record the user's reply.
    if (convo) {
      await recordMessage({
        conversationId: convo.id,
        appUserId,
        role: "user",
        content: typedText ?? body.chipLabel ?? chipIntent ?? "",
        userChipIntent: chipIntent ?? null,
      });
    }

    // Compute Kate's reply, with recent conversation history so the
    // LLM voice has continuity context.
    const history = convo ? await getRecentMessages(convo.id, 10) : [];
    const candidate = await getKateReplyState({ appUserId, chipIntent, typedText, history });
    const safety = validateKateOutput(candidate);
    let state = candidate;
    if (!safety.ok) {
      state = safeFallback();
      console.warn(
        "[kate/respond] safety blocked output:",
        safety.reason,
        safety.violatedPattern
      );
    }

    // Record her reply.
    if (convo) {
      await recordKateTurn(convo.id, appUserId, state);
    }

    return NextResponse.json({
      ok: true,
      conversationId: convo?.id ?? null,
      state,
    });
  } catch (err) {
    console.error("[kate/respond] error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to compute Kate reply" },
      { status: 500 }
    );
  }
}
