import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

type SyncBody = {
  provider_id?: string;
  portal_brand?: string;
};

async function requireAppUser(appUserId: string): Promise<void> {
  const cleanedAppUserId = String(appUserId || "").trim();

  if (!cleanedAppUserId) {
    throw new Error("Missing app_user_id");
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("id", cleanedAppUserId)
    .single();

  if (error || !data?.id) {
    throw new Error("Invalid app_user_id");
  }
}

async function ensurePortalIntegration(appUserId: string) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("integrations")
    .select("id")
    .eq("app_user_id", appUserId)
    .eq("integration_type", "portal")
    .in("status", ["active", "connected"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return existing;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("integrations")
    .insert({
      app_user_id: appUserId,
      integration_type: "portal",
      status: "connected",
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(insertError?.message || "Failed to create portal integration");
  }

  return inserted;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const { provider_id, portal_brand } = body ?? {};

  if (!provider_id || !portal_brand) {
    return NextResponse.json(
      { ok: false, error: "provider_id and portal_brand are required" },
      { status: 400 }
    );
  }

  const appUserId = (process.env.QBH_DEMO_USER_ID || "").trim();
  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "QBH_DEMO_USER_ID not set" },
      { status: 500 }
    );
  }

  try {
    await requireAppUser(appUserId);
    const integration = await ensurePortalIntegration(appUserId);

    if (portal_brand === "epic_mychart") {
      const origin = new URL(req.url).origin;

      const epicRes = await fetch(`${origin}/api/portal/sync/epic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: appUserId,
          provider_id,
          portal_brand,
        }),
      });

      const epicJson = await epicRes.json().catch(() => ({}));
      return NextResponse.json(epicJson, { status: epicRes.status });
    }

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    const { error: upsertConnectionError } = await supabaseAdmin
      .from("portal_connections")
      .upsert(
        {
          integration_id: integration.id,
          app_user_id: appUserId,
          provider_id,
          portal_brand,
          status: portal_brand.startsWith("mock_") ? "mock" : "connected",
          last_sync_at: nowIso,
        },
        { onConflict: "app_user_id,provider_id,portal_brand" }
      );

    if (upsertConnectionError) {
      return NextResponse.json(
        { ok: false, error: upsertConnectionError.message },
        { status: 500 }
      );
    }

    const facts = [
      {
        app_user_id: appUserId,
        provider_id,
        fact_type: "appointment",
        fact_date: today,
        fact_json: {
          title: "Upcoming appointment",
          source: portal_brand,
          when: nowIso,
        },
        source: "portal",
      },
      {
        app_user_id: appUserId,
        provider_id,
        fact_type: "message",
        fact_date: today,
        fact_json: {
          title: "New portal message",
          source: portal_brand,
          received_at: nowIso,
        },
        source: "portal",
      },
      {
        app_user_id: appUserId,
        provider_id,
        fact_type: "lab_result",
        fact_date: today,
        fact_json: {
          title: "Lab result posted",
          source: portal_brand,
          posted_at: nowIso,
        },
        source: "portal",
      },
    ];

    const { error: insErr } = await supabaseAdmin
      .from("portal_facts")
      .insert(facts);

    if (insErr) {
      return NextResponse.json(
        { ok: false, error: insErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      facts_written: facts.length,
      last_sync_at: nowIso,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "portal_sync_failed";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}