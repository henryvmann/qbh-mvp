import { supabaseAdmin } from "../../supabase-server";
import type {
  DiscoveredProvider,
  PlaidDiscoveryTransaction,
} from "./build-provider-registry";

type WriteDiscoveryParams = {
  userId: string;
  providers: DiscoveredProvider[];
  transactions: PlaidDiscoveryTransaction[];
};

function cleanName(input: string): string {
  return input.trim().toLowerCase();
}

export async function writeDiscoveredProviders({
  userId,
  providers,
  transactions,
}: WriteDiscoveryParams) {
  const writableProviders = providers.filter(
    (provider) => provider.bucket === "HEALTHCARE" || provider.bucket === "REVIEW_NEEDED"
  );

  const txById = new Map(
    transactions.map((tx) => [tx.transaction_id, tx] as const)
  );

  const { data: existingProviders, error: existingProvidersError } =
    await supabaseAdmin
      .from("providers")
      .select("id, name")
      .eq("app_user_id", userId);

  if (existingProvidersError) {
    console.error("[writeDiscoveredProviders] failed reading providers", {
      userId,
      message: existingProvidersError.message,
      details: existingProvidersError.details,
      hint: existingProvidersError.hint,
      code: existingProvidersError.code,
    });

    throw new Error(existingProvidersError.message);
  }

  const existingByName = new Map(
    (existingProviders || []).map((provider) => [
      cleanName(provider.name),
      provider.id,
    ])
  );

  const seenInsertNames = new Set<string>();

  const providersToInsert = writableProviders
    .filter((provider) => {
      const key = cleanName(provider.provider_name);
      if (!key) return false;
      if (existingByName.has(key)) return false;
      if (seenInsertNames.has(key)) return false;
      seenInsertNames.add(key);
      return true;
    })
    .map((provider) => ({
      app_user_id: userId,
      name: provider.provider_name.trim(),
      status: provider.bucket === "HEALTHCARE" ? "active" : "review_needed",
      guessed_portal_brand: null,
      guessed_portal_confidence: null,
      phone_number: provider.phone_number || null,
      source: "plaid",
    }));

  let insertedProviders: Array<{ id: string; name: string }> = [];

  if (providersToInsert.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("providers")
      .insert(providersToInsert)
      .select("id, name");

    if (error) {
      console.error("[writeDiscoveredProviders] failed inserting providers", {
        userId,
        providerCount: providersToInsert.length,
        providerNames: providersToInsert.map((p) => p.name),
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      throw new Error(error.message);
    }

    insertedProviders = data || [];
  }

  const providerIdByName = new Map<string, string>();

  for (const provider of existingProviders || []) {
    providerIdByName.set(cleanName(provider.name), provider.id);
  }

  for (const provider of insertedProviders) {
    providerIdByName.set(cleanName(provider.name), provider.id);
  }

  const rawVisitRows: Array<{
    app_user_id: string;
    provider_id: string;
    source: string;
    visit_date: string;
    amount_cents: number;
    source_transaction_id: string;
  }> = [];

  const seenVisitTransactionIds = new Set<string>();

  for (const provider of writableProviders) {
    const cleanProviderName = cleanName(provider.provider_name);
    const providerId = providerIdByName.get(cleanProviderName);

    if (!providerId) {
      console.warn("[writeDiscoveredProviders] missing providerId for provider", {
        userId,
        provider_name: provider.provider_name,
        normalized_name: provider.normalized_name,
      });
      continue;
    }

    for (const txId of provider.source_transaction_ids) {
      if (seenVisitTransactionIds.has(txId)) continue;

      const tx = txById.get(txId);
      if (!tx?.date) {
        console.warn("[writeDiscoveredProviders] missing tx/date for txId", {
          userId,
          provider_name: provider.provider_name,
          txId,
        });
        continue;
      }

      seenVisitTransactionIds.add(txId);

      rawVisitRows.push({
        app_user_id: userId,
        provider_id: providerId,
        source: "transaction",
        visit_date: tx.date,
        amount_cents: Math.round(Math.abs(Number(tx.amount || 0)) * 100),
        source_transaction_id: tx.transaction_id,
      });
    }
  }

  if (rawVisitRows.length > 0) {
    const sourceTransactionIds = rawVisitRows.map(
      (row) => row.source_transaction_id
    );

    const { data: existingVisits, error: existingVisitsError } =
      await supabaseAdmin
        .from("provider_visits")
        .select("source_transaction_id")
        .eq("app_user_id", userId)
        .in("source_transaction_id", sourceTransactionIds);

    if (existingVisitsError) {
      console.error(
        "[writeDiscoveredProviders] failed reading existing provider_visits",
        {
          userId,
          message: existingVisitsError.message,
          details: existingVisitsError.details,
          hint: existingVisitsError.hint,
          code: existingVisitsError.code,
        }
      );

      throw new Error(existingVisitsError.message);
    }

    const existingSourceIds = new Set(
      (existingVisits || []).map((row) => row.source_transaction_id)
    );

    const visitRows = rawVisitRows.filter(
      (row) => !existingSourceIds.has(row.source_transaction_id)
    );

    if (visitRows.length > 0) {
      const { error: visitInsertError } = await supabaseAdmin
        .from("provider_visits")
        .insert(visitRows);

      if (visitInsertError) {
        console.error(
          "[writeDiscoveredProviders] failed inserting provider_visits",
          {
            userId,
            visitCount: visitRows.length,
            sampleRows: visitRows.slice(0, 5),
            message: visitInsertError.message,
            details: visitInsertError.details,
            hint: visitInsertError.hint,
            code: visitInsertError.code,
          }
        );

        throw new Error(visitInsertError.message);
      }
    }

    return {
      provider_count: insertedProviders.length,
      visit_count: visitRows.length,
    };
  }

  return {
    provider_count: insertedProviders.length,
    visit_count: 0,
  };
}