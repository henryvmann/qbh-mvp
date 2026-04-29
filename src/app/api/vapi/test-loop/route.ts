export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

/**
 * POST /api/vapi/test-loop
 *
 * Triggers a Kate→Sandra test call. Called by a cron job or manually.
 * Uses a random provider from the test account to vary the calls.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const testUserId = body.app_user_id || process.env.TEST_APP_USER_ID;

  if (!testUserId) {
    return NextResponse.json({ ok: false, error: "No test user ID configured" }, { status: 400 });
  }

  try {
    // Get a random provider from the test account
    const { data: providers } = await supabaseAdmin
      .from("providers")
      .select("id, name, phone_number")
      .eq("app_user_id", testUserId)
      .eq("status", "active")
      .neq("provider_type", "pharmacy");

    if (!providers || providers.length === 0) {
      return NextResponse.json({ ok: false, error: "No providers found for test user" }, { status: 400 });
    }

    // Pick a random provider
    const provider = providers[Math.floor(Math.random() * providers.length)];

    // Trigger the call
    const baseUrl = process.env.QBH_BASE_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000";
    const callRes = await fetch(`${baseUrl}/api/vapi/start-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_user_id: testUserId,
        provider_id: provider.id,
        provider_name: provider.name,
        mode: "BOOK",
      }),
    });

    const callData = await callRes.json();

    return NextResponse.json({
      ok: true,
      provider: provider.name,
      callResult: callData,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[test-loop] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to trigger test call" }, { status: 500 });
  }
}

/**
 * GET /api/vapi/test-loop
 *
 * Returns recent test call transcripts and analysis.
 */
export async function GET() {
  try {
    const { data: recentCalls } = await supabaseAdmin
      .from("call_test_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ ok: true, calls: recentCalls || [] });
  } catch {
    return NextResponse.json({ ok: true, calls: [] });
  }
}
