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
      // Parse the raw text into a date/time
      // Use Eastern Time offset to ensure correct local time
      const ET_OFFSET_HOURS = -4; // EDT (April-November). TODO: handle EST (-5) in winter
      const now = new Date();
      const timezone = "America/New_York";

      // Simple date parsing for common patterns
      let parsedStart: Date | null = null;

      // FIRST: Check for day-of-week patterns ("Friday at noon", "this Tuesday at 2pm")
      // Must check this BEFORE generic Date constructor which can misparse these
      const dayMatch = officeOfferRawText.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);

      // Only try the month+day parser or day-of-week parser — NEVER the generic Date constructor
      // Date constructor is too permissive ("the twenty first" → Jan 1 instead of failing)
      const hasMonthName = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(officeOfferRawText);

      if (!dayMatch && hasMonthName) {
        // Has a month name — parse as month + day (handled below in the month+day section)
      } else if (!dayMatch && !hasMonthName) {
        // No day-of-week and no month name — might be "the 21st" or "the twenty first"
        // Extract any number and assume it's a day of the current or next month
        const dayNumMatch = officeOfferRawText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
        const wordNumMatch = officeOfferRawText.match(/\b(twenty[- ]?first|twenty[- ]?second|twenty[- ]?third|twenty[- ]?fourth|twenty[- ]?fifth|twenty[- ]?sixth|twenty[- ]?seventh|twenty[- ]?eighth|twenty[- ]?ninth|thirtieth|thirty[- ]?first|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)\b/i);

        let dayNum: number | null = null;
        if (dayNumMatch) {
          dayNum = parseInt(dayNumMatch[1]);
        } else if (wordNumMatch) {
          const wordToNum: Record<string, number> = {
            first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10,
            eleventh:11,twelfth:12,thirteenth:13,fourteenth:14,fifteenth:15,sixteenth:16,
            seventeenth:17,eighteenth:18,nineteenth:19,twentieth:20,
          };
          const w = wordNumMatch[1].toLowerCase().replace(/[- ]/g, " ").trim();
          if (w.startsWith("twenty")) {
            const suffix = w.replace("twenty", "").trim();
            dayNum = 20 + (wordToNum[suffix] || 0);
          } else if (w.startsWith("thirty")) {
            const suffix = w.replace("thirty", "").trim();
            dayNum = 30 + (wordToNum[suffix] || 0);
          } else {
            dayNum = wordToNum[w] || null;
          }
        }

        if (dayNum && dayNum >= 1 && dayNum <= 31) {
          // Assume current month, or next month if the day has passed
          let month = now.getMonth();
          let year = now.getFullYear();
          const testDate = new Date(Date.UTC(year, month, dayNum, 9 - ET_OFFSET_HOURS, 0, 0));
          if (testDate < now) {
            month++;
            if (month > 11) { month = 0; year++; }
          }
          parsedStart = new Date(Date.UTC(year, month, dayNum, 9 - ET_OFFSET_HOURS, 0, 0));

          // Check for time
          const tMatch = officeOfferRawText.match(/\b(noon|(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)\b/i);
          if (tMatch) {
            let h = 9;
            if (tMatch[1].toLowerCase() === "noon") { h = 12; }
            else {
              h = parseInt(tMatch[2] || "9");
              const m2 = parseInt(tMatch[3] || "0");
              const ap = (tMatch[4] || "").toLowerCase();
              if (ap === "pm" && h < 12) h += 12;
              if (ap === "am" && h === 12) h = 0;
              if (!ap && h < 8) h += 12;
              parsedStart.setUTCHours(h - ET_OFFSET_HOURS, m2, 0, 0);
            }
            if (tMatch[1].toLowerCase() === "noon") {
              parsedStart.setUTCHours(12 - ET_OFFSET_HOURS, 0, 0, 0);
            }
          }
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
            let localHours = 9;
            let localMinutes = 0;
            if (timeMatch[1].toLowerCase() === "noon") {
              localHours = 12;
            } else if (timeMatch[1].toLowerCase() === "midnight") {
              localHours = 0;
            } else {
              localHours = parseInt(timeMatch[2] || "9");
              localMinutes = parseInt(timeMatch[3] || "0");
              const ampm = (timeMatch[4] || "").toLowerCase();
              if (ampm === "pm" && localHours < 12) localHours += 12;
              if (ampm === "am" && localHours === 12) localHours = 0;
              if (!ampm && localHours < 8) localHours += 12; // assume PM for small numbers
            }
            // Convert local ET to UTC for storage
            parsedStart.setUTCHours(localHours - ET_OFFSET_HOURS, localMinutes, 0, 0);
          } else {
            parsedStart.setUTCHours(9 - ET_OFFSET_HOURS, 0, 0, 0); // default to 9am ET
          }
        }
      }

      // Handle month + day patterns like "June 17", "August 1st", "April twenty first"
      if (!parsedStart && hasMonthName) {
        const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
        const monthOnlyMatch = officeOfferRawText.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
        if (monthOnlyMatch) {
          const month = monthNames.indexOf(monthOnlyMatch[1].toLowerCase());

          // Try digit day first
          const digitDay = officeOfferRawText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
          let day: number | null = digitDay ? parseInt(digitDay[1]) : null;

          // Try word day — check compound words (twenty first) BEFORE single words (first)
          if (!day) {
            const compoundDays: [string, number][] = [
              ["thirty first",31],["thirtieth",30],
              ["twenty ninth",29],["twenty eighth",28],["twenty seventh",27],
              ["twenty sixth",26],["twenty fifth",25],["twenty fourth",24],
              ["twenty third",23],["twenty second",22],["twenty first",21],
              ["twentieth",20],["nineteenth",19],["eighteenth",18],["seventeenth",17],
              ["sixteenth",16],["fifteenth",15],["fourteenth",14],["thirteenth",13],
              ["twelfth",12],["eleventh",11],["tenth",10],["ninth",9],["eighth",8],
              ["seventh",7],["sixth",6],["fifth",5],["fourth",4],["third",3],
              ["second",2],["first",1],
            ];
            const lower = officeOfferRawText.toLowerCase();
            for (const [word, num] of compoundDays) {
              if (lower.includes(word)) { day = num; break; }
            }
          }

          if (day && day >= 1 && day <= 31) {
            // Create date in UTC with ET offset
            parsedStart = new Date(Date.UTC(now.getFullYear(), month, day, 9 - ET_OFFSET_HOURS, 0, 0));
            if (parsedStart < now) parsedStart.setFullYear(now.getFullYear() + 1);

            const timeMatch2 = officeOfferRawText.match(/\b(noon|(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)\b/i);
            if (timeMatch2) {
              let lh = 9;
              let lm = 0;
              if (timeMatch2[1].toLowerCase() === "noon") {
                lh = 12;
              } else {
                lh = parseInt(timeMatch2[2] || "9");
                lm = parseInt(timeMatch2[3] || "0");
                const ap = (timeMatch2[4] || "").toLowerCase();
                if (ap === "pm" && lh < 12) lh += 12;
                if (ap === "am" && lh === 12) lh = 0;
                if (!ap && lh < 8) lh += 12;
              }
              parsedStart.setUTCHours(lh - ET_OFFSET_HOURS, lm, 0, 0);
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