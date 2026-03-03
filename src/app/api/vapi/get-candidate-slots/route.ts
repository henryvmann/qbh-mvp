import { supabaseAdmin } from "../../../../lib/supabase-server";
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

function normalizeAttemptIdAny(v: any): string | number {
  if (typeof v === "number" && Number.isFinite(v)) return v;

  const s = String(v ?? "").trim();
  if (!s) throw new Error("missing_attempt_id");

  // legacy bigint ids passed as string
  if (/^\d+$/.test(s)) return Number(s);

  // uuid
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s;

  throw new Error("invalid_attempt_id");
}

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

// -----------------------------
// Office-time parsing (deterministic, no fuzzy)
// Supports examples like:
// "March fourth at noon"
// "March 4 at 3 PM"
// Multiple entries: comma / "or"
// -----------------------------
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Convert a UTC Date to an ISO string *with a fixed offset* (deterministic)
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

function formatSpeech(month: number, day: number, hour24: number, minute: number) {
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

type ParsedOfficeSlot = {
  startIso: string;
  endIso: string;
  spokenStart: string;
  spokenEnd: string;
};

function parseOfficeOfferTimes(raw: string, baseNowUtc: Date, offsetMinutes: number): ParsedOfficeSlot[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  const re =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+([0-9]{1,2}|[a-z]+(?:[-\s][a-z]+)?)\s+at\s+(noon|midday|midnight|[0-9]{1,2}(?::[0-9]{2})?\s*(am|pm)?)\b/gi;

  const out: ParsedOfficeSlot[] = [];
  const nowUtc = baseNowUtc;

  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 3) {
    const monRaw = (m[1] || "").toLowerCase();
    const dayRaw = (m[2] || "").toLowerCase().trim();
    const timeRaw = (m[3] || "").toLowerCase().trim();
    const ampmRaw = (m[4] || "").toLowerCase().trim();

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
      const compact = timeRaw.replace(/\s+/g, "");
      const parts = compact.split(":");
      const h = Number(parts[0].replace(/[^0-9]/g, ""));
      const min = parts.length > 1 ? Number(parts[1].replace(/[^0-9]/g, "")) : 0;

      if (!Number.isFinite(h) || h < 0 || h > 23) continue;
      if (!Number.isFinite(min) || min < 0 || min > 59) continue;

      const hasAmPm = /am|pm/.test(compact) || ampmRaw === "am" || ampmRaw === "pm";
      const ampm = ampmRaw || (compact.includes("am") ? "am" : compact.includes("pm") ? "pm" : "");

      if (hasAmPm) {
        const h12 = h % 12;
        hour24 = ampm === "pm" ? h12 + 12 : h12;
      } else {
        hour24 = h;
      }
      minute = min;
    }

    const year = nowUtc.getUTCFullYear();

    const localWall = new Date(Date.UTC(year, month - 1, day, hour24, minute, 0, 0));
    const startUtcMs = localWall.getTime() - offsetMinutes * 60_000;
    let startUtc = new Date(startUtcMs);

    if (startUtc.getTime() < nowUtc.getTime() - 2 * 60 * 60 * 1000) {
      const localWallNext = new Date(Date.UTC(year + 1, month - 1, day, hour24, minute, 0, 0));
      startUtc = new Date(localWallNext.getTime() - offsetMinutes * 60_000);
    }

    const endUtc = new Date(startUtc.getTime() + 30 * 60_000);

    const startIso = toIsoWithOffset(startUtc, offsetMinutes);
    const endIso = toIsoWithOffset(endUtc, offsetMinutes);

    const spokenStart = formatSpeech(month, day, hour24, minute);
    const endLocal = new Date(endUtc.getTime() + offsetMinutes * 60_000);
    const spokenEnd = formatSpeech(month, day, endLocal.getUTCHours(), endLocal.getUTCMinutes());

    out.push({ startIso, endIso, spokenStart, spokenEnd });
  }

  return out;
}

async function handleOne(toolCallId: string, args: any): Promise<VapiToolResultEnvelope> {
  let attemptId: string | number;
  try {
    attemptId = normalizeAttemptIdAny(args?.attempt_id);
  } catch {
    return toolError(toolCallId, { stage: "invalid_attempt_id", received: args?.attempt_id });
  }

  console.info("[get_candidate_slots] incoming_args", {
    toolCallId,
    attemptId,
    keys: Object.keys(args || {}),
    hasOfficeOfferRawText:
      typeof args?.office_offer_raw_text === "string" && args.office_offer_raw_text.trim().length > 0,
    officeOfferRawTextPreview:
      typeof args?.office_offer_raw_text === "string" ? args.office_offer_raw_text.slice(0, 80) : null,
  });

  const officeOfferRawText = String(args?.office_offer_raw_text ?? "").trim();

  // 1) If slots already exist, do NOT regenerate (immutability)
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
    const nowUtc = new Date();

    // Demo-default timezone: America/New_York
    // IMPORTANT: Vercel runs in UTC; do NOT use server getTimezoneOffset() here.
    const timezone = "America/New_York";
    const timezoneOffsetMinutes = -300;

    const parsed: ParsedOfficeSlot[] = officeOfferRawText
      ? parseOfficeOfferTimes(officeOfferRawText, nowUtc, timezoneOffsetMinutes)
      : [];

    console.info("[get_candidate_slots] office_override_parse", {
      attemptId,
      hasOfficeOfferRawText: officeOfferRawText.length > 0,
      parsedCount: parsed.length,
      parsedPreview: parsed.slice(0, 3),
      timezoneOffsetMinutes,
      nowUtc: nowUtc.toISOString(),
    });

    const rowsToInsert =
      parsed.length > 0
        ? parsed.map((p, i) => ({
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
              raw_text: officeOfferRawText,
              parsed: p,
            },
          }))
        : (() => {
            const generated = generateCandidateSlots(nowUtc, {
              timezoneOffsetMinutes,
              businessStartHour: 9,
              businessEndHour: 17,
              slotMinutes: 30,
              count: 3,
            });

            if (!generated.length) return [];

            return generated.map((slot: any, i: number) => ({
              attempt_id: attemptId,
              slot_index: i,
              start_at: slot.start,
              end_at: slot.end,
              spoken_start: slot.spoken_start ?? slot.start,
              spoken_end: slot.spoken_end ?? slot.end,
              timezone: slot.timezone ?? timezone,
              engine_version: "v1",
              anchor_utc: (slot as any).anchor_utc ?? null,
              payload: slot,
            }));
          })();

    if (!rowsToInsert.length) {
      return toolError(toolCallId, { stage: "generate_empty" });
    }

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
      build_id: "get_candidate_slots_2026-03-03d",
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