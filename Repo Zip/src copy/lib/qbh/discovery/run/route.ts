import { NextResponse } from "next/server";
import { loadSeededTransactions } from "../load-seeded-transactions";
import { buildProviderRegistry } from "../build-provider-registry";

export async function POST() {
  try {
    const transactions = await loadSeededTransactions();
    const providers = buildProviderRegistry(transactions);

    return NextResponse.json({
      ok: true,
      transaction_count: transactions.length,
      provider_count: providers.length,
      providers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown discovery error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}