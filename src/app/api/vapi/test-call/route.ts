export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

// POST /api/vapi/test-call
// Fires a real VAPI call to TEST_NUMBER so we can verify the dialer
// pipeline end-to-end without booking against a real provider. Uses
// a synthetic "Test Practice" provider that's reused across calls,
// not stored on the user's actual care team.
//
// The caller's session is required — this isn't unauthenticated.

const TEST_NUMBER = "+13019432373";
const TEST_PROVIDER_NAME = "QBH Test Practice";

export async function POST(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Reuse an existing test provider for this user, or create one.
  // status="inactive" so it doesn't appear on dashboards but is still
  // a valid row for VAPI to call against.
  let providerId: string | null = null;
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from("providers")
    .select("id")
    .eq("app_user_id", appUserId)
    .eq("name", TEST_PROVIDER_NAME)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json(
      { ok: false, error: "Failed to look up test provider", details: lookupErr.message },
      { status: 500 }
    );
  }

  if (existing?.id) {
    providerId = existing.id;
  } else {
    const { data: created, error: insertErr } = await supabaseAdmin
      .from("providers")
      .insert({
        app_user_id: appUserId,
        name: TEST_PROVIDER_NAME,
        source: "manual",
        status: "inactive",
        phone_number: TEST_NUMBER,
      })
      .select("id")
      .single();
    if (insertErr || !created?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to create test provider",
          details: insertErr?.message || "no row returned",
          code: insertErr?.code,
          hint: insertErr?.hint,
        },
        { status: 500 }
      );
    }
    providerId = created.id;
  }

  // Forward to the real start-call route. Uses the same VAPI assistant
  // and the same dialing pipeline a real Handle-It call would.
  const baseUrl = new URL(req.url).origin;
  const startRes = await fetch(`${baseUrl}/api/vapi/start-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Forward the session cookie so start-call can resolve the user.
      Cookie: req.headers.get("cookie") || "",
    },
    body: JSON.stringify({
      provider_id: providerId,
      provider_name: TEST_PROVIDER_NAME,
      office_number: TEST_NUMBER,
      mode: "BOOK",
      reason_for_visit: "QBH dialer test — please disregard",
      app_user_id: appUserId,
    }),
  });

  const data = await startRes.json().catch(() => ({}));
  if (!startRes.ok) {
    return NextResponse.json(
      { ok: false, error: "start-call failed", details: data },
      { status: startRes.status }
    );
  }

  return NextResponse.json({ ok: true, ...data });
}
