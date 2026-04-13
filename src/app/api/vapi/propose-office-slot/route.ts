export const dynamic = 'force-dynamic';
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getAvailabilityContext } from "../../../../lib/availability";
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
  office_offer_raw_text?: string;
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

function ordinal(n: number) {
  const v = n % 100;

  if (v >= 11 && v <= 13) {
    return `${n}th`;
  }

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatForSpeechFromIso(iso: string) {
  const d = new Date(iso);
  const tz = "America/New_York";

  const month = d.toLocaleDateString("en-US", {
    month: "long",
    timeZone: tz,
  });

  const dayNum = Number(
    d.toLocaleDateString("en-US", {
      day: "numeric",
      timeZone: tz,
    })
  );

  const time = d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    })
    .replace(":00 ", " ");

  return `${month} ${ordinal(dayNum)} at ${time}`;
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

  let proposalId = String(args?.proposal_id ?? args?.proposalId ?? "").trim();
  const officeOfferRawText = String(args?.office_offer_raw_text ?? "").trim();

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

  const { data: attemptRow, error: attemptReadErr } = await supabaseAdmin
    .from("schedule_attempts")
    .select("id, app_user_id, demo_autoconfirm, demo_retry_count, metadata")
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

  const appUserId = String(attemptRow.app_user_id ?? "").trim();
  const demoAutoconfirm = attemptRow.demo_autoconfirm === true;
  const demoRetryCount = Number((attemptRow as any).demo_retry_count ?? 0);

  async function bumpDemoRetryAndMaybeEnd(why: string) {
    if (!demoAutoconfirm) {
      return null;
    }

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
        message_to_say:
          "I’m going to call back shortly to confirm a time. Thank you.",
        next_action: "END_CALL",
        demo_retry_count: nextCount,
        demo_retry_reason: why,
      };
    }

    return null;
  }

  // If no proposal_id but we have office_offer_raw_text, create a proposal on the fly
  if ((!proposalId || proposalId === "proposal_id") && officeOfferRawText) {
    try {
      // Parse the raw text into a date/time using chrono-style heuristics
      const now = new Date();
      const timezone = "America/New_York";

      // Simple date parsing for common patterns
      let parsedStart: Date | null = null;

      // FIRST: Check for day-of-week patterns ("Friday at noon", "this Tuesday at 2pm")
      // Must check this BEFORE generic Date constructor which can misparse these
      const dayMatch = officeOfferRawText.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);

      if (dayMatch) {
        // This is a relative date — handle it directly
      } else {
        // No day-of-week — try parsing as absolute date
        // Only use Date constructor for strings with month names or numbers, not day names
        const withYear = officeOfferRawText.match(/\d{4}/) ? officeOfferRawText : `${officeOfferRawText} ${now.getFullYear()}`;
        const attempt = new Date(withYear);
        if (!isNaN(attempt.getTime()) && attempt.getFullYear() >= now.getFullYear()) {
          parsedStart = attempt;
        }
      }

      // Handle relative dates like "this Friday at noon", "Friday at 2pm"
      if (!parsedStart) {
        const timeMatch = officeOfferRawText.match(/\b(noon|midnight|(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)\b/i);

        if (dayMatch) {
          const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
          const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
          const currentDay = now.getDay();
          let daysAhead = targetDay - currentDay;
          if (daysAhead <= 0) daysAhead += 7;

          parsedStart = new Date(now);
          parsedStart.setDate(now.getDate() + daysAhead);

          if (timeMatch) {
            if (timeMatch[1].toLowerCase() === "noon") {
              parsedStart.setHours(12, 0, 0, 0);
            } else if (timeMatch[1].toLowerCase() === "midnight") {
              parsedStart.setHours(0, 0, 0, 0);
            } else {
              let hours = parseInt(timeMatch[2] || "9");
              const minutes = parseInt(timeMatch[3] || "0");
              const ampm = (timeMatch[4] || "").toLowerCase();
              if (ampm === "pm" && hours < 12) hours += 12;
              if (ampm === "am" && hours === 12) hours = 0;
              if (!ampm && hours < 8) hours += 12; // assume PM for small numbers
              parsedStart.setHours(hours, minutes, 0, 0);
            }
          } else {
            parsedStart.setHours(9, 0, 0, 0); // default to 9am
          }
        }
      }

      // Handle month + day patterns like "June 17" or "August 1st"
      if (!parsedStart) {
        const monthDayMatch = officeOfferRawText.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i);
        if (monthDayMatch) {
          const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
          const month = monthNames.indexOf(monthDayMatch[1].toLowerCase());
          const day = parseInt(monthDayMatch[2]);
          parsedStart = new Date(now.getFullYear(), month, day, 9, 0, 0);
          if (parsedStart < now) parsedStart.setFullYear(now.getFullYear() + 1);

          const timeMatch2 = officeOfferRawText.match(/\b(noon|(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)\b/i);
          if (timeMatch2) {
            if (timeMatch2[1].toLowerCase() === "noon") {
              parsedStart.setHours(12, 0, 0, 0);
            } else {
              let h = parseInt(timeMatch2[2] || "9");
              const m = parseInt(timeMatch2[3] || "0");
              const ap = (timeMatch2[4] || "").toLowerCase();
              if (ap === "pm" && h < 12) h += 12;
              if (ap === "am" && h === 12) h = 0;
              if (!ap && h < 8) h += 12;
              parsedStart.setHours(h, m, 0, 0);
            }
          }
        }
      }

      if (!parsedStart) {
        return {
          toolCallId,
          result: JSON.stringify({
            status: "OK",
            code: "COULD_NOT_PARSE_TIME",
            message_to_say: "I didn’t quite catch the specific date and time. Could you give me the month, day, and time?",
            next_action: "WAIT_FOR_OFFICE_TIME",
          }),
        };
      }

      const normalizedStart = parsedStart.toISOString();
      const endDate = new Date(parsedStart.getTime() + 30 * 60 * 1000);
      const normalizedEnd = endDate.toISOString();

      // Create a proposal record
      const { data: newProposal, error: createErr } = await supabaseAdmin
        .from("proposals")
        .insert({
          attempt_id: attemptIdStr,
          provider_id: providerIdUuid,
          office_offer_raw_text: officeOfferRawText,
          normalized_start: normalizedStart,
          normalized_end: normalizedEnd,
          timezone,
          status: "PROPOSED",
        })
        .select("id")
        .single();

      if (createErr || !newProposal?.id) {
        return {
          toolCallId,
          result: JSON.stringify({
            status: "ERROR",
            code: "PROPOSAL_CREATE_FAILED",
            message_to_say: "There was a system issue. I will call back shortly.",
            next_action: "END_CALL",
          }),
        };
      }

      // Use the newly created proposal_id to continue the normal flow
      proposalId = newProposal.id;
    } catch (e) {
      return {
        toolCallId,
        result: JSON.stringify({
          status: "ERROR",
          code: "PARSE_ERROR",
          message_to_say: "I had trouble with that time. Could you give me the date and time again?",
          next_action: "WAIT_FOR_OFFICE_TIME",
        }),
      };
    }
  }

  if (!proposalId || proposalId === "proposal_id") {
    if (demoAutoconfirm) {
      const maybeEnd = await bumpDemoRetryAndMaybeEnd(
        "missing_or_placeholder_proposal_id"
      );

      if (maybeEnd) {
        return {
          toolCallId: toolCallId || "missing_toolCallId",
          result: JSON.stringify(maybeEnd),
        };
      }

      return {
        toolCallId,
        result: JSON.stringify({
          status: "OK",
          code: "NEED_SPECIFIC_TIME",
          message_to_say:
            "Great — what’s the earliest specific day and time you have available?",
          next_action: "WAIT_FOR_OFFICE_TIME",
          demo_retry_count: demoRetryCount + 1,
        }),
      };
    }

    return {
      toolCallId,
      result: JSON.stringify({
        status: "ERROR",
        code: "INVALID_PROPOSAL_ID",
        message_to_say:
          "Please choose one of the options by saying first, second, or third.",
        next_action: "ASK_USER_TO_CHOOSE_SLOT",
      }),
    };
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

      if (maybeEnd) {
        return { toolCallId, result: JSON.stringify(maybeEnd) };
      }

      return {
        toolCallId,
        result: JSON.stringify({
          status: "OK",
          code: "NEED_SPECIFIC_TIME",
          message_to_say:
            "Sorry — I didn’t catch the exact slot. What’s the earliest specific day and time you have available?",
          next_action: "WAIT_FOR_OFFICE_TIME",
          demo_retry_count: demoRetryCount + 1,
        }),
      };
    }

    return {
      toolCallId,
      result: JSON.stringify({
        status: "ERROR",
        code: "PROPOSAL_NOT_FOUND",
        message_to_say:
          "I couldn’t find the selected time. Please say first, second, or third.",
        next_action: "ASK_USER_TO_CHOOSE_SLOT",
      }),
    };
  }

  const proposalStart = String(proposal.normalized_start ?? "").trim();
  const proposalEnd = String(proposal.normalized_end ?? "").trim();
  const tz = String(
    proposal.timezone ?? (proposal as any)?.payload?.timezone ?? "America/New_York"
  );

  if (!proposalStart || !proposalEnd) {
    return {
      toolCallId,
      result: JSON.stringify({
        status: "ERROR",
        code: "PROPOSAL_MISSING_NORMALIZED_TIMES",
        message_to_say: "There was a system issue. I will call back shortly.",
        next_action: "END_CALL",
      }),
    };
  }

  if (!appUserId) {
    return {
      toolCallId,
      result: JSON.stringify({
        status: "ERROR",
        code: "MISSING_APP_USER_ID",
        message_to_say: "There was a system issue. I will call back shortly.",
        next_action: "END_CALL",
      }),
    };
  }

  const availability = await getAvailabilityContext({
    app_user_id: appUserId,
    window_start: proposalStart,
    window_end: proposalEnd,
    timezone: tz,
    include_sources: ["GOOGLE_CALENDAR"],
    proposed_slot: {
      start_at: proposalStart,
      end_at: proposalEnd,
      timezone: tz,
    },
  });

  if (availability.decision?.status === "CONFLICT") {
    const conflictingBlocks = availability.blocks.filter((block) =>
      availability.decision?.blocking_block_ids.includes(block.id)
    );
    const spokenConflictTime = formatForSpeechFromIso(proposalStart);

    await supabaseAdmin
      .from("schedule_attempts")
      .update({
        metadata: {
          ...(typeof attemptRow.metadata === "object" && attemptRow.metadata
            ? attemptRow.metadata
            : {}),
          last_event: "UNEXPECTED_CONFLICT_AT_PROPOSE",
          conflicting_blocks: conflictingBlocks,
          conflicting_proposal_id: proposal.id,
          conflicting_start: proposalStart,
          conflicting_end: proposalEnd,
          availability_context: availability,
        },
      })
      .eq("id", attemptIdStr);

    return {
      toolCallId,
      result: JSON.stringify({
        status: "CONFLICT",
        code: "UNEXPECTED_CONFLICT",
        proposal_id: proposal.id,
        normalized_start: proposalStart,
        normalized_end: proposalEnd,
        timezone: tz,
        conflict: true,
        conflicting_blocks: conflictingBlocks,
        message_to_say: `That time is no longer available${
  spokenConflictTime ? ` at ${spokenConflictTime}` : ""
}. Could we look at another time?`,
        next_action: "REQUEST_ALTERNATE_SLOT",
      }),
    };
  }

  if (availability.decision?.status === "INVALID") {
    return {
      toolCallId,
      result: JSON.stringify({
        status: "ERROR",
        code: "INVALID_PROPOSED_SLOT",
        message_to_say: "There was a system issue. I will call back shortly.",
        next_action: "END_CALL",
      }),
    };
  }

  if (availability.decision?.status === "OUTSIDE_WINDOW") {
    return {
      toolCallId,
      result: JSON.stringify({
        status: "CONFLICT",
        code: "OUTSIDE_BOOKING_RULES",
        proposal_id: proposal.id,
        normalized_start: proposalStart,
        normalized_end: proposalEnd,
        timezone: tz,
        conflict: true,
        message_to_say:
          "That time does not fit the patient's scheduling rules. Could we look at another time?",
        next_action: "REQUEST_ALTERNATE_SLOT",
      }),
    };
  }

  const spokenStart =
    String((proposal as any)?.payload?.spoken_start ?? "").trim() ||
    formatForSpeechFromIso(proposal.normalized_start);

  if (demoAutoconfirm) {
    try {
      await supabaseAdmin
        .from("schedule_attempts")
        .update({ demo_retry_count: 0 })
        .eq("id", attemptIdStr);
    } catch {
      // ignore
    }
  }

  return {
    toolCallId,
    result: JSON.stringify({
      status: "OK",
      proposal_id: proposal.id,
      normalized_start: proposal.normalized_start,
      normalized_end: proposal.normalized_end,
      timezone: tz,
      conflict: false,
      message_to_say: demoAutoconfirm
        ? `That works. Let’s book ${spokenStart}.`
        : `Great — I have ${spokenStart} recorded.`,
      next_action: demoAutoconfirm
        ? "CONFIRM_BOOKING"
        : "WAIT_FOR_USER_APPROVAL",
    }),
  };
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => ({}))) as VapiToolCallsBody;

  const msgType = raw?.message?.type;
  const toolCalls = raw?.message?.toolCalls;

  if (
    msgType === "tool-calls" &&
    Array.isArray(toolCalls) &&
    toolCalls.length > 0
  ) {
    const results: VapiToolResultEnvelope[] = [];

    for (const tc of toolCalls) {
      const toolCallId = String(tc?.id ?? "").trim() || "missing_toolCallId";
      const fnName = String(tc?.function?.name ?? "").trim();
      const args = safeParseArgs(tc?.function?.arguments);

      if (fnName !== "propose_office_slot") {
        continue;
      }

      results.push(await handleOne(toolCallId, args as ProposeOfficeSlotArgs));
    }

    if (results.length === 0) {
      return jsonToolResults([
        {
          toolCallId: "no_matching_tool",
          result: JSON.stringify({
            status: "ERROR",
            code: "NO_MATCHING_TOOL_CALL",
            message_to_say:
              "There was a system issue. I will call back shortly.",
            next_action: "END_CALL",
          }),
        },
      ]);
    }

    return jsonToolResults(results);
  }

  const toolCallId = String(
    raw?.toolCallId || raw?.tool_call_id || raw?.id || "local_call"
  ).trim();

  const args = raw as any as ProposeOfficeSlotArgs;
  const one = await handleOne(toolCallId, args);
  return jsonToolResults([one]);
}