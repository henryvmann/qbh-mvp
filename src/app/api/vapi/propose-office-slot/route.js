export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  console.log("PROPOSE_OFFICE_SLOT:", JSON.stringify(body, null, 2));

const raw = body?.office_offer?.raw_text || "";
const autoConfirm = Boolean(body?.demo_autoconfirm);

return Response.json({
  ok: true,
  attempt_id: body.attempt_id,
  provider_id: body.provider_id,
  next_action: autoConfirm ? "CONFIRM_NOW" : "AWAIT_PATIENT_APPROVAL",
  proposal: {
    proposal_id: `proposal_${Date.now()}`,
    office_offer_raw: raw,
    conflict: false,
    message: autoConfirm
      ? "Auto-confirm enabled. Proceed to confirm."
      : "Slot recorded. Awaiting patient approval."
  }
});
