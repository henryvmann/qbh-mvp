import { normalizeProviderId, normalizeAttemptId } from "../../../../lib/vapi/ids";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const toolCallId = body?.toolCallId || body?.tool_call_id || body?.id;
  if (!toolCallId) {
    return Response.json({
      results: [
        {
          toolCallId: "missing_toolCallId",
          result: JSON.stringify({
            status: "ERROR",
            message_to_say: "There was a system issue. I will call back shortly.",
            next_action: "END_CALL",
          }),
        },
      ],
    });
  }

  // ✅ normalize AFTER toolCallId exists so we can always respond
  let providerId: string;
  let attemptId: number;
  try {
    providerId = normalizeProviderId(body.provider_id);
    attemptId = normalizeAttemptId(body.attempt_id);
  } catch (e: any) {
    return Response.json({
      results: [
        {
          toolCallId,
          result: JSON.stringify({
            status: "ERROR",
            message_to_say: "There was a system issue. I will call back shortly.",
            next_action: "END_CALL",
            error: e?.message ?? "Invalid identifiers",
          }),
        },
      ],
    });
  }

  console.log("GET_CANDIDATE_SLOTS:", { toolCallId, providerId, attemptId });

  const payload = {
    status: "OK",
    message_to_say:
      "We’re available Feb 21 at 10:00 AM, Feb 21 at 2:00 PM, or Feb 24 at 9:00 AM. Do any of those work?",
    next_action: "ASK_FOR_ALTERNATIVE",
    candidate_slots: [
      { start: "2026-02-21T10:00:00-05:00", end: "2026-02-21T10:30:00-05:00" },
      { start: "2026-02-21T14:00:00-05:00", end: "2026-02-21T14:30:00-05:00" },
      { start: "2026-02-24T09:00:00-05:00", end: "2026-02-24T09:30:00-05:00" },
    ],
  };

  return Response.json({
    results: [{ toolCallId, result: JSON.stringify(payload) }],
  });
}