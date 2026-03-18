// src/app/api/discovery/run/route.ts

import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "../../../../lib/plaid";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { buildProviderRegistry } from "../../../../lib/qbh/discovery/build-provider-registry";
import { writeDiscoveredProviders } from "../../../../lib/qbh/discovery/write-discovered-providers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.user_id || "").trim();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Missing user_id" },
        { status: 400 }
      );
    }

    const { data: item, error: itemError } = await supabaseAdmin
      .from("plaid_items")
      .select("access_token")
      .eq("user_id", userId)
      .single();

    if (itemError || !item?.access_token) {
      return NextResponse.json(
        { ok: false, error: "No Plaid item found for user" },
        { status: 404 }
      );
    }

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    const endDate = new Date();

    const plaidResponse = await plaidClient.transactionsGet({
      access_token: item.access_token,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
    });

    const transactions = plaidResponse.data.transactions;

    const transactionRows = transactions.map((tx) => ({
      user_id: userId,
      transaction_id: tx.transaction_id,
      name: tx.name,
      amount: tx.amount,
      date: tx.date,
      merchant_name: tx.merchant_name ?? null,
      category: tx.category ?? null,
      raw: tx,
    }));

    const { error: txInsertError } = await supabaseAdmin
      .from("plaid_transactions")
      .upsert(transactionRows, { onConflict: "transaction_id" });

    if (txInsertError) {
      return NextResponse.json(
        { ok: false, error: "Failed to store transactions" },
        { status: 500 }
      );
    }

    const normalizedTransactions = transactions.map((tx) => ({
      transaction_id: tx.transaction_id,
      name: tx.name ?? null,
      merchant_name: tx.merchant_name ?? null,
      amount: tx.amount ?? null,
      date: tx.date,
      category: tx.category ?? null,
    }));

    const providers = buildProviderRegistry(normalizedTransactions);

    const writeResult = await writeDiscoveredProviders({
      userId,
      providers,
      transactions: normalizedTransactions,
    });

    return NextResponse.json({
      ok: true,
      transaction_count: transactions.length,
      provider_count: providers.length,
      inserted_provider_count: writeResult.provider_count,
      inserted_visit_count: writeResult.visit_count,
      providers,
    });
  } catch (error: any) {
    const details =
      error?.response?.data || error?.message || "Unknown discovery error";

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to run discovery",
        details,
      },
      { status: 500 }
    );
  }
}