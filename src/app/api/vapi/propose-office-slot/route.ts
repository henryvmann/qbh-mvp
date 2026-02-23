import { supabaseAdmin } from "../../../../lib/supabase-server";

type AnyObj = Record<string, any>;

function extractToolCalls(body: AnyObj) {
  const candidates =
    body?.message?.toolCalls ||
    body?.message?.tool_calls ||
    body?.toolCalls ||
    body?.tool_calls ||
    null;

  if (Array.isArray(candidates) && candidates.length > 0) {
    return candidates;
  }

  // Fallback: flat payload
  if (body?.toolCallId || body?.tool_call_id || body?.id) {
    return [
      {
        id: body.toolCallId || body.tool_call_id || body.id,
        function: { arguments: body },
      },
    ];
  }

  return [];
}

function parseArgs(tc: AnyObj) {
  let args = tc?.function?.arguments ?? {};
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      args = {};
    }
  }
  return args;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  console.log("PROPOSE_OFFICE_SLOT:", JSON.stringify(body, null, 2));

  const toolCalls = extractToolCalls(body);

  if (!toolCalls.length) {
    return Response.json({
      results: [
        {
          toolCallId: "missing_toolCallId",
          error: "Missing toolCallId in request payload",
        },
      ],
    });
  }

  const results = [];

  for (const tc of toolCalls) {
    const toolCallId = tc?.id;

    if (!toolCallId) {
      results.push({
        toolCallId: "missing_toolCallId",
        error: "Missing toolCallId in request payload",
      });
      continue;
    }

    const args = parseArgs(tc);

    const attempt_id = Number(args?.attempt_id);
    const provider_id = Number(args?.provider_id);
    const raw = args?.office_offer?.raw_text || "";
    const autoConfirm = Boolean(args?.demo_autoconfirm);

    if (!attempt_id) {
      results.push({
        toolCallId,
        result: JSON.stringify({
          message_to_say: "Missing attempt context.",
          next_action: "WAIT_FOR_USER_APPROVAL",
          proposal_id: null,
          conflict: false,
          office_offer_raw: raw,
        }),
      });
      continue;
    }

    const message_to_say = autoConfirm
      ? "Auto-confirm enabled. Proceed to confirm."
      : "Slot recorded. Awaiting patient approval.";

    const next_action = autoConfirm ? "CONFIRM_BOOKING" : "WAIT_FOR_USER_APPROVAL";

    const { data: proposal } = await supabaseAdmin
      .from("proposals")
      .insert({
        attempt_id,
        tool_call_id: toolCallId,
        office_offer_raw_text: raw,
        conflict: false,
        message_to_say,
        next_action,
        status: "PROPOSED",
      })
      .select("id")
      .single();

    results.push({
      toolCallId,
      result: JSON.stringify({
        message_to_say,
        next_action,
        proposal_id: proposal?.id ?? null,
        conflict: false,
        office_offer_raw: raw,
      }),
    });
  }

  return Response.json({ results });
}