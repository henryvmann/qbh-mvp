import { normalizeProviderId, normalizeAttemptId } from "../../../../lib/vapi/ids";
import { generateCandidateSlots } from "../../../../lib/availability/generateCandidateSlots";

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

  const now = new Date();
  const candidate_slots = generateCandidateSlots(now, {
    timezoneOffsetMinutes: now.getTimezoneOffset() * -1,
    businessStartHour: 9,
    businessEndHour: 17,
    slotMinutes: 30,
    count: 3,
  });

  if (!candidate_slots.length) {
    return Response.json({
      results: [
        {
          toolCallId,
          result: JSON.stringify({
            status: "ERROR",
            message_to_say:
              "I’m not seeing any available times right now. I’ll call back shortly.",
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


  const formatSlot = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  const payload = {
    status: "OK",
    message_to_say: (() => {
      const spoken = candidate_slots
        .slice(0, 3)
        .map((s) => formatSlot(s.start));

      if (spoken.length === 0) {
        return "I'm not seeing any available times right now. I'll call back shortly.";
      }

      if (spoken.length === 1) {
        return `We have an opening ${spoken[0]}. Does that work?`;
      }

      if (spoken.length === 2) {
        return `We have openings ${spoken[0]} or ${spoken[1]}. Which works best?`;
      }

      return `We have openings ${spoken[0]}, ${spoken[1]}, or ${spoken[2]}. Which works best for you?`;
    })(),

    next_action: candidate_slots.length ? "ASK_FOR_ALTERNATIVE" : "END_CALL",
    candidate_slots,
  };

  return Response.json({
    results: [{ toolCallId, result: JSON.stringify(payload) }],
  });
}