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

// --- Timezone resolution by provider state ---

const ET_STATES = new Set([
  "NY","CT","MA","NJ","PA","VA","MD","DC","NC","SC","GA","FL",
  "OH","MI","IN","WV","VT","NH","ME","RI","DE","KY","TN",
]);
const CT_STATES = new Set([
  "IL","WI","MN","MO","IA","AR","LA","MS","AL","OK","KS","NE","SD","ND","TX",
]);
const MT_STATES = new Set([
  "MT","WY","CO","NM","AZ","UT","ID",
]);
const PT_STATES = new Set([
  "CA","OR","WA","NV",
]);

function getTimezoneOffsetForState(state: string | null | undefined): {
  offset: number;
  timezone: string;
} {
  if (!state) return { offset: -4, timezone: "America/New_York" };
  const s = state.toUpperCase().trim();
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const isDST = month >= 4 && month <= 10; // April through October = daylight time

  if (ET_STATES.has(s)) {
    return { offset: isDST ? -4 : -5, timezone: "America/New_York" };
  }
  if (CT_STATES.has(s)) {
    return { offset: isDST ? -5 : -6, timezone: "America/Chicago" };
  }
  if (MT_STATES.has(s)) {
    // Arizona doesn't observe DST
    if (s === "AZ") return { offset: -7, timezone: "America/Phoenix" };
    return { offset: isDST ? -6 : -7, timezone: "America/Denver" };
  }
  if (PT_STATES.has(s)) {
    return { offset: isDST ? -7 : -8, timezone: "America/Los_Angeles" };
  }
  // Default to ET
  return { offset: isDST ? -4 : -5, timezone: "America/New_York" };
}

async function resolveProviderTimezone(providerIdUuid: string | null): Promise<{
  offset: number;
  timezone: string;
}> {
  if (!providerIdUuid) return getTimezoneOffsetForState(null);

  try {
    const { data } = await supabaseAdmin
      .from("providers")
      .select("state")
      .eq("id", providerIdUuid)
      .maybeSingle();

    return getTimezoneOffsetForState(data?.state || null);
  } catch {
    return getTimezoneOffsetForState(null);
  }
}

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

