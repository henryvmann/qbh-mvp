// src/lib/qbh/discovery/write-discovered-providers.ts

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

export async function writeDiscoveredProviders({
  userId,
  providers,
  transactions,
}: WriteDiscoveryParams) {
  const healthcareProviders = providers.filter(
    (provider) => provider.bucket === "HEALTHCARE"
  );

  const txById = new Map(
    transactions.map((tx) => [tx.transaction_id, tx] as const)
  );

  const { data: existingProviders, error: existingProvidersError } =
    await supabaseAdmin
      .from("providers")
      .select("id, name")
      .eq("user_id", userId);

  if (existingProvidersError) {
    throw new Error(existingProvidersError.message);
  }

  const existingByName = new Map(
    (existingProviders || []).map((provider) => [
      provider.name.trim().toLowerCase(),
      provider.id,
    ])
  );

  const providersToInsert = healthcareProviders
    .filter(
      (provider) =>
        !existingByName.has(provider.provider_name.trim().toLowerCase())
    )
    .map((provider) => ({
      user_id: userId,
      name: provider.provider_name,
      status: "active",
      guessed_portal_brand: null,
      guessed_portal_confidence: null,
    }));

  let insertedProviders: Array<{ id: string; name: string }> = [];

  if (providersToInsert.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("providers")
      .insert(providersToInsert)
      .select("id, name");

    if (error) {
      throw new Error(error.message);
    }

    insertedProviders = data || [];
  }

  const providerIdByName = new Map<string, string>();

  for (const provider of existingProviders || []) {
    providerIdByName.set(provider.name.trim().toLowerCase(), provider.id);
  }

  for (const provider of insertedProviders) {
    providerIdByName.set(provider.name.trim().toLowerCase(), provider.id);
  }

  const visitRows: Array<{
    user_id: string;
    provider_id: string;
    source: string;
    visit_date: string;
    amount_cents: number;
  }> = [];

  for (const provider of healthcareProviders) {
    const providerId = providerIdByName.get(
      provider.provider_name.trim().toLowerCase()
    );

    if (!providerId) continue;

    for (const txId of provider.source_transaction_ids) {
      const tx = txById.get(txId);
      if (!tx) continue;

      visitRows.push({
        user_id: userId,
        provider_id: providerId,
        source: "transaction",
        visit_date: tx.date,
        amount_cents: Math.round(Math.abs(Number(tx.amount || 0)) * 100),
      });
    }
  }

  if (visitRows.length > 0) {
    const { error: visitInsertError } = await supabaseAdmin
      .from("provider_visits")
      .insert(visitRows);

    if (visitInsertError) {
      throw new Error(visitInsertError.message);
    }
  }

  return {
    provider_count: insertedProviders.length,
    visit_count: visitRows.length,
  };
}