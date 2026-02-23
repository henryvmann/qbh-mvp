import { supabaseAdmin } from "../../../../lib/supabase-server";

type AnyObj = Record<string, any>;

function toNumber(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function extractToolCalls(body: AnyObj) {
  const list =
    body?.message?.toolCalls ||
    body?.toolCalls ||
    body?.message?.toolCallList ||
    body?.toolCallList ||
    null;

  if (Array.isArray(list) && list.length > 0) return list;

  const toolCallId = body?.toolCallId || body?.tool_call_id || body?.id || null;
  if (!toolCallId) return [];
  return [
    {
      id: toolCallId,
      function: { arguments: body },
    },
  ];
}

function getArgs(toolCall: AnyObj): AnyObj {
  let args = toolCall?.function?.arguments ?? {};
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      args = {};
    }
  }
  return args || {};
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as AnyObj));
  console.log("CONFIRM_BOOKING:", JSON.stringify(body, null, 2));

  const toolCalls = extractToolCalls(body);

  if (!toolCalls.length) {
    return Response.json({
      results: [
        { toolCallId: "missing_toolCallId", error: "Missing toolCallId in request payload" },
      ],
    });
  }

  const results: AnyObj[] = [];

  for (const tc of toolCalls) {
    const toolCallId = tc?.id || body?.toolCallId || body?.tool_call_id || body?.id;

    if (!toolCallId) {
      results.push({
        toolCallId: "missing_toolCallId",
        error: "Missing toolCallId in request payload",
      });
      continue;
    }

    const args = getArgs(tc);

    const attempt_id = toNumber(
      args?.attempt_id ??
        args?.attemptId ??
        body?.attempt_id ??
        body?.attemptId ??
        body?.variableValues?.attempt_id ??
        body?.assistantOverrides?.variableValues?.attempt_id
    );

    const proposal_id =
      args?.proposal_id ??
      args?.proposalId ??
      body?.proposal_id ??
      body?.proposalId ??
      body?.variableValues?.proposal_id ??
      body?.assistantOverrides?.variableValues?.proposal_id ??
      null;

    const confirmation_number =
      args?.confirmation_number ?? body?.confirmation_number ?? null;

    if (!attempt_id || !proposal_id) {
      const payload = {
        message_to_say:
          "Perfect — thank you. The patient will see you then. Have a great day.",
        next_action: "END_CALL",
        status: "BOOKED",
        attempt_id: attempt_id ?? null,
        proposal_id: proposal_id ?? null,
        error: "Missing or invalid attempt_id/proposal_id",
      };

      results.push({ toolCallId, result: JSON.stringify(payload) });
      continue;
    }

    // 1) Mark proposal confirmed
    const { error: propErr } = await supabaseAdmin
      .from("proposals")
      .update({
        status: "CONFIRMED",
        next_action: "END_CALL",
        payload: {
          confirmation_number: confirmation_number ?? null,
        },
      })
      .eq("id", proposal_id)
      .eq("attempt_id", attempt_id);

    // 2) Mark attempt booked
    const { error: attErr } = await supabaseAdmin
      .from("schedule_attempts")
      .update({
        status: "BOOKED",
        metadata: { last_event: "CONFIRM_BOOKING" },
      })
      .eq("id", attempt_id);

    // 3) Log event (best-effort)
    await supabaseAdmin.from("call_events").insert({
      attempt_id,
      source: "tool",
      event_type: "booking_confirmed",
      tool_name: "confirm-booking",
      tool_payload: {
        toolCallId,
        proposal_id,
        confirmation_number: confirmation_number ?? null,
        proposal_update_error: propErr?.message,
        attempt_update_error: attErr?.message,
      },
      vapi_event: body,
    });

    const payload = {
      message_to_say:
        "Perfect — thank you. The patient will see you then. Have a great day.",
      next_action: "END_CALL",
      status: "BOOKED",
      attempt_id,
      proposal_id,
      ...(propErr ? { proposal_update_error: propErr.message } : {}),
      ...(attErr ? { attempt_update_error: attErr.message } : {}),
    };

    results.push({ toolCallId, result: JSON.stringify(payload) });
  }

  return Response.json({ results });
}