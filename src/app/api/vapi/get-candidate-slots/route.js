export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  console.log("GET_CANDIDATE_SLOTS:", body);

  // MVP stub: return a few suggested times
  return Response.json({
    ok: true,
    attempt_id: body.attempt_id,
    provider_id: body.provider_id,
    candidate_slots: [
      { start: "2026-02-21T10:00:00-05:00", end: "2026-02-21T10:30:00-05:00" },
      { start: "2026-02-21T14:00:00-05:00", end: "2026-02-21T14:30:00-05:00" },
      { start: "2026-02-24T09:00:00-05:00", end: "2026-02-24T09:30:00-05:00" }
    ]
  });
}
