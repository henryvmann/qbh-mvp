import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getAvailabilityContext } from "../../../../lib/availability";
import { generateSlots } from "../../../../lib/availability/generate-slots";
import { normalizeAttemptId } from "../../../../lib/vapi/ids";

type JsonRecord = Record<string, unknown>;

type VapiToolResultEnvelope = {
  toolCallId: string;
  result: string;
};

type VapiToolCallsBody = {
  message?: {
    type?: string;
    toolCalls?: Array<{
      id?: string;
      function?: { name?: string; arguments?: string | Record<string, unknown> };
    }>;
  };
  toolCallId?: string;
  tool_call_id?: string;
  id?: string;
  attempt_id?: unknown;
};

type AttemptLookupRow = {
  id: number;
  app_user_id: string | null;
  demo_autoconfirm: boolean | null;
  metadata: unknown;
};

type ExistingBookingContext = {
  source_attempt_id: number;
  booking_summary: {
    status: "BOOKED_CONFIRMED";
    timezone: string | null;
    provider_id: string | null;
    display_time: string | null;
    appointment_start: string | null;
    appointment_end: string | null;
    calendar_event_id: string | null;
  };
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function jsonToolResults(results: VapiToolResultEnvelope[]) {
  return Response.json({ results });
}

function safeParseArgs(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function toolError(
  toolCallId: string,
  debug?: Record<string, unknown>
): VapiToolResultEnvelope {
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

function getFlowMode(metadata: unknown): "BOOK" | "ADJUST" {
  const record = asRecord(metadata);
  return String(record?.flow_mode || "").trim().toUpperCase() === "ADJUST"
    ? "ADJUST"
    : "BOOK";
}

function getExistingBookingContext(
  metadata: unknown
): ExistingBookingContext | null {
  const record = asRecord(metadata);
  const existingBooking = asRecord(record?.existing_booking);
  const bookingSummary = asRecord(existingBooking?.booking_summary);

  const sourceAttemptIdRaw = existingBooking?.source_attempt_id;
  const sourceAttemptId =
    typeof sourceAttemptIdRaw === "number"
      ? sourceAttemptIdRaw
      : typeof sourceAttemptIdRaw === "string" && sourceAttemptIdRaw.trim()
      ? Number(sourceAttemptIdRaw)
      : NaN;

  if (!Number.isFinite(sourceAttemptId) || !bookingSummary) return null;

  return {
    source_attempt_id: sourceAttemptId,
    booking_summary: {
      status: "BOOKED_CONFIRMED",
      timezone: asNullableString(bookingSummary.timezone),
      provider_id: asNullableString(bookingSummary.provider_id),
      display_time: asNullableString(bookingSummary.display_time),
      appointment_start: asNullableString(bookingSummary.appointment_start),
      appointment_end: asNullableString(bookingSummary.appointment_end),
      calendar_event_id: asNullableString(bookingSummary.calendar_event_id),
    },
  };
}

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const ORDINAL_DAY: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty-first": 21,
  "twenty first": 21,
  "twenty-second": 22,
  "twenty second": 22,
  "twenty-third": 23,
  "twenty third": 23,
  "twenty-fourth": 24,
  "twenty fourth": 24,
  "twenty-fifth": 25,
  "twenty fifth": 25,
  "twenty-sixth": 26,
  "twenty sixth": 26,
  "twenty-seventh": 27,
  "twenty seventh": 27,
  "twenty-eighth": 28,
  "twenty eighth": 28,
  "twenty-ninth": 29,
  "twenty ninth": 29,
  thirtieth: 30,
  "thirty-first": 31,
  "thirty first": 31,
};

const WORD_HOUR: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

// Keyed by compacted form (spaces and hyphens removed)
const WORD_MINUTE_COMPACT: Record<string, number> = {
  ten: 10,
  fifteen: 15,
  twenty: 20,
  twentyfive: 25,
  thirty: 30,
  thirtyfive: 35,
  forty: 40,
  fortyfive: 45,
  fifty: 50,
  fiftyfive: 55,
  ohfive: 5,
  ofive: 5,
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoWithOffset(dUtc: Date, offsetMinutes: number): string {
  const localMs = dUtc.getTime() + offsetMinutes * 60_000;
  const local = new Date(localMs);

  const yyyy = local.getUTCFullYear();
  const mm = pad2(local.getUTCMonth() + 1);
  const dd = pad2(local.getUTCDate());
  const hh = pad2(local.getUTCHours());
  const mi = pad2(local.getUTCMinutes());
  const ss = pad2(local.getUTCSeconds());

  const sign = offsetMinutes <= 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const offH = pad2(Math.floor(abs / 60));
  const offM = pad2(abs % 60);

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${offH}:${offM}`;
}

function formatSpeech(
  month: number,
  day: number,
  hour24: number,
  minute: number
) {
  const monthNames = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const h12 = ((hour24 + 11) % 12) + 1;
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const mm = minute === 0 ? "" : `:${pad2(minute)}`;
  return `${monthNames[month]} ${day} at ${h12}${mm} ${ampm}`;
}

function nthWeekdayOfMonthUtc(
  year: number,
  month1to12: number,
  weekday0Sun: number,
  n: number
): number {
  const first = new Date(Date.UTC(year, month1to12 - 1, 1));
  const firstDow = first.getUTCDay();
  const delta = (weekday0Sun - firstDow + 7) % 7;
  return 1 + delta + (n - 1) * 7;
}

function nyOffsetMinutesForLocalDate(
  year: number,
  month1to12: number,
  day: number
): number {
  const dstStartDay = nthWeekdayOfMonthUtc(year, 3, 0, 2);
  const dstEndDay = nthWeekdayOfMonthUtc(year, 11, 0, 1);

  const ymd = year * 10000 + month1to12 * 100 + day;
  const start = year * 10000 + 3 * 100 + dstStartDay;
  const end = year * 10000 + 11 * 100 + dstEndDay;

  return ymd >= start && ymd < end ? -240 : -300;
}

type ParsedOfficeSlot = {
  startIso: string;
  endIso: string;
  spokenStart: string;
  spokenEnd: string;
};

function parseOfficeOfferTimes(
  raw: string,
  baseNowUtc: Date
): ParsedOfficeSlot[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  const re =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+([0-9]{1,2}|[a-z]+(?:[-\s][a-z]+)?)\s+at\s+(noon|midday|midnight|((?:[0-9]{1,2})|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?::[0-9]{2}|\s+(?:fifty[\s-]five|fifty|forty[\s-]five|forty|thirty[\s-]five|thirty|twenty[\s-]five|twenty|fifteen|ten|oh[\s-]five|o[\s-]five))?\s*(am|pm)?)\b/gi;

  const out: ParsedOfficeSlot[] = [];
  const now = baseNowUtc;

  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 3) {
    const monRaw = (m[1] || "").toLowerCase();
    const dayRaw = (m[2] || "").toLowerCase().trim();
    const timeRaw = (m[3] || "").toLowerCase().trim();
    const ampmRaw = (m[5] || "").toLowerCase().trim();

    const month = MONTHS[monRaw];
    if (!month) continue;

    let day: number | null = null;
    if (/^\d+$/.test(dayRaw)) day = Number(dayRaw);
    else day = ORDINAL_DAY[dayRaw] ?? null;
    if (!day || day < 1 || day > 31) continue;

    let hour24 = 0;
    let minute = 0;

    if (timeRaw === "noon" || timeRaw === "midday") {
      hour24 = 12;
      minute = 0;
    } else if (timeRaw === "midnight") {
      hour24 = 0;
      minute = 0;
    } else {
      const compact = timeRaw.replace(/[\s-]+/g, "").toLowerCase();

      const wordMatch = compact.match(
        /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(fiftyfive|fifty|fortyfive|forty|thirtyfive|thirty|twentyfive|twenty|fifteen|ten|ohfive|ofive)?(?::?([0-9]{2}))?(am|pm)?$/
      );

      // Business hours heuristic: medical offices never offer 1–7 AM slots.
      // If no AM/PM is given and the resolved hour is 1–7, assume PM.
      function applyBusinessHoursHeuristic(h12raw: number, ampm: string): number {
        const h12 = h12raw % 12;
        if (ampm === "pm") return h12 + 12;
        if (ampm === "am") return h12;
        // No AM/PM signal — assume PM for hours 1–7
        return h12 >= 1 && h12 <= 6 ? h12 + 12 : h12;
      }

      if (wordMatch) {
        const wh = WORD_HOUR[wordMatch[1]];
        const wordMin = wordMatch[2] ? (WORD_MINUTE_COMPACT[wordMatch[2]] ?? null) : null;
        const numericMin = wordMatch[3] ? Number(wordMatch[3]) : null;
        const min = wordMin ?? numericMin ?? 0;
        const ampm = wordMatch[4] || ampmRaw || "";

        if (!Number.isFinite(min) || min < 0 || min > 59) continue;

        hour24 = applyBusinessHoursHeuristic(wh, ampm);
        minute = min;
      } else {
        const parts = compact.split(":");
        const h = Number(parts[0].replace(/[^0-9]/g, ""));
        const min =
          parts.length > 1 ? Number(parts[1].replace(/[^0-9]/g, "")) : 0;

        if (!Number.isFinite(h) || h < 0 || h > 23) continue;
        if (!Number.isFinite(min) || min < 0 || min > 59) continue;

        const ampm =
          ampmRaw ||
          (compact.includes("am") ? "am" : compact.includes("pm") ? "pm" : "");

        hour24 = applyBusinessHoursHeuristic(h, ampm);
        minute = min;
      }
    }

    const year = now.getUTCFullYear();
    const offsetMinutes = nyOffsetMinutesForLocalDate(year, month, day);

    const localWall = new Date(
      Date.UTC(year, month - 1, day, hour24, minute, 0, 0)
    );
    const startUtcMs = localWall.getTime() - offsetMinutes * 60_000;
    let startUtc = new Date(startUtcMs);

    if (startUtc.getTime() < now.getTime() - 2 * 60 * 60 * 1000) {
      const localWallNext = new Date(
        Date.UTC(year + 1, month - 1, day, hour24, minute, 0, 0)
      );
      startUtc = new Date(localWallNext.getTime() - offsetMinutes * 60_000);
    }

    const endUtc = new Date(startUtc.getTime() + 30 * 60_000);

    const startIso = toIsoWithOffset(startUtc, offsetMinutes);
    const endIso = toIsoWithOffset(endUtc, offsetMinutes);

    const spokenStart = formatSpeech(month, day, hour24, minute);
    const endLocal = new Date(endUtc.getTime() + offsetMinutes * 60_000);
    const spokenEnd = formatSpeech(
      month,
      day,
      endLocal.getUTCHours(),
      endLocal.getUTCMinutes()
    );

    out.push({ startIso, endIso, spokenStart, spokenEnd });
  }

  return out;
}

async function handleOne(
  toolCallId: string,
  args: Record<string, unknown>
): Promise<VapiToolResultEnvelope> {
  let attemptId: number;

  try {
    attemptId = normalizeAttemptId(args?.attempt_id);
  } catch {
    return toolError(toolCallId, {
      stage: "invalid_attempt_id",
      received: args?.attempt_id,
    });
  }

  const officeOfferRawText = String(args?.office_offer_raw_text ?? "").trim();

  const { data: attemptRow, error: attemptErr } = await supabaseAdmin
    .from("schedule_attempts")
    .select("id, app_user_id, demo_autoconfirm, metadata")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptErr || !attemptRow) {
    return toolError(toolCallId, {
      stage: "attempt_lookup_failed",
      message: attemptErr?.message ?? "Attempt not found",
    });
  }

  const typedAttemptRow = attemptRow as AttemptLookupRow;
  const appUserId = String(typedAttemptRow.app_user_id ?? "").trim();
  const flowMode = getFlowMode(typedAttemptRow.metadata);
  const existingBooking = getExistingBookingContext(typedAttemptRow.metadata);

  let demoAutoconfirm = false;
  const argDemo = args?.demo_autoconfirm;
  if (
    argDemo === true ||
    argDemo === "true" ||
    argDemo === 1 ||
    argDemo === "1"
  ) {
    demoAutoconfirm = true;
  } else {
    demoAutoconfirm = typedAttemptRow.demo_autoconfirm === true;
  }

  if (flowMode === "ADJUST" && !existingBooking) {
    return toolError(toolCallId, {
      stage: "missing_existing_booking_context",
      attempt_id: attemptId,
    });
  }

  if (demoAutoconfirm && !officeOfferRawText) {
    return {
      toolCallId,
      result: JSON.stringify({
        status: "OK",
        build_id: "get_candidate_slots_2026-03-22_availability_v1",
        flow_mode: flowMode,
        existing_booking: existingBooking,
        candidate_slots: [],
        message_to_say:
          "Great — what’s the earliest specific day and time you have available?",
        next_action: "WAIT_FOR_OFFICE_TIME",
      }),
    };
  }

  const { data: existingRows, error: existingRowsError } = await supabaseAdmin
    .from("candidate_slots")
    .select("id")
    .eq("attempt_id", attemptId)
    .limit(1);

  if (existingRowsError) {
    return toolError(toolCallId, {
      stage: "check_existing",
      message: existingRowsError.message,
    });
  }

  if (!existingRows || existingRows.length === 0) {
    const nowUtc = new Date();
    const timezone = "America/New_York";

    const parsed = officeOfferRawText
      ? parseOfficeOfferTimes(officeOfferRawText, nowUtc)
      : [];

    if (demoAutoconfirm && officeOfferRawText && parsed.length === 0) {
      return {
        toolCallId,
        result: JSON.stringify({
          status: "OK",
          build_id: "get_candidate_slots_2026-03-22_availability_v1",
          flow_mode: flowMode,
          existing_booking: existingBooking,
          candidate_slots: [],
          message_to_say:
            "Sorry — I didn’t catch the exact slot. What’s the earliest specific day and time you have available?",
          next_action: "WAIT_FOR_OFFICE_TIME",
        }),
      };
    }

    let rowsToInsert: Array<{
      attempt_id: number;
      slot_index: number;
      start_at: string;
      end_at: string;
      spoken_start: string;
      spoken_end: string;
      timezone: string;
      engine_version: string;
      anchor_utc: string | null;
      payload: JsonRecord;
    }> = [];

    if (parsed.length > 0) {
      rowsToInsert = parsed.map((p, i) => ({
        attempt_id: attemptId,
        slot_index: i,
        start_at: p.startIso,
        end_at: p.endIso,
        spoken_start: p.spokenStart,
        spoken_end: p.spokenEnd,
        timezone,
        engine_version: "office_v1",
        anchor_utc: null,
        payload: {
          source: "office_offer_raw_text",
          flow_mode: flowMode,
          existing_booking: existingBooking,
          raw_text: officeOfferRawText,
          parsed: p,
        },
      }));
    } else {
      if (!appUserId) {
        return toolError(toolCallId, { stage: "missing_app_user_id" });
      }

      const windowStart = nowUtc.toISOString();
      const windowEnd = new Date(
        nowUtc.getTime() + 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      const availability = await getAvailabilityContext({
        app_user_id: appUserId,
        window_start: windowStart,
        window_end: windowEnd,
        timezone,
        include_sources: ["GOOGLE_CALENDAR"],
      });

      const generated = generateSlots({
        availability,
        slot_minutes: 30,
        max_results: 3,
        minimum_start_buffer_minutes: 30,
      });

      rowsToInsert = generated.map((slot, i) => ({
        attempt_id: attemptId,
        slot_index: i,
        start_at: slot.start_at,
        end_at: slot.end_at,
        spoken_start: slot.start_at,
        spoken_end: slot.end_at,
        timezone: slot.timezone,
        engine_version: "availability_v1",
        anchor_utc: nowUtc.toISOString(),
        payload: {
          source: "availability_service",
          flow_mode: flowMode,
          existing_booking: existingBooking,
          slot,
          availability_window: {
            start: availability.window_start,
            end: availability.window_end,
            timezone: availability.timezone,
          },
        },
      }));
    }

    if (!rowsToInsert.length) {
      return toolError(toolCallId, { stage: "generate_empty" });
    }

    const { error: insertError } = await supabaseAdmin
      .from("candidate_slots")
      .upsert(rowsToInsert, {
        onConflict: "attempt_id,start_at,end_at",
        ignoreDuplicates: true,
      });

    if (insertError) {
      return toolError(toolCallId, {
        stage: "insert",
        message: insertError.message,
      });
    }
  }

  const { data: canonicalRows, error: readError } = await supabaseAdmin
    .from("candidate_slots")
    .select("slot_index,start_at,end_at,timezone,spoken_start,spoken_end")
    .eq("attempt_id", attemptId)
    .order("slot_index", { ascending: true });

  if (readError) {
    return toolError(toolCallId, {
      stage: "read",
      message: readError.message,
    });
  }

  const canonicalSlots =
    canonicalRows?.map((r: {
      start_at: string;
      end_at: string;
      timezone: string | null;
      spoken_start: string | null;
      spoken_end: string | null;
    }) => ({
      start_at: r.start_at,
      end_at: r.end_at,
      timezone: r.timezone ?? null,
      spoken_start: r.spoken_start ?? r.start_at,
      spoken_end: r.spoken_end ?? r.end_at,
    })) ?? [];

  if (!canonicalSlots.length) {
    return toolError(toolCallId, { stage: "post_read_empty", attempt_id: attemptId });
  }

  if (demoAutoconfirm) {
    return {
      toolCallId,
      result: JSON.stringify({
        status: "OK",
        build_id: "get_candidate_slots_2026-03-22_availability_v1",
        flow_mode: flowMode,
        existing_booking: existingBooking,
        candidate_slots: canonicalSlots,
        message_to_say: "That works. Let’s book it.",
        next_action: "DEMO_AUTO_SELECT_CANDIDATE_SLOT",
      }),
    };
  }

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
      build_id: "get_candidate_slots_2026-03-22_availability_v1",
      flow_mode: flowMode,
      existing_booking: existingBooking,
      candidate_slots: canonicalSlots,
      message_to_say,
      next_action: "ASK_USER_TO_CHOOSE_SLOT",
    }),
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as VapiToolCallsBody;

  if (
    body?.message?.type === "tool-calls" &&
    Array.isArray(body.message.toolCalls)
  ) {
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
        toolError("no_matching_tool", { stage: "no_matching_tool_call" }),
      ]);
    }

    return jsonToolResults(results);
  }

  const toolCallId = String(
    body?.toolCallId || body?.tool_call_id || body?.id || "local_call"
  ).trim();

  return jsonToolResults([
    await handleOne(toolCallId, safeParseArgs(body)),
  ]);
}