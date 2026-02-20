export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  // For MVP: just log whatever Vapi sends us.
  console.log("VAPI_WEBHOOK_RECEIVED:", JSON.stringify(body, null, 2));

  return Response.json({ ok: true });
}
