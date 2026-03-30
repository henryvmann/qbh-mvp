export const dynamic = 'force-dynamic';
// src/app/api/plaid/link-token/route.ts

import { NextRequest, NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "../../../../lib/plaid";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

function parseProducts(value: string | undefined): Products[] {
  return (value || "transactions")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item as Products);
}

function parseCountryCodes(value: string | undefined): CountryCode[] {
  return (value || "US")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .map((item) => item as CountryCode);
}

export async function POST(req: NextRequest) {
  try {
    // Session-first: authenticated users (e.g. reconnecting from settings).
    // Onboarding fallback: pre-auth users supply a body UUID; we upsert
    // the app_users row so the rest of the onboarding flow can proceed.
    let appUserId = await getSessionAppUserId(req);

    if (!appUserId) {
      const body = await req.json().catch(() => ({}));
      const bodyUserId = String(body?.app_user_id || "").trim();

      if (!bodyUserId) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      const { error } = await supabaseAdmin
        .from("app_users")
        .upsert({ id: bodyUserId }, { onConflict: "id", ignoreDuplicates: true });

      if (error) {
        return NextResponse.json(
          { ok: false, error: "Failed to resolve user" },
          { status: 500 }
        );
      }

      appUserId = bodyUserId;
    }

    const products = parseProducts(process.env.PLAID_PRODUCTS);
    const countryCodes = parseCountryCodes(process.env.PLAID_COUNTRY_CODES);
    const redirectUri = String(process.env.PLAID_REDIRECT_URI || "").trim();

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: appUserId,
      },
      client_name: "QBHealth",
      products,
      country_codes: countryCodes,
      language: "en",
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });

    return NextResponse.json({
      ok: true,
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: any) {
    const plaidError =
      error?.response?.data || error?.message || "Failed to create link token";

    console.error("Plaid link-token error:", plaidError);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to create link token",
        details: plaidError,
      },
      { status: 500 }
    );
  }
}