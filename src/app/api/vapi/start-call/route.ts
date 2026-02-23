import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const {
    office_number,
    attempt_id: attemptIdFromBody,
    provider_id,
    patient_name,
    provider_name,
    preferred_timeframe,
    demo_autoconfirm,
  } = body;

  if (!office_number) {
    return Response.json({ ok: false, error: "office_number is required" }, { status: 400 });
  }

  if (typeof provider_id !== "number") {
    return Response.json({ ok: false, error: "provider_id must be a number" }, { status: 400 });
  }

  // attempt_id is now OPTIONAL (we can create it)
  let attempt_id: number | null =
    typeof attemptIdFromBody === "number" ? attemptIdFromBody : null;

  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

  if (!apiKey || !assistantId || !phoneNumberId) {
    return Response.json(
      {
        ok: false,
        error:
          "Missing env vars: VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID",
      },
      { status: 500 }
    );
  }

  // 1) Create schedule_attempt if attempt_id not provided
  if (!attempt_id) {
    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("schedule_attempts")
      .insert({
        provider_id,
        patient_name: patient_name ?? null,
        provider_name: provider_name ?? null,
        preferred_timeframe: preferred_timeframe ?? null,
        demo_autoconfirm: Boolean(demo_autoconfirm),
        office_phone: office_number ?? null,
        status: "INITIATED",
        metadata: { source: "start-call" },
      })
      .select("id")
      .single();

    if (attemptErr || !attempt?.id) {
      return Response.json(
        { ok: false, error: "Failed to create schedule_attempt", detail: attemptErr?.message },
        { status: 500 }
      );
    }

    attempt_id = attempt.id;
  }

  // 2) Create Vapi call
  const vapiRes = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phoneNumberId,
      assistantId,
      customer: {
        number: office_number,
        numberE164CheckEnabled: false,
      },
      assistantOverrides: {
        variableValues: {
          attempt_id,
          provider_id,
          patient_name,
          provider_name,
          preferred_timeframe,
          demo_autoconfirm: Boolean(demo_autoconfirm),
        },
      },
    }),
  });

  let data: any = {};
  try {
    data = await vapiRes.json();
  } catch {
    data = {};
  }

  // If Vapi failed, mark attempt FAILED (best-effort)
  if (!vapiRes.ok) {
    await supabaseAdmin
      .from("schedule_attempts")
      .update({
        status: "FAILED",
        metadata: {
          last_event: "VAPI_CALL_CREATE_FAILED",
          vapi_status: vapiRes.status,
          vapi_error: data,
        },
      })
      .eq("id", attempt_id);

    // optional event log
    await supabaseAdmin.from("call_events").insert({
      attempt_id,
      source: "api",
      event_type: "vapi_call_create_failed",
      tool_name: "start-call",
      tool_payload: { vapi_status: vapiRes.status },
      vapi_event: data,
    });

    return Response.json(
      { ok: false, error: "Vapi call create failed", status: vapiRes.status, data, attempt_id },
      { status: 500 }
    );
  }

  // 3) Update attempt with vapi_call_id + status (best-effort)
  const vapi_call_id = data?.id ?? data?.call?.id ?? null;

  await supabaseAdmin
    .from("schedule_attempts")
    .update({
      status: "CALL_STARTED",
      vapi_call_id,
      vapi_assistant_id: assistantId,
      office_phone: office_number ?? null,
      metadata: { last_event: "CALL_STARTED" },
    })
    .eq("id", attempt_id);

  // optional event log
  await supabaseAdmin.from("call_events").insert({
    attempt_id,
    source: "api",
    event_type: "call_started",
    tool_name: "start-call",
    tool_payload: { provider_id, demo_autoconfirm: Boolean(demo_autoconfirm) },
    vapi_event: data,
  });

  return Response.json({ ok: true, attempt_id, vapi: data });
}