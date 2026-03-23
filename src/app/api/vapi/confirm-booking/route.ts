import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { buildBookingSummary } from "../../../../lib/booking/build-booking-summary";

type JsonRecord = Record<string, unknown>;

type VapiToolResultEnvelope = { toolCallId: string; result: string };

type ExistingBookedAppointment = {
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

function getFlowMode(metadata: unknown): "BOOK" | "ADJUST" {
  const record = asRecord(metadata);
  return String(record?.flow_mode || "").trim().toUpperCase() === "ADJUST"
    ? "ADJUST"
    : "BOOK";
}

function getExistingBooking(metadata: unknown): ExistingBookedAppointment | null {
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

  if (!Number.isFinite(sourceAttemptId) || !bookingSummary) {
    return null;
  }

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

function isDigits(v: string): boolean {
  return /^\d+$/.test(v);
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v
  );
}

function normalizeAttemptIdAny(v: unknown): string {
  const s = String(v ?? "").trim();

  if (!s) {
    throw new Error("missing_attempt_id");
  }

  if (isDigits(s) || isUuid(s)) {
    return s;
  }

  throw new Error("invalid_attempt_id");
}

function safeParseArgs(raw: unknown): Record<string, unknown> {
  if (!raw) {
    return {};
  }

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

function jsonToolResults(results: VapiToolResultEnvelope[]) {
  return NextResponse.json({ results });
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

async function handleOne(
  toolCallId: string,
  args: Record<string, unknown>
): Promise<VapiToolResultEnvelope> {
  let attemptIdStr: string;

  try {
    attemptIdStr = normalizeAttemptIdAny(args?.attempt_id);
  } catch {
    return toolError(toolCallId, {
      stage: "invalid_attempt_id",
      received: String(args?.attempt_id ?? ""),
    });
  }

  const proposalIdStr = String(args?.proposal_id ?? "").trim();
  const confirmationNumber =
    String(args?.confirmation_number ?? "").trim() || null;
  const providerIdMaybeUuid = String(args?.provider_id ?? "").trim();

  if (!proposalIdStr) {
    return toolError(toolCallId, { stage: "missing_proposal_id" });
  }

  const { data: attemptRow, error: attemptErr } = await supabaseAdmin
    .from("schedule_attempts")
    .select("id, app_user_id, demo_autoconfirm, provider_id, metadata")
    .eq("id", attemptIdStr)
    .maybeSingle();

  if (attemptErr) {
    return toolError(toolCallId, {
      stage: "attempt_read_failed",
      message: attemptErr.message,
    });
  }

  if (!attemptRow) {
    return toolError(toolCallId, {
      stage: "attempt_not_found",
    });
  }

  const demoAutoconfirm = attemptRow.demo_autoconfirm === true;
  const flowMode = getFlowMode(attemptRow.metadata);
  const existingBooking = getExistingBooking(attemptRow.metadata);

  if (flowMode === "ADJUST" && !existingBooking) {
    return toolError(toolCallId, {
      stage: "missing_existing_booking_context",
    });
  }

  if (isUuid(providerIdMaybeUuid) && !attemptRow.provider_id) {
    const { error: updateProviderErr } = await supabaseAdmin
      .from("schedule_attempts")
      .update({ provider_id: providerIdMaybeUuid })
      .eq("id", attemptIdStr);

    if (updateProviderErr) {
      return toolError(toolCallId, {
        stage: "attempt_update_provider_id_failed",
        message: updateProviderErr.message,
      });
    }
  }

  const { data: proposal, error: proposalErr } = await supabaseAdmin
    .from("proposals")
    .select("id, attempt_id, normalized_start, normalized_end, timezone, payload")
    .eq("id", proposalIdStr)
    .single();

  if (proposalErr || !proposal?.id) {
    return toolError(toolCallId, { stage: "proposal_not_found" });
  }

  if (String(proposal.attempt_id) !== attemptIdStr) {
    return toolError(toolCallId, { stage: "proposal_attempt_mismatch" });
  }

  const proposalStart = String(proposal.normalized_start ?? "").trim();
  const proposalEnd = String(proposal.normalized_end ?? "").trim();

  if (!proposalStart || !proposalEnd) {
    return toolError(toolCallId, {
      stage: "proposal_missing_normalized_times",
    });
  }

  const { data, error } = await supabaseAdmin.rpc("finalize_confirm_booking", {
    p_attempt_id: attemptIdStr,
    p_proposal_id: proposalIdStr,
  });

  if (error) {
    return toolError(toolCallId, {
      stage: "rpc_finalize_confirm_booking_failed",
      message: error.message,
    });
  }

  const proposalPayload = asRecord(proposal.payload);

  const tz = String(
    proposal.timezone ?? proposalPayload?.timezone ?? "America/New_York"
  );

  const payloadSpokenStartRaw = String(
    proposalPayload?.spoken_start ?? ""
  ).trim();

  const payloadLooksUnsafe =
    /\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(payloadSpokenStartRaw) ||
    /\b\d{1,2}-\d{1,2}\b/.test(payloadSpokenStartRaw);

  const spokenStart =
    (!payloadLooksUnsafe && payloadSpokenStartRaw
      ? payloadSpokenStartRaw
      : "") ||
    (proposal.normalized_start
      ? formatForSpeechFromIso(proposal.normalized_start)
      : null);

  const bookingSummary = buildBookingSummary({
    provider_id: data?.provider_id ?? attemptRow.provider_id ?? null,
    appointment_start: data?.start_at ?? proposal.normalized_start ?? null,
    appointment_end: data?.end_at ?? proposal.normalized_end ?? null,
    timezone: tz,
    calendar_event_id: data?.calendar_event_id ?? null,
    portal_fact_written: true,
  });

  const nextMetadata: JsonRecord = {
    ...(asRecord(attemptRow.metadata) ?? {}),
    last_event: "BOOKED_CONFIRMED",
    booking_summary: bookingSummary,
  };

  if (flowMode === "ADJUST" && existingBooking) {
    nextMetadata.adjusted_from_booking = existingBooking;
    nextMetadata.flow_mode = "ADJUST";
  }

  const { error: metadataUpdateError } = await supabaseAdmin
    .from("schedule_attempts")
    .update({
      metadata: nextMetadata,
    })
    .eq("id", attemptIdStr);

  if (metadataUpdateError) {
    return toolError(toolCallId, {
      stage: "attempt_metadata_update_failed",
      message: metadataUpdateError.message,
    });
  }

  const messageToSay = demoAutoconfirm
    ? `Perfect — you’re all set${spokenStart ? ` for ${spokenStart}` : ""}. Thank you.`
    : flowMode === "ADJUST"
    ? "The appointment has been successfully rescheduled."
    : "The appointment has been successfully scheduled.";

  const nextAction = demoAutoconfirm ? "END_CALL" : "ASK_CONFIRMATION_NUMBER";

  return {
    toolCallId,
    result: JSON.stringify({
      status: "OK",
      flow_mode: flowMode,
      existing_booking: existingBooking,
      calendar_event_id: data?.calendar_event_id ?? null,
      provider_id: data?.provider_id ?? null,
      app_user_id: data?.app_user_id ?? null,
      start_at: data?.start_at ?? null,
      end_at: data?.end_at ?? null,
      booking_summary: bookingSummary,
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

    if (
      body?.message?.type === "tool-calls" &&
      Array.isArray(body.message.toolCalls)
    ) {
      const results: VapiToolResultEnvelope[] = [];

      for (const tc of body.message.toolCalls) {
        const toolCallId =
          String(tc?.id ?? "").trim() || "missing_toolCallId";
        const fnName = String(tc?.function?.name ?? "").trim();

        if (fnName !== "confirm_booking") {
          continue;
        }

        const args = safeParseArgs(tc?.function?.arguments);
        results.push(await handleOne(toolCallId, args));
      }

      if (results.length === 0) {
        return jsonToolResults([
          toolError("no_matching_tool_call", {
            stage: "no_matching_tool_call",
          }),
        ]);
      }

      return jsonToolResults(results);
    }

    const toolCallId = String(
      body?.toolCallId || body?.tool_call_id || body?.id || "confirm_call"
    ).trim();

    return jsonToolResults([await handleOne(toolCallId, safeParseArgs(body))]);
  } catch (e: unknown) {
    return jsonToolResults([
      toolError("confirm_call", {
        stage: "unhandled_exception",
        message: e instanceof Error ? e.message : String(e),
      }),
    ]);
  }
}