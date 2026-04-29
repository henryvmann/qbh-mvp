export const dynamic = 'force-dynamic';
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getAvailabilityContext } from "../../../../lib/availability";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { logAudit } from "../../../../lib/audit";

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

/**
 * Strip credential prefixes (DDS, MD, D.D.S., etc.) from a provider name
 * and return a natural-sounding name for speech.
 * e.g. "DDS Eric Echelman" → "Eric Echelman"
 *      "D.D.S. ERIC ECHELMAN" → "Eric Echelman"
 */
function cleanProviderNameForSpeech(raw: string | null | undefined): string {
  if (!raw) return "";
  let name = raw.trim();

  // Credential prefixes to strip (order matters — check longer/dotted forms first)
  const prefixes = [
    /^D\.?D\.?S\.?\s+/i,
    /^M\.?D\.?\s+/i,
    /^D\.?O\.?\s+/i,
    /^N\.?P\.?\s+/i,
    /^P\.?A\.?\s+/i,
    /^A\.?P\.?R\.?N\.?\s+/i,
    /^D\.?M\.?D\.?\s+/i,
    /^O\.?D\.?\s+/i,
    /^D\.?C\.?\s+/i,
    /^R\.?N\.?\s+/i,
    /^L\.?P\.?N\.?\s+/i,
    /^L\.?C\.?S\.?W\.?\s+/i,
    /^L\.?M\.?F\.?T\.?\s+/i,
    /^Psy\.?D\.?\s+/i,
    /^Ph\.?D\.?\s+/i,
    /^Dr\.?\s+/i,
    /^DDS\s+/i,
    /^MD\s+/i,
    /^DO\s+/i,
    /^NP\s+/i,
    /^PA\s+/i,
    /^APRN\s+/i,
    /^DMD\s+/i,
    /^OD\s+/i,
    /^DC\s+/i,
    /^RN\s+/i,
    /^LPN\s+/i,
    /^LCSW\s+/i,
    /^LMFT\s+/i,
    /^PsyD\s+/i,
    /^PhD\s+/i,
  ];

  for (const prefix of prefixes) {
    name = name.replace(prefix, "");
  }

  // Title-case if the name is ALL-CAPS (e.g. "ERIC ECHELMAN" → "Eric Echelman")
  if (name === name.toUpperCase() && name.length > 1) {
    name = name
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return name.trim();
}

/**
 * Format a patient name for clear speech.
 * "Thistle Mann" → "Thistle, Mann" — the comma adds a pause so TTS doesn't run names together.
 */
function formatNameForSpeech(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 2) {
    // Add comma between first and last for a natural pause
    return `${parts[0]}, ${parts[1]}`;
  }
  return name;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Format DOB as fully written-out words for voice: "October twenty-second, nineteen eighty-nine" */
function formatDobForSpeech(dob: string | null | undefined): string | null {
  if (!dob) return null;
  try {
    const d = new Date(dob + (dob.includes("T") ? "" : "T00:00:00"));
    if (isNaN(d.getTime())) return dob;

    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const ordinals: Record<number, string> = {
      1:"first",2:"second",3:"third",4:"fourth",5:"fifth",6:"sixth",7:"seventh",
      8:"eighth",9:"ninth",10:"tenth",11:"eleventh",12:"twelfth",13:"thirteenth",
      14:"fourteenth",15:"fifteenth",16:"sixteenth",17:"seventeenth",18:"eighteenth",
      19:"nineteenth",20:"twentieth",21:"twenty-first",22:"twenty-second",23:"twenty-third",
      24:"twenty-fourth",25:"twenty-fifth",26:"twenty-sixth",27:"twenty-seventh",
      28:"twenty-eighth",29:"twenty-ninth",30:"thirtieth",31:"thirty-first",
    };

    const ones = ["","one","two","three","four","five","six","seven","eight","nine",
      "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen",
      "eighteen","nineteen"];
    const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

    function yearToWords(y: number): string {
      if (y >= 1900 && y <= 1999) {
        const suffix = y - 1900;
        if (suffix < 20) return `nineteen ${ones[suffix]}`;
        const t = Math.floor(suffix / 10);
        const o = suffix % 10;
        return `nineteen ${tens[t]}${o > 0 ? "-" + ones[o] : ""}`;
      }
      if (y >= 2000 && y <= 2009) return `two thousand${y > 2000 ? " " + ones[y - 2000] : ""}`;
      if (y >= 2010 && y <= 2029) {
        const suffix = y - 2000;
        if (suffix < 20) return `twenty ${ones[suffix]}`;
        const t = Math.floor(suffix / 10);
        const o = suffix % 10;
        return `twenty ${tens[t]}${o > 0 ? "-" + ones[o] : ""}`;
      }
      return String(y);
    }

    const month = months[d.getUTCMonth()];
    const day = ordinals[d.getUTCDate()] || String(d.getUTCDate());
    const year = yearToWords(d.getUTCFullYear());

    return `${month} ${day}, ${year}`;
  } catch {
    return dob;
  }
}

/** Format member ID with dashes for slower speech: "J-Q-U - 8-8-9 - A-P - 1-1-2-9-4-3" */
function formatMemberIdForSpeech(id: string | null | undefined): string | null {
  if (!id) return null;
  const chars = id.replace(/[\s-]/g, "").split("");
  // Group into chunks of 3
  const groups: string[] = [];
  for (let i = 0; i < chars.length; i += 3) {
    groups.push(chars.slice(i, i + 3).join("-"));
  }
  return groups.join(" ... ");
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

  let office_number = String(
    body?.office_number || ""
  ).trim();
  const provider_id = String(body?.provider_id || "").trim();
  const attemptIdFromBody = body?.attempt_id
    ? String(body.attempt_id).trim()
    : null;

  const patient_name = body?.patient_name ?? null;
  const provider_name = body?.provider_name ?? null;
  let preferred_timeframe = body?.preferred_timeframe ?? null;
  const demo_autoconfirm =
    typeof body?.demo_autoconfirm === "boolean" ? body.demo_autoconfirm : true;

  const mode = getStartCallMode(body?.mode);

  let app_user_id = await getSessionAppUserId(req);

  // Allow server-to-server calls (from test-loop cron) with app_user_id in body
  if (!app_user_id && body?.app_user_id) {
    app_user_id = String(body.app_user_id).trim();
  }

  if (!app_user_id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  logAudit({ appUserId: app_user_id, action: "initiate_call", resourceType: "call", resourceId: provider_id, ipAddress: ip });

  // Fetch patient profile for the call
  const { data: userRow } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile, auth_user_id, subscription_status, free_calls_used")
    .eq("id", app_user_id)
    .single();

  // Increment free call counter for non-subscribers
  const subStatus = (userRow as Record<string, unknown>)?.subscription_status as string | null;
  if (subStatus !== "active" && subStatus !== "trialing") {
    const used = ((userRow as Record<string, unknown>)?.free_calls_used as number) || 0;
    await supabaseAdmin
      .from("app_users")
      .update({ free_calls_used: used + 1 })
      .eq("id", app_user_id);
  }

  const patientProfile = (userRow?.patient_profile || {}) as Record<string, any>;

  // Build preferred timeframe from availability settings if not explicitly passed
  if (!preferred_timeframe) {
    const days = patientProfile.availability_days as string[] | null;
    const time = patientProfile.availability_time as string | null;
    const notes = patientProfile.availability_notes as string | null;
    const parts: string[] = [];
    if (days && days.length > 0 && days.length < 6) parts.push(days.join(", "));
    if (time === "morning") parts.push("mornings (8am to noon)");
    else if (time === "afternoon") parts.push("afternoons (noon to 5pm)");
    if (notes) parts.push(notes);
    if (parts.length > 0) preferred_timeframe = parts.join(" — ");
  }

  // Resolve patient full name: body > profile > auth metadata
  let resolvedPatientName = patient_name || patientProfile.full_name || null;
  if (!resolvedPatientName && userRow?.auth_user_id) {
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userRow.auth_user_id);
      resolvedPatientName = authUser?.user?.user_metadata?.name || null;
    } catch {
      // Non-critical
    }
  }

  // Require full name (first + last) for calls
  if (!resolvedPatientName || !resolvedPatientName.includes(" ")) {
    return Response.json(
      { ok: false, error: "Full name (first and last) is required before Kate can call. Please update your profile." },
      { status: 400 }
    );
  }

  // Calling hours restriction removed — Kate can call anytime for testing

  // office_number validated after provider lookup + demo fallback (below)

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

  // Check if this is a manually-added provider and get doctor_name + phone if available
  const { data: providerRow } = await supabaseAdmin
    .from("providers")
    .select("source, doctor_name, phone_number")
    .eq("id", provider_id)
    .single();

  const isManualProvider = providerRow?.source === "manual";
  // Use doctor_name if set, otherwise use provider_name if it looks like a person's name (2-3 words, no business keywords)
  let doctorName = (providerRow?.doctor_name || "").trim();
  if (!doctorName && provider_name) {
    // Strip credentials from both front and back
    let cleaned = provider_name
      .replace(/,\s*(DDS|MD|DO|NP|PA|OD|DC|DMD|PhD|PsyD|LCSW|LMFT|APRN)$/i, "")
      .replace(/^(D\.?D\.?S\.?|M\.?D\.?|D\.?O\.?|D\.?M\.?D\.?|N\.?P\.?|P\.?A\.?|O\.?D\.?|D\.?C\.?)\s+/i, "")
      .trim();
    // Strip a second time for double credentials
    cleaned = cleaned.replace(/^(D\.?D\.?S\.?|M\.?D\.?|D\.?O\.?)\s+/i, "").trim();
    const words = cleaned.split(/\s+/);
    const businessWords = /\b(health|medical|clinic|center|group|associates|practice|consultants|hospital|care|inc|llc|pc|pllc)\b/i;
    if (words.length >= 2 && words.length <= 4 && !businessWords.test(cleaned)) {
      doctorName = cleaned;
    }
  }

  // Check if patient has visit history with this provider (determines new vs existing)
  let patientStatus = isManualProvider ? "unknown" : "likely_new";
  try {
    const { count: visitCount } = await supabaseAdmin
      .from("provider_visits")
      .select("id", { count: "exact", head: true })
      .eq("app_user_id", app_user_id)
      .eq("provider_id", provider_id);
    if ((visitCount || 0) > 0) patientStatus = "existing";
  } catch {
    // Non-critical — default to unknown
  }

  // Check for existing upcoming appointment with this provider
  let existingAppointmentInfo = "";
  try {
    const { data: existingEvents } = await supabaseAdmin
      .from("calendar_events")
      .select("start_at, timezone")
      .eq("app_user_id", app_user_id)
      .eq("provider_id", provider_id)
      .eq("status", "confirmed")
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(1);
    if (existingEvents && existingEvents.length > 0) {
      const apptDate = new Date(existingEvents[0].start_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
      existingAppointmentInfo = `IMPORTANT: There is already an existing appointment with this provider on ${apptDate}. Before booking a new one, mention this to the office and ask if they'd like to keep it or reschedule.`;
    }
  } catch {}

  // Test mode: if QBH_TEST_MODE=true, always call the demo destination
  const testMode = (process.env.QBH_TEST_MODE || "").trim().toLowerCase() === "true";
  const demoNumber = (process.env.QBH_DEMO_CALL_DESTINATION || "").trim();

  if (testMode && demoNumber) {
    office_number = demoNumber;
  } else {
    // Live mode: body > provider DB > demo fallback
    if (!office_number && providerRow?.phone_number) {
      office_number = providerRow.phone_number.trim();
    }
    if (!office_number) {
      office_number = demoNumber;
    }
  }

  if (!office_number) {
    return Response.json(
      { ok: false, error: "No phone number found for this provider. Add one in provider Details." },
      { status: 400 }
    );
  }

  // Run availability + existing booking checks in parallel with timeout
  const availabilityPromise = Promise.race([
    buildStartCallAvailabilityContext(app_user_id),
    new Promise<Awaited<ReturnType<typeof buildStartCallAvailabilityContext>>>((resolve) =>
      setTimeout(() => resolve({
        calendar_connected: false, time_min: null, time_max: null,
        time_zone: "America/New_York", busy_blocks: [], busy_block_count: 0,
        source_summaries: [], availability_error: "timeout",
      }), 5000)
    ),
  ]);

  const existingBookingPromise = mode === "ADJUST"
    ? getExistingBookedAppointment(app_user_id, provider_id)
    : Promise.resolve(null);

  const [availabilityContext, existingBookedAppointment] = await Promise.all([
    availabilityPromise,
    existingBookingPromise,
  ]);

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
          patient_name: formatNameForSpeech(resolvedPatientName),
          provider_name: cleanProviderNameForSpeech(provider_name),
          preferred_timeframe,
          demo_autoconfirm,
          mode,
          call_purpose: isManualProvider ? "INQUIRY" : mode,
          is_manual_provider: isManualProvider,
          patient_status: patientStatus,
          existing_appointment_note: existingAppointmentInfo || "none",
          doctor_name: doctorName ? (doctorName.match(/^(Dr\.?|Doctor)\s/i) ? doctorName : `Dr. ${doctorName}`) : "not specified",
          patient_date_of_birth: formatDobForSpeech(patientProfile.date_of_birth) || "not available — the patient will provide when they arrive",
          patient_insurance_provider: patientProfile.insurance_provider || "not available — the patient will provide when they arrive",
          patient_insurance_member_id: formatMemberIdForSpeech(patientProfile.insurance_member_id) || "not available — the patient will provide when they arrive",
          patient_callback_phone: patientProfile.callback_phone || "not available",
          patient_reason_for_visit: patientProfile.reason_for_visit || "routine checkup",
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