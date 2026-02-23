import { supabaseAdmin } from "../../../../lib/supabase-server";

type AnyObj = Record<string, any>;

function toNumber(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function extractToolCalls(body: AnyObj) {
  // Vapi live payload shape: body.message.toolCalls[]
  const list =
    body?.message?.toolCalls ||
    body?.toolCalls ||
    body?.message?.toolCallList ||
    body?.toolCallList ||
    null;

  if (Array.isArray(list) && list.length > 0) return list;

  // Fallback: treat whole body as a single "tool call" (curl/manual)
  // We synthesize a toolCallId from top-level fields.
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
  // Vapi puts args in toolCall.function.arguments (object or JSON string)
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
  console.log("PROPOSE_OFFICE_SLOT:", JSON.stringify(body, null, 2));

  const toolCalls = extractToolCalls(body);

  if (!toolCalls.length) {
    // Still return 200 per Vapi docs; embed error in results
    return Response.json({
      results: [
        {
          toolCallId: "missing_toolCallId",
          error: "Missing toolCallId in request payload",
        },
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

    const provider_id = toNumber(
      args?.provider_id ??
        args?.providerId ??
        body?.provider_id ??
        body?.providerId ??
        body?.variableValues?.provider_id ??
        body?.assistantOverrides?.variableValues?.provider_id
    );

    const raw =
      args?.office_offer?.raw_text ||
      body?.office_offer?.raw_text ||
      "";

    const autoConfirm = Boolean(
      args?.demo_autoconfirm ??
        body?.demo_autoconfirm ??
        body?.variableValues?.demo_autoconfirm ??
        body?.assistantOverrides?.variableValues?.demo_autoconfirm
    );

    // If we can't place it, we still return a valid wrapper so the assistant doesn't crash.
    if (!attempt_id) {
      const payload = {
        message_to_say:
          "Thanks—I'm missing the scheduling context on my side. Could you please repeat the date and time once more?",
        next_action: "WAIT_FOR_USER_APPROVAL",
        proposal_id: null,
        conflict: false,
        office_offer_raw: raw,
        error: "Missing or invalid attempt_id",
      };

      results.push({ toolCallId, result: JSON.stringify(payload) });
      continue;
    }

    // Business logic (same intent as your stub)
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
          provider_id: provider_id ?? null,
          demo_autoconfirm: autoConfirm,
          raw_request: body,
          raw_args: args,
        },
      })
      .select("id")
      .single();

    // 2) Best-effort update attempt status
    if (!propErr && proposal?.id) {
      await supabaseAdmin
        .from("schedule_attempts")
        .update({
          status: "PROPOSED",
          metadata: { last_event: "PROPOSE_OFFICE_SLOT" },
        })
        .eq("id", attempt_id);

      await supabaseAdmin.from("call_events").insert({
        attempt_id,
        source: "tool",
        event_type: "proposal_created",
        tool_name: "propose-office-slot",
        tool_payload: { toolCallId, next_action, conflict: false },
        vapi_event: body,
      });
    } else {
      await supabaseAdmin.from("call_events").insert({
        attempt_id,
        source: "tool",
        event_type: "proposal_create_failed",
        tool_name: "propose-office-slot",
        tool_payload: { toolCallId, error: propErr?.message },
        vapi_event: body,
      });
    }

    // IMPORTANT: tool result must be a single-line STRING
    const payload = {
      message_to_say,
      next_action,
      proposal_id: proposal?.id ?? null,
      conflict: false,
      office_offer_raw: raw,
      ...(propErr ? { error: propErr.message } : {}),
    };

    results.push({ toolCallId, result: JSON.stringify(payload) });
  }

  return Response.json({ results });
}