export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  console.log("GET_CANDIDATE_SLOTS:", JSON.stringify(body, null, 2));

  const toolCallId = body?.toolCallId || body?.tool_call_id || body?.id;
  if (!toolCallId) {
    return Response.json({
      results: [{ toolCallId: "missing_toolCallId", error: "Missing toolCallId in request payload" }]
    });
  }

  const payload = {
    message_to_say:
      "We’re available Feb 21 at 10:00 AM, Feb 21 at 2:00 PM, or Feb 24 at 9:00 AM. Do any of those work?",
    next_action: "ASK_FOR_ALTERNATIVE",
    candidate_slots: [
      { start: "2026-02-21T10:00:00-05:00", end: "2026-02-21T10:30:00-05:00" },
      { start: "2026-02-21T14:00:00-05:00", end: "2026-02-21T14:30:00-05:00" },
      { start: "2026-02-24T09:00:00-05:00", end: "2026-02-24T09:30:00-05:00" }
    ]
  };

  return Response.json({
    results: [{ toolCallId, result: JSON.stringify(payload) }]
  });
}
