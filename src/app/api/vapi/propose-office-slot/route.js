export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  console.log("PROPOSE_OFFICE_SLOT:", JSON.stringify(body, null, 2));

  const raw = body?.office_offer?.raw_text || "";
  const autoConfirm = Boolean(body?.demo_autoconfirm);

  return Response.json({
    result: {
      message_to_say: autoConfirm
        ? "Auto-confirm enabled. Proceed to confirm."
        : "Slot recorded. Awaiting patient approval.",
      next_action: autoConfirm ? "CONFIRM_BOOKING" : "WAIT_FOR_USER_APPROVAL",
      proposal_id: `proposal_${Date.now()}`,
      conflict: false
    }
  });
}
