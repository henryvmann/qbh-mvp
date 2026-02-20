export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  console.log("CONFIRM_BOOKING:", JSON.stringify(body, null, 2));

  // MVP stub: always confirm success
  return Response.json({
    ok: true,
    attempt_id: body.attempt_id,
    proposal_id: body.proposal_id,
    status: "BOOKED",
    message: "Booking confirmed (stub)."
  });
}
