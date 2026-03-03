import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isDigits(v: string): boolean {
  return /^\d+$/.test(v);
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function normalizeAttemptIdAny(v: any): string {
  const s = String(v ?? "").trim();
  if (!s) throw new Error("missing_attempt_id");
  // keep as string; RPC can accept text -> cast inside SQL if needed
  if (isDigits(s) || isUuid(s)) return s;
  throw new Error("invalid_attempt_id");
}

function vapiToolCallId(body: any): string {
  return String(body?.toolCallId || body?.tool_call_id || body?.id || "confirm_call").trim();
}

function toolErrorEnvelope(toolCallId: string, debug?: any) {
  return NextResponse.json({
    results: [
      {
        toolCallId,
        result: JSON.stringify({
          status: "ERROR",
          message_to_say: "There was a system issue. I will call back shortly.",
          next_action: "END_CALL",
          ...(debug ? { debug } : {}),
        }),
      },
    ],
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const toolCallId = vapiToolCallId(body);

  let attemptIdStr: string;
  try {
    attemptIdStr = normalizeAttemptIdAny(body?.attempt_id);
  } catch (e: any) {
    return toolErrorEnvelope(toolCallId, {
      stage: "invalid_attempt_id",
      received: body?.attempt_id,
    });
  }

  const proposalIdStr = String(body?.proposal_id ?? "").trim();
  const confirmationNumber = String(body?.confirmation_number ?? "").trim() || null;

  if (!proposalIdStr) {
    return toolErrorEnvelope(toolCallId, { stage: "missing_proposal_id" });
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // Self-heal provider_uuid if missing (deterministic, no guessing)
  const providerIdMaybeUuid = String(body?.provider_id ?? "").trim();
  if (isUuid(providerIdMaybeUuid)) {
    const { data: attemptRow, error: attemptErr } = await supabase
      .from("schedule_attempts")
      .select("id, provider_uuid")
      .eq("id", attemptIdStr)
      .maybeSingle();

    if (attemptErr) {
      return toolErrorEnvelope(toolCallId, { stage: "attempt_read_failed", message: attemptErr.message });
    }

    if (attemptRow && !attemptRow.provider_uuid) {
      const { error: updErr } = await supabase
        .from("schedule_attempts")
        .update({ provider_uuid: providerIdMaybeUuid })
        .eq("id", attemptIdStr);

      if (updErr) {
        return toolErrorEnvelope(toolCallId, { stage: "attempt_update_provider_uuid_failed", message: updErr.message });
      }
    }
  }

  // Fail fast: proposal must belong to attempt
  const { data: proposal, error: proposalErr } = await supabase
    .from("proposals")
    .select("id, attempt_id")
    .eq("id", proposalIdStr)
    .single();

  if (proposalErr || !proposal?.id) {
    return toolErrorEnvelope(toolCallId, { stage: "proposal_not_found" });
  }

  if (String((proposal as any).attempt_id) !== attemptIdStr) {
    return toolErrorEnvelope(toolCallId, { stage: "proposal_attempt_mismatch" });
  }

  const { data, error } = await supabase.rpc("finalize_confirm_booking", {
    p_attempt_id: attemptIdStr,
    p_proposal_id: proposalIdStr,
  });

  if (error) {
    return toolErrorEnvelope(toolCallId, { stage: "rpc_finalize_confirm_booking_failed", message: error.message });
  }

  return NextResponse.json({
    results: [
      {
        toolCallId,
        result: JSON.stringify({
          status: "OK",
          calendar_event_id: data?.calendar_event_id ?? null,
          provider_id: data?.provider_id ?? null,
          user_id: data?.user_id ?? null,
          start_at: data?.start_at ?? null,
          end_at: data?.end_at ?? null,
          ...(confirmationNumber ? { confirmation_number: confirmationNumber } : {}),
          message_to_say: "The appointment has been successfully scheduled.",
          next_action: "ASK_CONFIRMATION_NUMBER",
        }),
      },
    ],
  });
}