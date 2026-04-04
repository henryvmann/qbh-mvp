export const dynamic = 'force-dynamic';
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getAvailabilityContext } from "../../../../lib/availability";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

type JsonRecord = Record<string, unknown>;

type StartCallMode = "BOOK" | "ADJUST";

type BookedAppointmentSummary = {
  status: "BOOKED_CONFIRMED";
  display_time: string | null;
  appointment_start: string | null;
  appointment_end: string | null;
  timezone: string | null;
  provider_id: string | null;
  calendar_event_id: string | null;
};

type ExistingBookedAppointment = {
  source_attempt_id: number;
  booking_summary: BookedAppointmentSummary;
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getStartCallMode(value: unknown): StartCallMode {
  return String(value || "").trim().toUpperCase() === "ADJUST"
    ? "ADJUST"
    : "BOOK";
}

function buildAvailabilityWindow() {
  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  return {
    windowStart,
    windowEnd,
    timezone: "America/New_York",
  };
}

async function buildStartCallAvailabilityContext(appUserId: string) {
  try {
    const window = buildAvailabilityWindow();

    const availability = await getAvailabilityContext({
      app_user_id: appUserId,
      window_start: window.windowStart,
      window_end: window.windowEnd,
      timezone: window.timezone,
      include_sources: ["GOOGLE_CALENDAR"],
    });

    return {
      calendar_connected: availability.source_summaries.some(
        (summary) => summary.source === "GOOGLE_CALENDAR" && summary.ok
      ),
      time_min: availability.window_start,
      time_max: availability.window_end,
      time_zone: availability.timezone,
      busy_blocks: availability.blocks,
      busy_block_count: availability.blocks.filter(
        (block) => block.kind === "BUSY"
      ).length,
      source_summaries: availability.source_summaries,
    };
  } catch (error) {
    return {
      calendar_connected: false,
      time_min: null,
      time_max: null,
      time_zone: "America/New_York",
      busy_blocks: [],
      busy_block_count: 0,
      source_summaries: [],
      availability_error:
        error instanceof Error ? error.message : "availability_fetch_failed",
    };
  }
}

async function getExistingBookedAppointment(
  appUserId: string,
  providerId: string
): Promise<ExistingBookedAppointment | null> {
  const { data, error } = await supabaseAdmin
    .from("schedule_attempts")
    .select("id,status,metadata,created_at")
    .eq("app_user_id", appUserId)
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: number | string;
    status: string | null;
    metadata: unknown;
    created_at: string;
  }>;

  for (const row of rows) {
    const metadata = asRecord(row.metadata);
    const bookingSummary = asRecord(metadata?.booking_summary);
    const bookingStatus =
      typeof bookingSummary?.status === "string" ? bookingSummary.status : null;
    const lastEvent =
      typeof metadata?.last_event === "string" ? metadata.last_event : null;

    const isBooked =
      bookingStatus === "BOOKED_CONFIRMED" ||
      row.status === "BOOKED_CONFIRMED" ||
      lastEvent === "BOOKED_CONFIRMED";

    if (!isBooked) continue;

    return {
      source_attempt_id: Number(row.id),
      booking_summary: {
        status: "BOOKED_CONFIRMED",
        display_time: asNullableString(bookingSummary?.display_time),
        appointment_start: asNullableString(bookingSummary?.appointment_start),
        appointment_end: asNullableString(bookingSummary?.appointment_end),
        timezone: asNullableString(bookingSummary?.timezone),
        provider_id: asNullableString(bookingSummary?.provider_id),
        calendar_event_id: asNullableString(bookingSummary?.calendar_event_id),
      },
    };
  }

  return null;
}

