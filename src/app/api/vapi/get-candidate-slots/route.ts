import { supabaseAdmin } from "../../../../lib/supabase-server";
import { normalizeAttemptId } from "../../../../lib/vapi/ids";
import { generateCandidateSlots } from "../../../../lib/availability/generateCandidateSlots";

type VapiToolResultEnvelope = {
  toolCallId: string;
  result: string; // JSON-stringified result
};

type VapiToolCallsBody = {
  message?: {
    type?: string;
    toolCalls?: Array<{
      id?: string;
      function?: { name?: string; arguments?: string | Record<string, any> };
    }>;
  };
  toolCallId?: string;
  tool_call_id?: string;
  id?: string;
  attempt_id?: any;
};

function jsonToolResults(results: VapiToolResultEnvelope[]) {
  return Response.json({ results });
}

function safeParseArgs(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, any>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

function toolError(toolCallId: string, debug?: any): VapiToolResultEnvelope {
  return {
    toolCallId,
    result: JSON.stringify({
      status: "ERROR",
      message_to_say: "There was a system issue. I will call back shortly.",
      next_action: "END_CALL",
      ...(debug ? { debug } : {}),
    }),
  };
}

async function handleOne(toolCallId: string, args: any): Promise<VapiToolResultEnvelope> {
  let attemptId: number;
  try {
    attemptId = normalizeAttemptId(args?.attempt_id);
  } catch {
    return toolError(toolCallId, { stage: "invalid_attempt_id", received: args?.attempt_id });
  }

  // 1) If slots already exist, do NOT regenerate
  const { data: existingRows, error: existingRowsError } = await supabaseAdmin
    .from("candidate_slots")
    .select("id")
    .eq("attempt_id", attemptId)
    .limit(1);

  if (existingRowsError) {
    return toolError(toolCallId, {
      stage: "check_existing",
      message: existingRowsError.message,
      details: existingRowsError.details,
      code: existingRowsError.code,
    });
  }

  // 2) Only generate + insert if none exist
  if (!existingRows || existingRows.length === 0) {
    const now = new Date();

    const generated = generateCandidateSlots(now, {
      timezoneOffsetMinutes: now.getTimezoneOffset() * -1,
      businessStartHour: 9,
      businessEndHour: 17,
      slotMinutes: 30,
      count: 3,
    });

    if (!generated.length) {
      return toolError(toolCallId, { stage: "generate_empty" });
    }

    const rowsToInsert = generated.map((slot: any, i: number) => ({
      attempt_id: attemptId,
      slot_index: i,
      start_at: slot.start,
      end_at: slot.end,
      spoken_start: slot.start,
      spoken_end: slot.end,
      timezone: slot.timezone ?? null,
      engine_version: "v1",
      anchor_utc: slot.anchor_utc ?? null,
      payload: slot,
    }));

    const { error: insertError } = await supabaseAdmin.from("candidate_slots").upsert(rowsToInsert, {
      onConflict: "attempt_id,start_at,end_at",
      ignoreDuplicates: true,
    });

    if (insertError) {
      return toolError(toolCallId, {
        stage: "insert",
        message: insertError.message,
        details: insertError.details,
        code: insertError.code,
      });
    }
  }

  // 3) Read canonical rows
  const { data: canonicalRows, error: readError } = await supabaseAdmin
    .from("candidate_slots")
    .select("slot_index,start_at,end_at,timezone,spoken_start,spoken_end")
    .eq("attempt_id", attemptId)
    .order("slot_index", { ascending: true });

  if (readError) {
    return toolError(toolCallId, {
      stage: "read",
      message: readError.message,
      details: readError.details,
      code: readError.code,
    });
  }

  const canonicalSlots =
    canonicalRows?.map((r: any) => ({
      start_at: r.start_at,
      end_at: r.end_at,
      timezone: r.timezone ?? null,
      spoken_start: r.spoken_start ?? r.start_at,
      spoken_end: r.spoken_end ?? r.end_at,
    })) ?? [];

  if (!canonicalSlots.length) {
    return toolError(toolCallId, { stage: "post_read_empty", attemptId });
  }

  // 4) Dynamic spoken output (1/2/3)
  const spokenParts = canonicalSlots.slice(0, 3).map((s, idx) => {
    const label = idx === 0 ? "First" : idx === 1 ? "Second" : "Third";
    return `${label}: ${s.spoken_start}`;
  });

  const message_to_say =
    canonicalSlots.length === 1
      ? `I have one time available. ${spokenParts[0]}. Does that work?`
      : canonicalSlots.length === 2
      ? `I have two times available. ${spokenParts[0]}. ${spokenParts[1]}. Which works best?`
      : `I have three times available. ${spokenParts[0]}. ${spokenParts[1]}. ${spokenParts[2]}. Which works best?`;

  return {
    toolCallId,
    result: JSON.stringify({
      status: "OK",
      candidate_slots: canonicalSlots,
      message_to_say,
      next_action: "ASK_USER_TO_CHOOSE_SLOT",
    }),
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as VapiToolCallsBody;

  // 1) Vapi tool-calls envelope
  if (body?.message?.type === "tool-calls" && Array.isArray(body.message.toolCalls)) {
    const results: VapiToolResultEnvelope[] = [];

    for (const tc of body.message.toolCalls) {
      const toolCallId = String(tc?.id ?? "").trim() || "missing_toolCallId";
      const fnName = String(tc?.function?.name ?? "").trim();
      if (fnName !== "get_candidate_slots") continue;

      const args = safeParseArgs(tc?.function?.arguments);
      results.push(await handleOne(toolCallId, args));
    }

    if (results.length === 0) {
      return jsonToolResults([
        toolError("no_matching_tool", {
          stage: "no_matching_tool_call",
          received_names: body.message.toolCalls.map((t) => t?.function?.name ?? null),
        }),
      ]);
    }

    return jsonToolResults(results);
  }

  // 2) Flat JSON body (curl / legacy)
  const toolCallId = String(body?.toolCallId || body?.tool_call_id || body?.id || "local_call").trim();
  return jsonToolResults([await handleOne(toolCallId, body)]);
}