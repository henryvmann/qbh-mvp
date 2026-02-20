export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const {
    office_number,
    attempt_id,
    provider_id,
    patient_name,
    provider_name,
    preferred_timeframe,
  } = body;

  if (!office_number) {
    return Response.json({ ok: false, error: "office_number is required" }, { status: 400 });
  }
  if (typeof attempt_id !== "number" || typeof provider_id !== "number") {
    return Response.json(
      { ok: false, error: "attempt_id and provider_id must be numbers" },
      { status: 400 }
    );
  }

  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const baseUrl = process.env.PUBLIC_BASE_URL;

  if (!apiKey || !assistantId || !phoneNumberId || !baseUrl) {
    return Response.json(
      { ok: false, error: "Missing env vars: VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID, PUBLIC_BASE_URL" },
      { status: 500 }
    );
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
  customer: {
    number: office_number,
    numberE164CheckEnabled: false
  },
  assistantOverrides: {
    variableValues: {
      attempt_id,
      provider_id,
      patient_name,
      provider_name,
      preferred_timeframe,
    },
  },
}),

  let data = {};
  try {
    data = await vapiRes.json();
  } catch (e) {
    data = {};
}

  if (!vapiRes.ok) {
    return Response.json(
      { ok: false, error: "Vapi call create failed", status: vapiRes.status, data },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, vapi: data });
}
