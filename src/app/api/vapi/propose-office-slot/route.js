export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  console.log("PROPOSE_OFFICE_SLOT:", JSON.stringify(body, null, 2));

  const toolCallId = body?.toolCallId || body?.tool_call_id || body?.id;
  if (!toolCallId) {
    // Still return 200 per Vapi docs; embed the error in results array.
    return Response.json({
      results: [{ toolCallId: "missing_toolCallId", error: "Missing toolCallId in request payload" }]
    });
  }

  const raw = body?.office_offer?.raw_text || "";
  const autoConfirm = Boolean(body?.demo_autoconfirm);

  // IMPORTANT: result must be a single-line STRING (no line breaks). :contentReference[oaicite:1]{index=1}
  const payload = {
    message_to_say: autoConfirm
      ? "Auto-confirm enabled. Proceed to confirm."
      : "Slot recorded. Awaiting patient approval.",
    next_action: autoConfirm ? "CONFIRM_BOOKING" : "WAIT_FOR_USER_APPROVAL",
    proposal_id: `proposal_${Date.now()}`,
    conflict: false,
    office_offer_raw: raw
  };

  return Response.json({
    results: [{ toolCallId, result: JSON.stringify(payload) }]
  });
}
