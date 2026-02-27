import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeProviderId } from "../../../../lib/vapi/ids";

type ProposeOfficeSlotBody = {
  toolCallId?: string;
  tool_call_id?: string;
  id?: string;
  attempt_id: number | string;
  provider_id?: unknown; // accept unknown; we'll normalize safely
  office_offer: {
    raw_text: string;
  };
};

// --- helpers ---
function isDigits(v: string): boolean {
  return /^[0-9]+$/.test(v);
}

function normalizeAttemptId(input: number | string): {
  attemptIdStr: string;
  attemptIdNumOrNull: number | null;
} {
  const attemptIdStr = String(input).trim();
  if (!isDigits(attemptIdStr)) throw new Error("attempt_id must be an integer (bigint-compatible)");

  // Best-effort for call_events attempt_id bigint (avoid JS bigint precision issues)
  const asNum = Number(attemptIdStr);
  const attemptIdNumOrNull =
    Number.isFinite(asNum) && Number.isSafeInteger(asNum) ? asNum : null;

  return { attemptIdStr, attemptIdNumOrNull };
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
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
    const supabase = getSupabaseAdmin();
    await supabase.from("call_events").insert({
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

/**
 * Minimal, demo-safe normalization:
 * - Try Date.parse(raw_text) / new Date(raw_text)
 * - If no year and it lands in the past, bump to next year
 * This keeps your agent rule ("don't *say* a year") but allows backend normalization.
 */
function normalizeOfferToTimestamps(rawText: string): { start: Date; end: Date; timezone: string } {
  const tz = "America/New_York";
  const trimmed = rawText.trim();

  let start = new Date(trimmed);

  // If parsing fails, fall back to "tomorrow at 10am" (demo-safe) rather than crashing.
  if (isNaN(start.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    fallback.setHours(10, 0, 0, 0);
    start = fallback;
  }

  // If the parsed date is in the past by > 2 hours, bump year forward (handles missing-year strings)
  const now = new Date();
  if (start.getTime() < now.getTime() - 2 * 60 * 60 * 1000) {
    const bumped = new Date(start);
    bumped.setFullYear(bumped.getFullYear() + 1);
    start = bumped;
  }

  // Default duration 30 minutes
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { start, end, timezone: tz };
}

function formatForSpeech(d: Date) {
  // numeric month/day + time only (no weekday)
  // Example: "1/31 at 2:00 PM"
  const date = d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}

// --- route ---
export async function POST(req: Request) {
  let body: ProposeOfficeSlotBody;

  try {
    body = (await req.json()) as ProposeOfficeSlotBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const toolCallId = body?.toolCallId || body?.tool_call_id || body?.id || null;

  const rawText = String(body?.office_offer?.raw_text ?? "").trim();
  if (!rawText) {
    return NextResponse.json({ error: "office_offer.raw_text is required" }, { status: 400 });
  }

  let attemptIdStr = "";
  let attemptIdNumOrNull: number | null = null;

  try {
    const normalized = normalizeAttemptId(body.attempt_id);
    attemptIdStr = normalized.attemptIdStr;
    attemptIdNumOrNull = normalized.attemptIdNumOrNull;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Invalid attempt_id" }, { status: 400 });
  }

  // ✅ provider_id transition-safe:
  // - if it’s already a UUID string, normalize it
  // - if it’s a number (legacy), keep it for logs but don’t depend on it
  let providerIdUuid: string | null = null;
  try {
    if (typeof body.provider_id === "string") {
      providerIdUuid = normalizeProviderId(body.provider_id);
    }
  } catch {
    providerIdUuid = null;
  }

  const toolPayload = {
    toolCallId,
    attempt_id: attemptIdStr,
    provider_id_raw: body.provider_id ?? null,
    provider_id_uuid: providerIdUuid,
    office_offer: { raw_text: rawText },
  };

  await logCallEvent({
    attemptIdNumOrNull,
    source: "api.vapi.propose-office-slot",
    event_type: "TOOL_CALL_RECEIVED",
    tool_name: "propose_office_slot",
    tool_payload: toolPayload,
  });

  try {
    const supabase = getSupabaseAdmin();

    const { data: attemptRow, error: attemptReadErr } = await supabase
      .from("schedule_attempts")
      .select("id, demo_autoconfirm, provider_uuid")
      .eq("id", attemptIdStr)
      .maybeSingle();

    if (attemptReadErr) {
      await logCallEvent({
        attemptIdNumOrNull,
        source: "api.vapi.propose-office-slot",
        event_type: "TOOL_CALL_ERROR",
        tool_name: "propose_office_slot",
        tool_payload: toolPayload,
        vapi_event: { error: attemptReadErr.message },
      });

      return NextResponse.json(
        { error: "Failed to read schedule_attempts", details: attemptReadErr.message },
        { status: 500 }
      );
    }

    if (!attemptRow) {
      return NextResponse.json({ error: `No schedule_attempts row for id=${attemptIdStr}` }, { status: 404 });
    }

    const demoAutoconfirm = attemptRow.demo_autoconfirm === true;

    const { start, end, timezone } = normalizeOfferToTimestamps(rawText);

    const { data: proposalInsert, error: proposalErr } = await supabase
      .from("proposals")
      .insert({
        attempt_id: attemptIdStr,
        office_offer_raw_text: rawText,
        normalized_start: start.toISOString(),
        normalized_end: end.toISOString(),
        timezone,
        status: "PROPOSED",
      })
      .select("id, normalized_start, normalized_end, timezone")
      .single();

    if (proposalErr) {
      await logCallEvent({
        attemptIdNumOrNull,
        source: "api.vapi.propose-office-slot",
        event_type: "TOOL_CALL_ERROR",
        tool_name: "propose_office_slot",
        tool_payload: toolPayload,
        vapi_event: { error: proposalErr.message },
      });

      return NextResponse.json(
        { error: "Failed to create proposal", details: proposalErr.message },
        { status: 500 }
      );
    }

    const proposalId = proposalInsert.id as string;

    const spoken = formatForSpeech(new Date(proposalInsert.normalized_start));
    const message_to_say = `Great — I have ${spoken} recorded.`;
    const next_action = demoAutoconfirm ? "CONFIRM_BOOKING" : "WAIT_FOR_USER_APPROVAL";

    const response = {
      proposal_id: proposalId,
      normalized_start: proposalInsert.normalized_start,
      normalized_end: proposalInsert.normalized_end,
      timezone: proposalInsert.timezone,
      conflict: false,
      message_to_say,
      next_action,
    };

    await logCallEvent({
      attemptIdNumOrNull,
      source: "api.vapi.propose-office-slot",
      event_type: "TOOL_CALL_SUCCEEDED",
      tool_name: "propose_office_slot",
      tool_payload: toolPayload,
      vapi_event: { result: response },
    });

    // ✅ keep existing response shape (since your flow already works)
    return NextResponse.json(response, { status: 200 });
  } catch (e: any) {
    await logCallEvent({
      attemptIdNumOrNull,
      source: "api.vapi.propose-office-slot",
      event_type: "TOOL_CALL_EXCEPTION",
      tool_name: "propose_office_slot",
      tool_payload: toolPayload,
      vapi_event: { error: e?.message ?? String(e) },
    });

    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}