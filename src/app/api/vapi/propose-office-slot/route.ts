import { supabaseAdmin } from "../../../../lib/supabase-server";
import { normalizeProviderId } from "../../../../lib/vapi/ids";

type VapiToolResultEnvelope = {
  toolCallId: string;
  result: string;
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
};

type ProposeOfficeSlotArgs = {
  attempt_id?: number | string;
  provider_id?: unknown;
  proposal_id?: string;
  proposalId?: string;
};

function jsonToolResults(results: VapiToolResultEnvelope[]) {
  return Response.json({ results });
}

function isDigits(v: string): boolean {
  return /^[0-9]+$/.test(v);
}

function normalizeAttemptId(input: number | string): {
  attemptIdStr: string;
  attemptIdNumOrNull: number | null;
} {
  const attemptIdStr = String(input).trim();
  if (!isDigits(attemptIdStr)) {
    throw new Error("attempt_id must be an integer (bigint-compatible)");
  }

  const asNum = Number(attemptIdStr);
  const attemptIdNumOrNull =
    Number.isFinite(asNum) && Number.isSafeInteger(asNum) ? asNum : null;

  return { attemptIdStr, attemptIdNumOrNull };
}

async function logCallEvent(params: {
  attemptIdNumOrNull: number | null;
  source: string;
  event_type: string;
  tool_name?: string | null;
  tool_payload?: any;
  vapi_event?: any;
}) {
  try {
    await supabaseAdmin.from("call_events").insert({
      attempt_id: params.attemptIdNumOrNull,
      source: params.source,
      event_type: params.event_type,
      tool_name: params.tool_name ?? null,
      tool_payload: params.tool_payload ?? null,
      vapi_event: params.vapi_event ?? null,
    });
  } catch {
    // never block tool flow
  }
}

