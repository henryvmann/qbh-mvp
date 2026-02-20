export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  console.log("PROPOSE_OFFICE_SLOT:", JSON.stringify(body, null, 2));

  const raw = body?.office_offer?.raw_text || "";

  // MVP stub: always "no conflict" and create a proposal_id
  return Response.json({
    ok: true,
    attempt_id: body.attempt_id,
    provider_id: body.provider_id,
    proposal: {
      proposal_id: `proposal_${Date.now()}`,
      office_offer_raw: raw,
      conflict: false,
      message: "Slot recorded. Awaiting patient approval."
    }
  });
}
