import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "../../../../lib/plaid";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { buildProviderRegistry } from "../../../../lib/qbh/discovery/build-provider-registry";
import { writeDiscoveredProviders } from "../../../../lib/qbh/discovery/write-discovered-providers";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";

export async function POST(req: NextRequest) {
  try {
    // Session-first: authenticated users.
    // Onboarding fallback: pre-auth users supply a body UUID.
    let appUserId = await getSessionAppUserId();

    if (!appUserId) {
      const body = await req.json().catch(() => ({}));
      const bodyUserId = String(body?.app_user_id || "").trim();

      if (!bodyUserId) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      appUserId = bodyUserId;
    }

    const { data: items, error: itemError } = await supabaseAdmin
      .from("plaid_items")
      .select("access_token, created_at")
      .eq("app_user_id", appUserId)
      .order("created_at", { ascending: false })
      .limit(1);

    const item = items?.[0];

    if (itemError || !item?.access_token) {
      return NextResponse.json(
        { ok: false, error: "No Plaid item found for user" },
        { status: 404 }
      );
    }

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    const endDate = new Date();

    let transactions: any[] = [];

    try {
      const plaidResponse = await plaidClient.transactionsGet({
        access_token: item.access_token,
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
      });

      transactions = plaidResponse.data.transactions;
    } catch (error: any) {
      const errorCode = error?.response?.data?.error_code;

      if (errorCode === "PRODUCT_NOT_READY") {
        console.warn("[discovery/run] plaid transactions not ready yet", {
          appUserId,
          errorCode,
        });

        return NextResponse.json({
          ok: true,
          pending: true,
          message: "Transactions not ready yet. Retrying shortly.",
        });
      }

      throw error;
    }

    const transactionRows = transactions.map((tx) => ({
      app_user_id: appUserId,
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
      console.error("[discovery/run] failed to store plaid_transactions", {
        appUserId,
        message: txInsertError.message,
        details: txInsertError.details,
        hint: txInsertError.hint,
        code: txInsertError.code,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Failed to store transactions",
          details: txInsertError.message,
        },
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
      userId: appUserId, // internal helper still uses userId naming but maps to app_user_id
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
      error?.response?.data ||
      error?.details ||
      error?.message ||
      "Unknown discovery error";

    console.error("[discovery/run] unhandled error", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      responseData: error?.response?.data,
      stack: error?.stack,
    });

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