function formatForSpeechFromIso(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return `${date} at ${time}`;
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

async function handleOne(
  toolCallId: string,
  args: ProposeOfficeSlotArgs
): Promise<VapiToolResultEnvelope> {
  let attemptIdStr = "";
  let attemptIdNumOrNull: number | null = null;

  try {
    const normalized = normalizeAttemptId(args.attempt_id as any);
    attemptIdStr = normalized.attemptIdStr;
    attemptIdNumOrNull = normalized.attemptIdNumOrNull;
  } catch (e: any) {
    return {
      toolCallId,
      result: JSON.stringify({
        status: "ERROR",
        code: "INVALID_ATTEMPT_ID",
        message_to_say: e?.message ?? "Invalid attempt_id",
        next_action: "END_CALL",
      }),
    };
  }

  let providerIdUuid: string | null = null;
  try {
    if (typeof args.provider_id === "string") {
      providerIdUuid = normalizeProviderId(args.provider_id);
    }
  } catch {
    providerIdUuid = null;
  }

  const proposalId = String(args?.proposal_id ?? args?.proposalId ?? "").trim();

  const toolPayload = {
    toolCallId,
    attempt_id: attemptIdStr,
    provider_id_raw: args.provider_id ?? null,
    provider_id_uuid: providerIdUuid,
    proposal_id: proposalId || null,
  };

  await logCallEvent({
    attemptIdNumOrNull,
    source: "api.vapi.propose-office-slot",
    event_type: "TOOL_CALL_RECEIVED",
    tool_name: "propose_office_slot",
    tool_payload: toolPayload,
  });

  // Read attempt EARLY so demo mode routing works everywhere (includes demo_retry_count)
  const { data: attemptRow, error: attemptReadErr } = await supabaseAdmin
    .from("schedule_attempts")
    .select("id, demo_autoconfirm, demo_retry_count")
    .eq("id", attemptIdStr)
    .maybeSingle();

  if (attemptReadErr || !attemptRow) {
    return {
      toolCallId,
      result: JSON.stringify({
        status: "ERROR",
        code: "ATTEMPT_NOT_FOUND",
        message_to_say: "There was a system issue. I will call back shortly.",
        next_action: "END_CALL",
      }),
    };
  }

  const demoAutoconfirm = attemptRow.demo_autoconfirm === true;
  const demoRetryCount = Number((attemptRow as any).demo_retry_count ?? 0);

  async function bumpDemoRetryAndMaybeEnd(why: string) {
    if (!demoAutoconfirm) return null;

    const nextCount = demoRetryCount + 1;

    try {
      await supabaseAdmin
        .from("schedule_attempts")
        .update({ demo_retry_count: nextCount })
        .eq("id", attemptIdStr);
    } catch {
      // never block tool flow
    }

    if (nextCount >= 3) {
      return {
        status: "OK",
        code: "DEMO_RETRY_LIMIT",
        message_to_say: "I’m going to call back shortly to confirm a time. Thank you.",
        next_action: "END_CALL",
        demo_retry_count: nextCount,
        demo_retry_reason: why,
      };
    }

    return null;
  }

  // Demo-safe handling of missing proposal
  if (!proposalId || proposalId === "proposal_id") {
    if (demoAutoconfirm) {
      const maybeEnd = await bumpDemoRetryAndMaybeEnd("missing_or_placeholder_proposal_id");
      if (maybeEnd) {
        return {
          toolCallId: toolCallId || "missing_toolCallId",
          result: JSON.stringify(maybeEnd),
        };
      }

      const resp = {
        status: "OK",
        code: "NEED_SPECIFIC_TIME",
        message_to_say: "Great — what’s the earliest specific day and time you have available?",
        next_action: "WAIT_FOR_OFFICE_TIME",
        demo_retry_count: demoRetryCount + 1,
      };

      return { toolCallId, result: JSON.stringify(resp) };
    }

    const resp = {
      status: "ERROR",
      code: "INVALID_PROPOSAL_ID",
      message_to_say: "Please choose one of the options by saying first, second, or third.",
      next_action: "ASK_USER_TO_CHOOSE_SLOT",
    };

    return { toolCallId, result: JSON.stringify(resp) };
  }

  const { data: proposal, error: proposalErr } = await supabaseAdmin
    .from("proposals")
    .select("id, attempt_id, normalized_start, normalized_end, timezone, payload")
    .eq("id", proposalId)
    .eq("attempt_id", attemptIdStr)
    .single();

  if (proposalErr || !proposal) {
    if (demoAutoconfirm) {
      const maybeEnd = await bumpDemoRetryAndMaybeEnd("proposal_not_found");
      if (maybeEnd) return { toolCallId, result: JSON.stringify(maybeEnd) };

      const resp = {
        status: "OK",
        code: "NEED_SPECIFIC_TIME",
        message_to_say: "Sorry — I didn’t catch the exact slot. What’s the earliest specific day and time you have available?",
        next_action: "WAIT_FOR_OFFICE_TIME",
        demo_retry_count: demoRetryCount + 1,
      };

      return { toolCallId, result: JSON.stringify(resp) };
    }

    const resp = {
      status: "ERROR",
      code: "PROPOSAL_NOT_FOUND",
      message_to_say: "I couldn’t find the selected time. Please say first, second, or third.",
      next_action: "ASK_USER_TO_CHOOSE_SLOT",
    };

    return { toolCallId, result: JSON.stringify(resp) };
  }

  const tz = String(proposal.timezone ?? (proposal as any)?.payload?.timezone ?? "America/New_York");

  const spokenStart =
    String((proposal as any)?.payload?.spoken_start ?? "").trim() || formatForSpeechFromIso(proposal.normalized_start);

  // Reset demo retry counter on success (best-effort)
  if (demoAutoconfirm) {
    try {
      await supabaseAdmin.from("schedule_attempts").update({ demo_retry_count: 0 }).eq("id", attemptIdStr);
    } catch {
      // ignore
    }
  }

  const response = {
    status: "OK",
    proposal_id: proposal.id,
    normalized_start: proposal.normalized_start,
    normalized_end: proposal.normalized_end,
    timezone: tz,
    conflict: false,
    message_to_say: demoAutoconfirm ? `That works. Let’s book ${spokenStart}.` : `Great — I have ${spokenStart} recorded.`,
    next_action: demoAutoconfirm ? "CONFIRM_BOOKING" : "WAIT_FOR_USER_APPROVAL",
  };

  return { toolCallId, result: JSON.stringify(response) };
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => ({}))) as VapiToolCallsBody;

  const msgType = raw?.message?.type;
  const toolCalls = raw?.message?.toolCalls;

  if (msgType === "tool-calls" && Array.isArray(toolCalls) && toolCalls.length > 0) {
    const results: VapiToolResultEnvelope[] = [];

    for (const tc of toolCalls) {
      const toolCallId = String(tc?.id ?? "").trim() || "missing_toolCallId";
      const fnName = String(tc?.function?.name ?? "").trim();
      const args = safeParseArgs(tc?.function?.arguments);

      if (fnName !== "propose_office_slot") continue;

      results.push(await handleOne(toolCallId, args as ProposeOfficeSlotArgs));
    }

    if (results.length === 0) {
      return jsonToolResults([
        {
          toolCallId: "no_matching_tool",
          result: JSON.stringify({
            status: "ERROR",
            code: "NO_MATCHING_TOOL_CALL",
            message_to_say: "There was a system issue. I will call back shortly.",
            next_action: "END_CALL",
          }),
        },
      ]);
    }

    return jsonToolResults(results);
  }

  const toolCallId = String(raw?.toolCallId || raw?.tool_call_id || raw?.id || "local_call").trim();

  const args = raw as any as ProposeOfficeSlotArgs;
  const one = await handleOne(toolCallId, args);
  return jsonToolResults([one]);
}