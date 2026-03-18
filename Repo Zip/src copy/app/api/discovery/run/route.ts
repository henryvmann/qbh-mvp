import { NextResponse } from "next/server";
import { loadSeededTransactions } from "../../../../lib/qbh/discovery/load-seeded-transactions";
import { buildProviderRegistry } from "../../../../lib/qbh/discovery/build-provider-registry";
import { writeDiscoveredProviders } from "../../../../lib/qbh/discovery/write-discovered-providers";

const DEMO_USER_ID = (process.env.QBH_DEMO_USER_ID || "").trim();

export async function POST() {
  try {
    if (!DEMO_USER_ID) {
      return NextResponse.json(
        {
          ok: false,
          error: "QBH_DEMO_USER_ID is not set.",
        },
        { status: 500 }
      );
    }

    const transactions = await loadSeededTransactions();
    const providers = buildProviderRegistry(transactions);

    const writeResult = await writeDiscoveredProviders({
      userId: DEMO_USER_ID,
      providers,
      transactions,
    });

    return NextResponse.json({
      ok: true,
      transaction_count: transactions.length,
      provider_count: providers.length,
      inserted_provider_count: writeResult.provider_count,
      inserted_visit_count: writeResult.visit_count,
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