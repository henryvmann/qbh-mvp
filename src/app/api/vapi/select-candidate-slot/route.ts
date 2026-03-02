import { supabaseAdmin } from "../../../../lib/supabase-server";

type VapiToolEnvelope = {
  toolCallId: string;
  result: string; // JSON string
};

function jsonResult(toolCallId: string, obj: unknown) {
  const env: VapiToolEnvelope = { toolCallId, result: JSON.stringify(obj) };
  return Response.json({ results: [env] });
}

function toInt(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Math.trunc(Number(v));
  return null;
}

function normText(v: any): string {
  return String(v ?? "").trim();
}

function lowerTrim(v: any): string {
  return normText(v).toLowerCase();
}

function ordinalToZeroIndex(selLower: string): number | null {
  if (selLower === "first" || selLower === "1" || selLower === "1st") return 0;
  if (selLower === "second" || selLower === "2" || selLower === "2nd") return 1;
  if (selLower === "third" || selLower === "3" || selLower === "3rd") return 2;
  return null;
}

async function getExistingProposalId(attemptId: number): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("proposals")
    .select("id")
    .eq("attempt_id", attemptId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return null;
  if (!data || data.length === 0) return null;
  return data[0].id ?? null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const toolCallId = body?.toolCallId || body?.tool_call_id || body?.id;
  if (!toolCallId) {
    return Response.json({
      results: [
        {
          toolCallId: "missing_toolCallId",
          result: JSON.stringify({
            status: "ERROR",
            code: "MISSING_TOOL_CALL_ID",
            message_to_say: "There was a system issue. I will call back shortly.",
            next_action: "END_CALL",
          }),
        },
      ],
    });
  }

  const attemptId = toInt(body?.attempt_id ?? body?.attemptId);
  const providerId = normText(body?.provider_id ?? body?.providerId);
  const userSelection = normText(body?.user_selection ?? body?.selection ?? body?.selected ?? "");

  if (!attemptId || !providerId || !userSelection) {
    return jsonResult(toolCallId, {
      status: "ERROR",
      code: "MISSING_REQUIRED_FIELDS",
      message_to_say: "There was a system issue. I will call back shortly.",
      next_action: "END_CALL",
    });
  }

  // If already selected once for this attempt, return existing proposal immediately (idempotent).
  const existingId = await getExistingProposalId(attemptId);
  if (existingId) {
    return jsonResult(toolCallId, {
      status: "OK",
      proposal_id: existingId,
      attempt_id: attemptId,
      provider_id: providerId,
      next_action: "SAY_TO_OFFICE",
      message_to_say: "One moment while I confirm that time.",
    });
  }

  const { data: slots, error: slotsErr } = await supabaseAdmin
    .from("candidate_slots")
    .select("attempt_id, slot_index, start_at, end_at, spoken_start, spoken_end, payload")
    .eq("attempt_id", attemptId)
    .order("slot_index", { ascending: true });

  if (slotsErr) {
    return jsonResult(toolCallId, {
      status: "ERROR",
      code: "CANDIDATE_SLOTS_QUERY_FAILED",
      message_to_say: "There was a system issue. I will call back shortly.",
      next_action: "END_CALL",
    });
  }

  if (!slots || slots.length === 0) {
    return jsonResult(toolCallId, {
      status: "ERROR",
      code: "NO_CANDIDATE_SLOTS",
      message_to_say: "I don’t have any available times to offer right now. I can call back shortly.",
      next_action: "END_CALL",
    });
  }

  const selLower = lowerTrim(userSelection);
  const zeroIdx = ordinalToZeroIndex(selLower);

  let chosen: any | null = null;

  if (zeroIdx !== null) {
    chosen = (slots as any[]).find((s) => toInt(s.slot_index) === zeroIdx) ?? null;
    if (!chosen) {
      return jsonResult(toolCallId, {
        status: "ERROR",
        code: "INVALID_ORDINAL_SELECTION",
        message_to_say: "That option isn’t available. Please choose one of the offered times.",
        next_action: "ASK_FOR_ALTERNATIVE",
      });
    }
  } else {
    const matches = (slots as any[]).filter((s) => lowerTrim(s.spoken_start) === selLower);
    if (matches.length === 0) {
      return jsonResult(toolCallId, {
        status: "ERROR",
        code: "NO_TIME_MATCH",
        message_to_say: "That time doesn’t match the options I offered. Please choose one of the offered times.",
        next_action: "ASK_FOR_ALTERNATIVE",
      });
    }
    if (matches.length > 1) {
      return jsonResult(toolCallId, {
        status: "ERROR",
        code: "AMBIGUOUS_TIME_MATCH",
        message_to_say: "That selection matches more than one option. Please say first, second, or third.",
        next_action: "ASK_FOR_ALTERNATIVE",
      });
    }
    chosen = matches[0];
  }

  const payload = {
    source: "candidate_slot_selection",
    provider_id: providerId,
    user_selection: userSelection,
    slot_index: chosen.slot_index,
    spoken_start: chosen.spoken_start,
    spoken_end: chosen.spoken_end,
    start_at: chosen.start_at,
    end_at: chosen.end_at,
    candidate_payload: chosen.payload ?? {},
  };

  const { data: proposal, error: propErr } = await supabaseAdmin
    .from("proposals")
    .insert({
      attempt_id: attemptId,
      tool_call_id: toolCallId,
      office_offer_raw_text: `CANDIDATE_SLOT_SELECTION:${userSelection}`,
      normalized_start: chosen.start_at,
      normalized_end: chosen.end_at,
      conflict: false,
      message_to_say: `How about ${chosen.spoken_start}?`,
      next_action: "SAY_TO_OFFICE",
      status: "PROPOSED",
      payload,
    })
    .select("id")
    .single();

  // If insert lost a race to the unique constraint, re-select and return OK.
  if (propErr) {
    const code = (propErr as any)?.code;
    if (code === "23505") {
      const racedId = await getExistingProposalId(attemptId);
      if (racedId) {
        return jsonResult(toolCallId, {
          status: "OK",
          proposal_id: racedId,
          attempt_id: attemptId,
          provider_id: providerId,
          next_action: "SAY_TO_OFFICE",
          message_to_say: "One moment while I confirm that time.",
        });
      }
    }

    return jsonResult(toolCallId, {
      status: "ERROR",
      code: "PROPOSAL_INSERT_FAILED",
      message_to_say: "There was a system issue. I will call back shortly.",
      next_action: "END_CALL",
    });
  }

  return jsonResult(toolCallId, {
    status: "OK",
    proposal_id: proposal.id,
    attempt_id: attemptId,
    provider_id: providerId,
    selected: {
      slot_index: chosen.slot_index,
      start_at: chosen.start_at,
      end_at: chosen.end_at,
      spoken_start: chosen.spoken_start,
      spoken_end: chosen.spoken_end,
    },
    message_to_say: `How about ${chosen.spoken_start}?`,
    next_action: "SAY_TO_OFFICE",
  });
}