function buildAttemptMetadata(params: {
  mode: StartCallMode;
  availabilityContext: Awaited<ReturnType<typeof buildStartCallAvailabilityContext>>;
  existingBookedAppointment: ExistingBookedAppointment | null;
}): JsonRecord {
  const { mode, availabilityContext, existingBookedAppointment } = params;

  if (mode === "ADJUST") {
    return {
      source: "start-call",
      flow_mode: "ADJUST",
      last_event: "ADJUST_STARTED",
      availability_context: availabilityContext,
      existing_booking: existingBookedAppointment,
    };
  }

  return {
    source: "start-call",
    flow_mode: "BOOK",
    last_event: "BOOKING_STARTED",
    availability_context: availabilityContext,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const office_number = String(
    body?.office_number || process.env.QBH_DEMO_CALL_DESTINATION || ""
  ).trim();
  const provider_id = String(body?.provider_id || "").trim();
  const attemptIdFromBody = body?.attempt_id
    ? String(body.attempt_id).trim()
    : null;

  const patient_name = body?.patient_name ?? null;
  const provider_name = body?.provider_name ?? null;
  const preferred_timeframe = body?.preferred_timeframe ?? null;
  const demo_autoconfirm =
    typeof body?.demo_autoconfirm === "boolean" ? body.demo_autoconfirm : true;

  const mode = getStartCallMode(body?.mode);

  const app_user_id = await getSessionAppUserId(req);

  if (!app_user_id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Fetch patient profile for the call
  const { data: userRow } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", app_user_id)
    .single();

  const patientProfile = (userRow?.patient_profile || {}) as Record<string, string | null>;

  if (!office_number) {
    return Response.json(
      { ok: false, error: "office_number is required" },
      { status: 400 }
    );
  }

  if (!provider_id) {
    return Response.json(
      { ok: false, error: "provider_id is required" },
      { status: 400 }
    );
  }

  let attempt_id: string | null = attemptIdFromBody;

  const apiKey = process.env.VAPI_API_KEY;
  const assistantId =
    process.env.USE_TEST_ASSISTANT === "true"
      ? process.env.VAPI_ASSISTANT_ID_TEST
      : process.env.VAPI_ASSISTANT_ID;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

  if (!apiKey || !assistantId || !phoneNumberId) {
    return Response.json(
      {
        ok: false,
        error:
          "Missing env vars: VAPI_API_KEY, VAPI_ASSISTANT_ID (or VAPI_ASSISTANT_ID_TEST when USE_TEST_ASSISTANT=true), VAPI_PHONE_NUMBER_ID",
      },
      { status: 500 }
    );
  }

  console.log("qbh start-call using assistant:", assistantId);

  const availabilityContext = await buildStartCallAvailabilityContext(
    app_user_id
  );

  const existingBookedAppointment =
    mode === "ADJUST"
      ? await getExistingBookedAppointment(app_user_id, provider_id)
      : null;

  if (mode === "ADJUST" && !existingBookedAppointment) {
    return Response.json(
      {
        ok: false,
        error: "No existing booked appointment found for adjust flow.",
      },
      { status: 400 }
    );
  }

  const metadata = buildAttemptMetadata({
    mode,
    availabilityContext,
    existingBookedAppointment,
  });

  if (!attempt_id) {
    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("schedule_attempts")
      .insert({
        app_user_id,
        provider_id,
        patient_name,
        provider_name,
        preferred_timeframe,
        demo_autoconfirm,
        office_phone: office_number,
        status: "CREATED",
        metadata,
      })
      .select("id")
      .single();

    if (attemptErr || !attempt?.id) {
      return Response.json(
        {
          ok: false,
          error: "Failed to create schedule_attempt",
          detail: attemptErr?.message,
        },
        { status: 500 }
      );
    }

    attempt_id = String(attempt.id);
  } else {
    const { error: updateErr } = await supabaseAdmin
      .from("schedule_attempts")
      .update({
        app_user_id,
        provider_id,
        patient_name,
        provider_name,
        preferred_timeframe,
        demo_autoconfirm,
        office_phone: office_number,
        status: "CREATED",
        metadata,
      })
      .eq("id", attempt_id);

    if (updateErr) {
      return Response.json(
        {
          ok: false,
          error: "Failed to update schedule_attempt",
          detail: updateErr.message,
        },
        { status: 500 }
      );
    }
  }

  const vapiRes = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phoneNumberId,
      assistantId,
      customer: { number: office_number, numberE164CheckEnabled: false },
      assistantOverrides: {
        variableValues: {
          attempt_id,
          provider_id,
          patient_name: patient_name || patientProfile.full_name || null,
          provider_name,
          preferred_timeframe,
          demo_autoconfirm,
          mode,
          patient_date_of_birth: patientProfile.date_of_birth || null,
          patient_insurance_provider: patientProfile.insurance_provider || null,
          patient_insurance_member_id: patientProfile.insurance_member_id || null,
          patient_reason_for_visit: "routine checkup / follow-up",
        },
      },
    }),
  });

  let data: unknown = {};
  try {
    data = await vapiRes.json();
  } catch {
    data = {};
  }

  if (!vapiRes.ok) {
    await supabaseAdmin
      .from("schedule_attempts")
      .update({
        status: "FAILED",
        metadata: {
          ...metadata,
          last_event: "VAPI_CALL_CREATE_FAILED",
          vapi_status: vapiRes.status,
          vapi_error: data,
        },
      })
      .eq("id", attempt_id);

    return Response.json(
      {
        ok: false,
        error: "Vapi call create failed",
        status: vapiRes.status,
        data,
        attempt_id,
      },
      { status: 500 }
    );
  }

  const vapiPayload = asRecord(data);
  const nestedCall = asRecord(vapiPayload?.call);
  const vapi_call_id =
    asNullableString(vapiPayload?.id) ?? asNullableString(nestedCall?.id);

  await supabaseAdmin
    .from("schedule_attempts")
    .update({
      status: "CALLING",
      vapi_call_id,
      vapi_assistant_id: assistantId,
      office_phone: office_number,
      metadata: {
        ...metadata,
        last_event: "CALLING",
      },
    })
    .eq("id", attempt_id);

  return Response.json({
    ok: true,
    attempt_id,
    mode,
    availability_context: availabilityContext,
    existing_booking: existingBookedAppointment,
    vapi: data,
  });
}