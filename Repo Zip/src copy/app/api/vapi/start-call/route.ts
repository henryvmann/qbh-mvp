import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const office_number = String(
    body?.office_number || process.env.QBH_DEMO_CALL_DESTINATION || ""
  ).trim();
  const provider_id = String(body?.provider_id || "").trim();
  const attemptIdFromBody = body?.attempt_id ? String(body.attempt_id).trim() : null;

  const patient_name = body?.patient_name ?? null;
  const provider_name = body?.provider_name ?? null;
  const preferred_timeframe = body?.preferred_timeframe ?? null;
  const demo_autoconfirm =
    typeof body?.demo_autoconfirm === "boolean" ? body.demo_autoconfirm : true;

  const user_id = process.env.QBH_DEMO_USER_ID;

  if (!office_number) {
    return Response.json({ ok: false, error: "office_number is required" }, { status: 400 });
  }
  if (!provider_id) {
    return Response.json({ ok: false, error: "provider_id is required" }, { status: 400 });
  }
  if (!user_id) {
    return Response.json({ ok: false, error: "QBH_DEMO_USER_ID not set" }, { status: 500 });
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

  console.log("QBH start-call using assistant:", assistantId);

  // 1) Ensure schedule_attempt exists
  if (!attempt_id) {
    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("schedule_attempts")
      .insert({
        user_id,
        provider_id,
        patient_name,
        provider_name,
        preferred_timeframe,
        demo_autoconfirm,
        office_phone: office_number,
        status: "CREATED",
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

    attempt_id = String(attempt.id);
  } else {
    await supabaseAdmin
      .from("schedule_attempts")
      .update({
        provider_id,
        patient_name,
        provider_name,
        preferred_timeframe,
        demo_autoconfirm,
        office_phone: office_number,
        status: "CREATED",
        metadata: { last_event: "START_CALL_REUSED_ATTEMPT" },
      })
      .eq("id", attempt_id);
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
      customer: { number: office_number, numberE164CheckEnabled: false },
      assistantOverrides: {
        variableValues: {
          attempt_id,
          provider_id,
          patient_name,
          provider_name,
          preferred_timeframe,
          demo_autoconfirm,
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

    return Response.json(
      { ok: false, error: "Vapi call create failed", status: vapiRes.status, data, attempt_id },
      { status: 500 }
    );
  }

  const vapi_call_id = data?.id ?? data?.call?.id ?? null;

  await supabaseAdmin
    .from("schedule_attempts")
    .update({
      status: "CALLING",
      vapi_call_id,
      vapi_assistant_id: assistantId,
      office_phone: office_number,
      metadata: { last_event: "CALLING" },
    })
    .eq("id", attempt_id);

  return Response.json({ ok: true, attempt_id, vapi: data });
}