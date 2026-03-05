import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type VapiToolResultEnvelope = { toolCallId: string; result: string };

function isDigits(v: string): boolean {
  return /^\d+$/.test(v);
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function normalizeAttemptIdAny(v: any): string {
  const s = String(v ?? "").trim();
  if (!s) throw new Error("missing_attempt_id");
  if (isDigits(s) || isUuid(s)) return s;
  throw new Error("invalid_attempt_id");
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

function jsonToolResults(results: VapiToolResultEnvelope[]) {
  return NextResponse.json({ results });
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

function getSupabaseOrError(toolCallId: string): SupabaseClient | VapiToolResultEnvelope {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return toolError(toolCallId, {
      stage: "missing_env",
      missing: { SUPABASE_URL: !url, SUPABASE_SERVICE_ROLE_KEY: !key },
    });
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
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

/**
 * Speech-safe formatting:
 * - No weekdays
 * - No year guessing
 * - No numeric slashes like 3/10 (which TTS reads as "three ten")
 * - Uses "March 10th at 12 PM"
 */
function formatForSpeechFromIso(iso: string) {
  const d = new Date(iso);
  const tz = "America/New_York";

  const month = d.toLocaleDateString("en-US", { month: "long", timeZone: tz });
  const dayNum = Number(d.toLocaleDateString("en-US", { day: "numeric", timeZone: tz }));

  // "12 PM" (no :00)
  const time = d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    })
    .replace(":00 ", " ");

  return `${month} ${ordinal(dayNum)} at ${time}`;
}

async function handleOne(toolCallId: string, args: any): Promise<VapiToolResultEnvelope> {
  let attemptIdStr: string;
  try {
    attemptIdStr = normalizeAttemptIdAny(args?.attempt_id);
  } catch {
    return toolError(toolCallId, { stage: "invalid_attempt_id", received: args?.attempt_id });
  }

  const proposalIdStr = String(args?.proposal_id ?? "").trim();
  const confirmationNumber = String(args?.confirmation_number ?? "").trim() || null;
  const providerIdMaybeUuid = String(args?.provider_id ?? "").trim();

  if (!proposalIdStr) return toolError(toolCallId, { stage: "missing_proposal_id" });

  const supabaseOrErr = getSupabaseOrError(toolCallId);
  if ("result" in supabaseOrErr) return supabaseOrErr;
  const supabase = supabaseOrErr;

  // Read attempt for demo_autoconfirm (demo-only response shaping)
  const { data: attemptFlags, error: attemptFlagsErr } = await supabase
    .from("schedule_attempts")
    .select("id, demo_autoconfirm, provider_uuid")
    .eq("id", attemptIdStr)
    .maybeSingle();

  if (attemptFlagsErr) {
    return toolError(toolCallId, { stage: "attempt_read_failed", message: attemptFlagsErr.message });
  }

  const demoAutoconfirm = attemptFlags?.demo_autoconfirm === true;

  // Self-heal provider_uuid if missing (deterministic only when provider_id is UUID)
  if (isUuid(providerIdMaybeUuid)) {
    if (attemptFlags && !attemptFlags.provider_uuid) {
      const { error: updErr } = await supabase
        .from("schedule_attempts")
        .update({ provider_uuid: providerIdMaybeUuid })
        .eq("id", attemptIdStr);

      if (updErr) {
        return toolError(toolCallId, {
          stage: "attempt_update_provider_uuid_failed",
          message: updErr.message,
        });
      }
    }
  }

  // Proposal must belong to attempt
  const { data: proposal, error: proposalErr } = await supabase
    .from("proposals")
    .select("id, attempt_id, normalized_start, normalized_end, timezone, payload")
    .eq("id", proposalIdStr)
    .single();

  if (proposalErr || !proposal?.id) return toolError(toolCallId, { stage: "proposal_not_found" });
  if (String((proposal as any).attempt_id) !== attemptIdStr) {
    return toolError(toolCallId, { stage: "proposal_attempt_mismatch" });
  }

  const { data, error } = await supabase.rpc("finalize_confirm_booking", {
    p_attempt_id: attemptIdStr,
    p_proposal_id: proposalIdStr,
  });

  if (error) return toolError(toolCallId, { stage: "rpc_finalize_confirm_booking_failed", message: error.message });

  const tz = String((proposal as any)?.timezone ?? (proposal as any)?.payload?.timezone ?? "America/New_York");

  // Prefer payload.spoken_start ONLY if it is speech-safe; otherwise derive from normalized_start.
  const payloadSpokenStartRaw = String((proposal as any)?.payload?.spoken_start ?? "").trim();
  const payloadLooksUnsafe =
    /\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(payloadSpokenStartRaw) || // 3/10
    /\b\d{1,2}-\d{1,2}\b/.test(payloadSpokenStartRaw); // 3-10 (just in case)

  const spokenStart =
    (!payloadLooksUnsafe && payloadSpokenStartRaw ? payloadSpokenStartRaw : "") ||
    ((proposal as any)?.normalized_start ? formatForSpeechFromIso((proposal as any).normalized_start) : null);

  // Demo-ready: end call cleanly, no confirmation number step.
  const messageToSay = demoAutoconfirm
    ? `Perfect — you’re all set${spokenStart ? ` for ${spokenStart}` : ""}. Thank you.`
    : "The appointment has been successfully scheduled.";

  const nextAction = demoAutoconfirm ? "END_CALL" : "ASK_CONFIRMATION_NUMBER";

  return {
    toolCallId,
    result: JSON.stringify({
      status: "OK",
      calendar_event_id: data?.calendar_event_id ?? null,
      provider_id: data?.provider_id ?? null,
      user_id: data?.user_id ?? null,
      start_at: data?.start_at ?? null,
      end_at: data?.end_at ?? null,
      ...(confirmationNumber ? { confirmation_number: confirmationNumber } : {}),
      message_to_say: messageToSay,
      next_action: nextAction,
      ...(demoAutoconfirm ? { demo_autoconfirm: true, timezone: tz } : {}),
    }),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // 1) Vapi tool-calls envelope
    if (body?.message?.type === "tool-calls" && Array.isArray(body.message.toolCalls)) {
      const results: VapiToolResultEnvelope[] = [];

      for (const tc of body.message.toolCalls) {
        const toolCallId = String(tc?.id ?? "").trim() || "missing_toolCallId";
        const fnName = String(tc?.function?.name ?? "").trim();
        if (fnName !== "confirm_booking") continue;

        const args = safeParseArgs(tc?.function?.arguments);
        results.push(await handleOne(toolCallId, args));
      }

      if (results.length === 0) {
        return jsonToolResults([toolError("no_matching_tool_call", { stage: "no_matching_tool_call" })]);
      }

      return jsonToolResults(results);
    }

    // 2) Flat JSON body
    const toolCallId = String(body?.toolCallId || body?.tool_call_id || body?.id || "confirm_call").trim();
    return jsonToolResults([await handleOne(toolCallId, body)]);
  } catch (e: any) {
    // absolutely never let Vapi see an unstructured 500
    return jsonToolResults([
      toolError("confirm_call", { stage: "unhandled_exception", message: e?.message ?? String(e) }),
    ]);
  }
}