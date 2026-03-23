// src/app/api/plaid/link-token/route.ts

import { NextRequest, NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "../../../../lib/plaid";
import { supabaseAdmin } from "../../../../lib/supabase-server";

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
    const appUserId = String(body?.app_user_id || "").trim();

    if (!appUserId) {
      return NextResponse.json(
        { ok: false, error: "Missing app_user_id" },
        { status: 400 }
      );
    }

    await requireAppUser(appUserId);

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