// Normalize spoken time phrases ("three forty five PM", "two thirty", "noon")
// to digit form ("3:45 PM", "2:30", "12:00 PM") so the downstream HH(:MM)? regex
// can pick them up. TTS-rendered transcripts almost always speak times in words,
// so without this every "Monday at three forty five PM" trips the NEED_TIME branch.
function normalizeTimeWords(text: string): string {
  if (!text) return text;
  let s = text;

  const hourWords: Record<string, string> = {
    one: "1", two: "2", three: "3", four: "4", five: "5",
    six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
    eleven: "11", twelve: "12",
  };

  // Compound minute phrases — order matters (longest first so "twenty five" is
  // caught before "twenty"). The right-hand side is a zero-padded minute string.
  const compoundMinutes: Array<[string, string]> = [
    ["o'?\\s*clock", "00"],
    ["fifty\\s+five", "55"],
    ["fifty", "50"],
    ["forty\\s+five", "45"],
    ["forty", "40"],
    ["thirty\\s+five", "35"],
    ["thirty", "30"],
    ["twenty\\s+five", "25"],
    ["twenty", "20"],
    ["fifteen", "15"],
    ["ten", "10"],
    ["oh\\s+five", "05"],
    ["five", "05"],
  ];

  // "<hour-word> <minute-phrase> [am|pm]" → "H:MM AM/PM"
  for (const [hw, hd] of Object.entries(hourWords)) {
    for (const [mw, md] of compoundMinutes) {
      const re = new RegExp(
        `\\b${hw}\\s+${mw}\\s*(a\\.?m\\.?|p\\.?m\\.?)?\\b`,
        "gi",
      );
      s = s.replace(re, (_full, ap) => `${hd}:${md}${ap ? ` ${ap}` : ""}`);
    }
  }

  // "<hour-word> [am|pm]" (no minute) → "H AM/PM" — leave for the existing parser
  for (const [hw, hd] of Object.entries(hourWords)) {
    s = s.replace(
      new RegExp(`\\b${hw}\\s+(a\\.?m\\.?|p\\.?m\\.?)\\b`, "gi"),
      `${hd} $1`,
    );
    s = s.replace(new RegExp(`\\bat\\s+${hw}\\b`, "gi"), `at ${hd}`);
  }

  s = s.replace(/\bnoon\b/gi, "12:00 PM");
  s = s.replace(/\bmidnight\b/gi, "12:00 AM");

  return s;
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
  // parsableText is officeOfferRawText with spoken time phrases pre-normalized.
  // All time-regex matching below should use parsableText so word-form times like
  // "three forty five PM" don't trip the NEED_TIME branch.
  const parsableText = normalizeTimeWords(officeOfferRawText);

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

  // Tolerate stale/hallucinated proposal_id: if Kate hands us a proposal_id that
  // doesn't exist in the DB AND we also have raw office text, drop the bad id so
  // the create-from-raw-text branch below runs instead of looping on PROPOSAL_NOT_FOUND.
  if (proposalId && proposalId !== "proposal_id" && officeOfferRawText) {
    const { data: probe } = await supabaseAdmin
      .from("proposals")
      .select("id")
      .eq("id", proposalId)
      .eq("attempt_id", attemptIdStr)
      .maybeSingle();
    if (!probe) {
      console.log("PROPOSE_STALE_PROPOSAL_ID:", { attemptIdStr, proposalId, willRecreate: true });
      proposalId = "";
    }
  }

  // If no proposal_id but we have office_offer_raw_text, create a proposal on the fly
  if ((!proposalId || proposalId === "proposal_id") && officeOfferRawText) {
    try {
      // Parse the raw text into a date/time
      // Resolve timezone from provider's state (NPI data) instead of hardcoding ET
      const providerTz = await resolveProviderTimezone(providerIdUuid);
      const ET_OFFSET_HOURS = providerTz.offset;
      const now = new Date();
      const timezone = providerTz.timezone;

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
        // Extract any number and assume it's a day of the current or next month.
        // Run dayNumMatch on the ORIGINAL raw text so a time like "at 3 PM" doesn't
        // get mistaken for a day-of-month (e.g. "the twentieth at 3 PM" should
        // resolve to day=20 from wordNumMatch, not day=3 from a stray time digit).
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

          // parsableText already has compound time words pre-normalized.
          const timeText = parsableText;

          // Check for time — if no time given, ask for it instead of defaulting to 9AM
          const tMatch = timeText.match(/\b(noon|midnight|(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?)\b/i);
          if (!tMatch) {
            // Build a spoken date for the response
            const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
            const spokenDate = `${monthNames[month]} ${ordinal(dayNum)}`;
            return {
              toolCallId,
              result: JSON.stringify({
                status: "OK",
                code: "NEED_TIME",
                message_to_say: `Got it — what time on ${spokenDate} works best?`,
                next_action: "WAIT_FOR_OFFICE_TIME",
              }),
            };
          }

          parsedStart = new Date(Date.UTC(year, month, dayNum, 9 - ET_OFFSET_HOURS, 0, 0));

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

      // Handle relative dates like "this Friday at noon", "Friday at 2pm".
      // BUT: if the offer also contains an explicit month name, skip this branch
      // and let the month+day branch below handle it. The month+day form is more
      // specific — "Monday, May 5" should resolve to May 5 even if May 5 isn't a
      // Monday in the current year (offices misspeak; the calendar date wins).
      if (!parsedStart && !hasMonthName) {
        const timeMatch = parsableText.match(/\b(noon|midnight|(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)\b/i);

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
            // No time given — ask for it instead of defaulting to 9AM
            const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
            const spokenDay = dayNames[parsedStart.getDay()];
            return {
              toolCallId,
              result: JSON.stringify({
                status: "OK",
                code: "NEED_TIME",
                message_to_say: `Got it — what time on ${spokenDay} works best?`,
                next_action: "WAIT_FOR_OFFICE_TIME",
              }),
            };
          }
        }
      }

      // Handle month + day patterns like "June 17", "August 1st", "April twenty first"
      if (!parsedStart && hasMonthName) {
        const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
        const monthOnlyMatch = officeOfferRawText.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
        if (monthOnlyMatch) {
          const month = monthNames.indexOf(monthOnlyMatch[1].toLowerCase());

          // Try digit day first — must use the raw text, not parsableText, so a
          // time like "at three PM" → "at 3 PM" doesn't get misread as day=3
          // when the actual day is "twenty first" matched below by wordday.
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
            const timeMatch2 = parsableText.match(/\b(noon|midnight|(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)\b/i);
            if (!timeMatch2) {
              // No time given — ask for it instead of defaulting to 9AM
              const spokenDate = `${monthOnlyMatch![1]} ${ordinal(day)}`;
              return {
                toolCallId,
                result: JSON.stringify({
                  status: "OK",
                  code: "NEED_TIME",
                  message_to_say: `Got it — what time on ${spokenDate} works best?`,
                  next_action: "WAIT_FOR_OFFICE_TIME",
                }),
              };
            }

            // Create date in UTC with ET offset
            parsedStart = new Date(Date.UTC(now.getFullYear(), month, day, 9 - ET_OFFSET_HOURS, 0, 0));
            if (parsedStart < now) parsedStart.setFullYear(now.getFullYear() + 1);

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
      message_to_say: `${spokenStart} works. Let’s go with that.`,
      next_action: "CONFIRM_BOOKING",
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