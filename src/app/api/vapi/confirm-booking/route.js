export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  console.log("CONFIRM_BOOKING:", JSON.stringify(body, null, 2));

  const toolCallId = body?.toolCallId || body?.tool_call_id || body?.id;
  if (!toolCallId) {
    return Response.json({
      results: [{ toolCallId: "missing_toolCallId", error: "Missing toolCallId in request payload" }]
    });
  }

  const payload = {
    message_to_say: "Perfect — thank you. The patient will see you then. Have a great day.",
    next_action: "END_CALL",
    status: "BOOKED",
    attempt_id: body?.attempt_id,
    proposal_id: body?.proposal_id
  };

  return Response.json({
    results: [{ toolCallId, result: JSON.stringify(payload) }]
  });
}
