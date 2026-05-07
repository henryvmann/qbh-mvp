export const dynamic = 'force-dynamic';
// Bumped so the after() retry loop has room — Plaid PRODUCT_NOT_READY can
// persist 60-180s on credit cards, then discovery itself takes ~70s on a
// real bank year. Total worst case ~4 minutes.
export const maxDuration = 300;
import { NextRequest, NextResponse, after } from "next/server";
import { plaidClient } from "../../../../lib/plaid";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const publicToken = String(body?.public_token || "").trim();

    if (!publicToken) {
      return NextResponse.json(
        { ok: false, error: "Missing public_token" },
        { status: 400 }
      );
    }

    // Session-first: authenticated users.
    // Onboarding fallback: pre-auth users supply a body UUID.
    let appUserId = await getSessionAppUserId(req);

    if (!appUserId) {
      const bodyUserId = String(body?.app_user_id || "").trim();

      if (!bodyUserId) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      appUserId = bodyUserId;
    }

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

    // Server-side discovery trigger. The client used to be the only thing
    // driving /api/discovery/run, but in practice the polling tick was
    // unreliable — users navigated away, browser fetch quirks on long
    // requests, etc. — and we'd see plaid_transactions = 0 forever.
    // after() keeps this Vercel function alive past the response so we
    // can retry until Plaid's PRODUCT_NOT_READY clears and discovery
    // actually completes. The function's maxDuration above bounds it.
    const discoveryAppUserId = appUserId;
    const baseUrl = req.nextUrl.origin;
    after(async () => {
      const MAX_ROUNDS = 30; // ~5 minute total budget
      for (let i = 0; i < MAX_ROUNDS; i++) {
        try {
          const res = await fetch(`${baseUrl}/api/discovery/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app_user_id: discoveryAppUserId }),
          });
          const data = await res.json().catch(() => ({}));
          if (data?.ok && !data.pending) {
            console.log("[exchange-token after()] discovery complete", {
              appUserId: discoveryAppUserId,
              providers: data.provider_count,
              transactions: data.transaction_count,
              attempt: i + 1,
            });
            return;
          }
        } catch (err) {
          console.warn("[exchange-token after()] discovery call failed", {
            appUserId: discoveryAppUserId,
            attempt: i + 1,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        await new Promise((r) => setTimeout(r, 8000));
      }
      console.warn("[exchange-token after()] discovery never completed within budget", {
        appUserId: discoveryAppUserId,
      });
    });

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