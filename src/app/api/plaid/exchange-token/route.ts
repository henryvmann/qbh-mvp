// src/app/api/plaid/exchange-token/route.ts

import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "../../../../lib/plaid";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const publicToken = String(body?.public_token || "").trim();
    const userId = String(body?.user_id || "").trim();

    if (!publicToken) {
      return NextResponse.json(
        { ok: false, error: "Missing public_token" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Missing user_id" },
        { status: 400 }
      );
    }

    // --- Exchange public_token → access_token ---
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // --- Store in Supabase ---
    const { error } = await supabaseAdmin.from("plaid_items").insert({
      user_id: userId,
      access_token: accessToken,
      item_id: itemId,
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to store Plaid item" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      item_id: itemId,
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