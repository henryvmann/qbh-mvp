import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  console.log("CONFIRM_BOOKING:", JSON.stringify(body, null, 2));

  const toolCallId = body?.toolCallId || body?.tool_call_id || body?.id;
  if (!toolCallId) {
    return Response.json({
      results: [
        { toolCallId: "missing_toolCallId", error: "Missing toolCallId in request payload" },
      ],
    });
  }

  // Pull attempt_id + proposal_id from common locations
  const attempt_id_raw =
    body?.attempt_id ??
    body?.attemptId ??
    body?.variableValues?.attempt_id ??
    body?.assistantOverrides?.variableValues?.attempt_id;

  const proposal_id =
    body?.proposal_id ??
    body?.proposalId ??
    body?.variableValues?.proposal_id ??
    body?.assistantOverrides?.variableValues?.proposal_id ??
    null;

  const attempt_id = typeof attempt_id_raw === "number" ? attempt_id_raw : Number(attempt_id_raw);

  // If missing context, still return wrapper but embed error
  if (!Number.isFinite(attempt_id) || !proposal_id) {
    const payload = {
      message_to_say:
        "Thanks — I’m having trouble recording the booking details on my side, but I have the appointment noted. Have a great day.",
      next_action: "END_CALL",
      status: "BOOKED",
      attempt_id: Number.isFinite(attempt_id) ? attempt_id : null,
      proposal_id: proposal_id ?? null,
      error: "Missing or invalid attempt_id/proposal_id",
    };

    return Response.json({
      results: [{ toolCallId, result: JSON.stringify(payload) }],
    });
  }

  // 1) Mark proposal CONFIRMED
  const { error: propErr } = await supabaseAdmin
    .from("proposals")
    .update({
      status: "CONFIRMED",
      next_action: "END_CALL",
    })
    .eq("id", proposal_id)
    .eq("attempt_id", attempt_id);

  // 2) Mark attempt BOOKED
  const { error: attErr } = await supabaseAdmin
    .from("schedule_attempts")
    .update({
      status: "BOOKED",
      metadata: { last_event: "CONFIRM_BOOKING" },
    })
    .eq("id", attempt_id);

  // 3) Event log (best-effort)
  await supabaseAdmin.from("call_events").insert({
    attempt_id,
    source: "tool",
    event_type: "booking_confirmed",
    tool_name: "confirm-booking",
    tool_payload: { toolCallId, proposal_id, proposal_update_error: propErr?.message, attempt_update_error: attErr?.message },
    vapi_event: body,
  });

  const payload = {
    message_to_say: "Perfect — thank you. The patient will see you then. Have a great day.",
    next_action: "END_CALL",
    status: "BOOKED",
    attempt_id,
    proposal_id,
    ...(propErr ? { proposal_update_error: propErr.message } : {}),
    ...(attErr ? { attempt_update_error: attErr.message } : {}),
  };

  return Response.json({
    results: [{ toolCallId, result: JSON.stringify(payload) }],
  });
}