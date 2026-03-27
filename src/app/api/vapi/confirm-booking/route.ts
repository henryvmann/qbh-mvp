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

type CalendarConflictResult = {
  status: "CONFLICT";
  flow_mode: "BOOK" | "ADJUST";
  existing_booking: ExistingBookedAppointment | null;
  calendar_event_id: string | null;
  provider_id: string | null;
  app_user_id: string | null;
  start_at: string | null;
  end_at: string | null;
  booking_summary: ReturnType<typeof buildBookingSummary>;
  message_to_say: string;
  next_action: "REQUEST_ALTERNATE_SLOT";
  conflict_reason: "EXISTING_FUTURE_CONFIRMED_EVENT";
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

function buildConflictResult(params: {
  toolCallId: string;
  flowMode: "BOOK" | "ADJUST";
  existingBooking: ExistingBookedAppointment | null;
  attemptRow: {
    app_user_id: string | null;
    provider_id: string | null;
    metadata: unknown;
  };
  proposal: {
    normalized_start: string | null;
    normalized_end: string | null;
    timezone: string | null;
    payload: unknown;
  };
  existingFutureEvent: {
    id: string;
    start_at: string;
    end_at: string | null;
    timezone: string | null;
  } | null;
}): VapiToolResultEnvelope {
  const proposalPayload = asRecord(params.proposal.payload);
  const tz = String(
    params.proposal.timezone ?? proposalPayload?.timezone ?? "America/New_York"
  );

  const bookingSummary = buildBookingSummary({
    provider_id: params.attemptRow.provider_id ?? null,
    appointment_start:
      params.existingFutureEvent?.start_at ?? params.proposal.normalized_start,
    appointment_end:
      params.existingFutureEvent?.end_at ?? params.proposal.normalized_end,
    timezone: params.existingFutureEvent?.timezone ?? tz,
    calendar_event_id: params.existingFutureEvent?.id ?? null,
    portal_fact_written: false,
  });

  const existingSpokenTime = params.existingFutureEvent?.start_at
    ? formatForSpeechFromIso(params.existingFutureEvent.start_at)
    : "an already confirmed future time";

  const payload: CalendarConflictResult = {
    status: "CONFLICT",
    flow_mode: params.flowMode,
    existing_booking: params.existingBooking,
    calendar_event_id: params.existingFutureEvent?.id ?? null,
    provider_id: params.attemptRow.provider_id ?? null,
    app_user_id: params.attemptRow.app_user_id ?? null,
    start_at: params.existingFutureEvent?.start_at ?? null,
    end_at: params.existingFutureEvent?.end_at ?? null,
    booking_summary: bookingSummary,
    message_to_say: `I already see a confirmed appointment on the calendar for ${existingSpokenTime}. Could we look at another time?`,
    next_action: "REQUEST_ALTERNATE_SLOT",
    conflict_reason: "EXISTING_FUTURE_CONFIRMED_EVENT",
  };

  return {
    toolCallId: params.toolCallId,
    result: JSON.stringify(payload),
  };
}

function isInvariantViolationMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("qbh invariant violation") ||
    normalized.includes("multiple future confirmed calendar events") ||
    normalized.includes(
      "uq_calendar_events_provider_user_future_confirmed"
    )
  );
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

    attemptRow.provider_id = providerIdMaybeUuid;
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

  if (!attemptRow.app_user_id || !attemptRow.provider_id) {
    return toolError(toolCallId, {
      stage: "attempt_missing_identity_context",
      app_user_id: attemptRow.app_user_id ?? null,
      provider_id: attemptRow.provider_id ?? null,
    });
  }

  const { data: existingFutureEvent, error: existingFutureEventError } =
    await supabaseAdmin
      .from("calendar_events")
      .select("id, start_at, end_at, timezone")
      .eq("app_user_id", attemptRow.app_user_id)
      .eq("provider_id", attemptRow.provider_id)
      .eq("status", "confirmed")
      .gte("start_at", new Date().toISOString())
      .neq("proposal_id", proposalIdStr)
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle();

  if (existingFutureEventError) {
    return toolError(toolCallId, {
      stage: "existing_future_event_read_failed",
      message: existingFutureEventError.message,
    });
  }

  if (existingFutureEvent) {
    if (flowMode === "ADJUST") {
      // In ADJUST mode, cancel the existing event to make room for the new confirmed slot.
      const { error: cancelError } = await supabaseAdmin
        .from("calendar_events")
        .update({ status: "cancelled" })
        .eq("id", existingFutureEvent.id);

      if (cancelError) {
        return toolError(toolCallId, {
          stage: "cancel_existing_event_failed",
          message: cancelError.message,
        });
      }
      // Fall through to finalize_confirm_booking with the old event cleared.
    } else {
      const conflictMetadata: JsonRecord = {
        ...(asRecord(attemptRow.metadata) ?? {}),
        last_event: "EXISTING_FUTURE_CONFIRMED_EVENT",
      };

      const { error: metadataConflictUpdateError } = await supabaseAdmin
        .from("schedule_attempts")
        .update({
          metadata: conflictMetadata,
        })
        .eq("id", attemptIdStr);

      if (metadataConflictUpdateError) {
        return toolError(toolCallId, {
          stage: "attempt_conflict_metadata_update_failed",
          message: metadataConflictUpdateError.message,
        });
      }

      return buildConflictResult({
        toolCallId,
        flowMode,
        existingBooking,
        attemptRow,
        proposal,
        existingFutureEvent,
      });
    }
  }

  const { data, error } = await supabaseAdmin.rpc("finalize_confirm_booking", {
    p_attempt_id: attemptIdStr,
    p_proposal_id: proposalIdStr,
  });

  if (error) {
    if (isInvariantViolationMessage(error.message)) {
      const { data: conflictedFutureEvent } = await supabaseAdmin
        .from("calendar_events")
        .select("id, start_at, end_at, timezone")
        .eq("app_user_id", attemptRow.app_user_id)
        .eq("provider_id", attemptRow.provider_id)
        .eq("status", "confirmed")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const conflictMetadata: JsonRecord = {
        ...(asRecord(attemptRow.metadata) ?? {}),
        last_event: "EXISTING_FUTURE_CONFIRMED_EVENT",
      };

      await supabaseAdmin
        .from("schedule_attempts")
        .update({
          metadata: conflictMetadata,
        })
        .eq("id", attemptIdStr);

      return buildConflictResult({
  toolCallId,
  flowMode,
  existingBooking,
  attemptRow,
  proposal,
  existingFutureEvent: conflictedFutureEvent ?? null,
});
    }

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
      app_user_id: data?.app_user_id ?? attemptRow.app_user_id ?? null,
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