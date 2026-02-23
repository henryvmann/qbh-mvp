import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  console.log("PROPOSE_OFFICE_SLOT:", JSON.stringify(body, null, 2));

  const toolCallId = body?.toolCallId || body?.tool_call_id || body?.id;
  if (!toolCallId) {
    // Still return 200 per Vapi docs; embed the error in results array.
    return Response.json({
      results: [
        { toolCallId: "missing_toolCallId", error: "Missing toolCallId in request payload" },
      ],
    });
  }

  // Pull attempt_id/provider_id from payload if present (Vapi tool calls often include assistant variableValues)
  const attempt_id_raw =
    body?.attempt_id ??
    body?.attemptId ??
    body?.variableValues?.attempt_id ??
    body?.assistantOverrides?.variableValues?.attempt_id;

  const provider_id_raw =
    body?.provider_id ??
    body?.providerId ??
    body?.variableValues?.provider_id ??
    body?.assistantOverrides?.variableValues?.provider_id;

  const attempt_id = typeof attempt_id_raw === "number" ? attempt_id_raw : Number(attempt_id_raw);
  const provider_id =
    typeof provider_id_raw === "number" ? provider_id_raw : Number(provider_id_raw);

  if (!Number.isFinite(attempt_id)) {
    // Still return 200 with tool result wrapper, but make the failure explicit.
    const payload = {
      message_to_say: "I’m sorry — I’m missing the scheduling attempt context. Could you repeat the available slot?",
      next_action: "WAIT_FOR_USER_APPROVAL",
      proposal_id: null,
      conflict: false,
      office_offer_raw: body?.office_offer?.raw_text || "",
      error: "Missing or invalid attempt_id",
    };
    return Response.json({ results: [{ toolCallId, result: JSON.stringify(payload) }] });
  }

  const raw: string = body?.office_offer?.raw_text || "";
  const autoConfirm = Boolean(body?.demo_autoconfirm);

  // Business logic (same as your current)
  const message_to_say = autoConfirm
    ? "Auto-confirm enabled. Proceed to confirm."
    : "Slot recorded. Awaiting patient approval.";

  const next_action = autoConfirm ? "CONFIRM_BOOKING" : "WAIT_FOR_USER_APPROVAL";

  // 1) Insert proposal into Supabase
  const { data: proposal, error: propErr } = await supabaseAdmin
    .from("proposals")
    .insert({
      attempt_id,
      tool_call_id: toolCallId,
      office_offer_raw_text: raw || "(empty)",
      conflict: false,
      message_to_say,
      next_action,
      status: "PROPOSED",
      payload: {
        provider_id: Number.isFinite(provider_id) ? provider_id : null,
        demo_autoconfirm: autoConfirm,
        raw_request: body,
      },
    })
    .select("id")
    .single();

  // 2) Best-effort update attempt status
  if (!propErr && proposal?.id) {
    await supabaseAdmin
      .from("schedule_attempts")
      .update({ status: "PROPOSED", metadata: { last_event: "PROPOSE_OFFICE_SLOT" } })
      .eq("id", attempt_id);

    // Optional event log
    await supabaseAdmin.from("call_events").insert({
      attempt_id,
      source: "tool",
      event_type: "proposal_created",
      tool_name: "propose-office-slot",
      tool_payload: { toolCallId, next_action, conflict: false },
      vapi_event: body,
    });
  } else {
    // Optional event log on failure
    await supabaseAdmin.from("call_events").insert({
      attempt_id: Number.isFinite(attempt_id) ? attempt_id : null,
      source: "tool",
      event_type: "proposal_create_failed",
      tool_name: "propose-office-slot",
      tool_payload: { toolCallId, error: propErr?.message },
      vapi_event: body,
    });
  }

  // IMPORTANT: result must be a single-line STRING
  const payload = {
    message_to_say,
    next_action,
    proposal_id: proposal?.id ?? null, // Supabase UUID
    conflict: false,
    office_offer_raw: raw,
    // If insert failed, include error (but still return wrapper)
    ...(propErr ? { error: propErr.message } : {}),
  };

  return Response.json({
    results: [{ toolCallId, result: JSON.stringify(payload) }],
  });
}