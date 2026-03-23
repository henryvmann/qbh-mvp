import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "../../../../lib/plaid";
import { supabaseAdmin } from "../../../../lib/supabase-server";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const publicToken = String(body?.public_token || "").trim();
    const appUserId = String(body?.app_user_id || "").trim();

    if (!publicToken) {
      return NextResponse.json(
        { ok: false, error: "Missing public_token" },
        { status: 400 }
      );
    }

    if (!appUserId) {
      return NextResponse.json(
        { ok: false, error: "Missing app_user_id" },
        { status: 400 }
      );
    }

    await requireAppUser(appUserId);

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Check if integration already exists (reuse if so)
    const { data: existingIntegration, error: existingIntegrationError } =
      await supabaseAdmin
        .from("integrations")
        .select("id")
        .eq("app_user_id", appUserId)
        .eq("integration_type", "plaid")
        .in("status", ["active", "connected"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (existingIntegrationError) {
      return NextResponse.json(
        { ok: false, error: existingIntegrationError.message },
        { status: 500 }
      );
    }

    let integrationId = existingIntegration?.id ?? null;

    if (!integrationId) {
      const { data: insertedIntegration, error: insertIntegrationError } =
        await supabaseAdmin
          .from("integrations")
          .insert({
            app_user_id: appUserId,
            integration_type: "plaid",
            status: "connected",
          })
          .select("id")
          .single();

      if (insertIntegrationError || !insertedIntegration?.id) {
        console.error(
          "Supabase integration insert error:",
          insertIntegrationError
        );

        return NextResponse.json(
          { ok: false, error: "Failed to create integration" },
          { status: 500 }
        );
      }

      integrationId = insertedIntegration.id;
    } else {
      await supabaseAdmin
        .from("integrations")
        .update({
          status: "connected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", integrationId);
    }

    const { error: plaidItemError } = await supabaseAdmin
      .from("plaid_items")
      .upsert(
        {
          integration_id: integrationId,
          app_user_id: appUserId,
          access_token: accessToken,
          item_id: itemId,
        },
        { onConflict: "item_id" }
      );

    if (plaidItemError) {
      console.error("Supabase plaid_items upsert error:", plaidItemError);

      return NextResponse.json(
        { ok: false, error: "Failed to store Plaid item" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      item_id: itemId,
      integration_id: integrationId,
    });
  } catch (error: any) {
    const plaidError =
      error?.response?.data || error?.message || "Exchange failed";

    console.error("Plaid exchange-token error:", plaidError);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to exchange public_token",
        details: plaidError,
      },
      { status: 500 }
    );
  }
}