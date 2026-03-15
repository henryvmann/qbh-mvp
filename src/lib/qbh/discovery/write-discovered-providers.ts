import { supabaseAdmin } from "../../supabase-server";
import type { DiscoveredProvider } from "./build-provider-registry";
import type { SeededTransaction } from "./load-seeded-transactions";

type WriteDiscoveryParams = {
  userId: string;
  providers: DiscoveredProvider[];
  transactions: SeededTransaction[];
};

export async function writeDiscoveredProviders({
  userId,
  providers,
  transactions,
}: WriteDiscoveryParams) {
  const healthcareProviders = providers.filter(
    (p) => p.bucket === "HEALTHCARE"
  );

  const txById = new Map(transactions.map((tx) => [tx.transaction_id, tx]));

// fetch existing providers for this user
const { data: existingProviders } = await supabaseAdmin
  .from("providers")
  .select("name")
  .eq("user_id", userId);

const existingNames = new Set(
  (existingProviders || []).map((p) => p.name.toLowerCase())
);

const providersToInsert = healthcareProviders
  .filter((provider) => !existingNames.has(provider.provider_name.toLowerCase()))
  .map((provider) => ({
    user_id: userId,
    name: provider.provider_name,
    status: "active",
    guessed_portal_brand: null,
    guessed_portal_confidence: null,
  }));

  const { data: insertedProviders, error: providerInsertError } =
    await supabaseAdmin
      .from("providers")
      .insert(providersToInsert)
      .select("id, name");

  if (providerInsertError) {
    throw new Error(providerInsertError.message);
  }

  const visitRows: any[] = [];

  for (let i = 0; i < healthcareProviders.length; i++) {
    const provider = healthcareProviders[i];
    const inserted = insertedProviders?.[i];

    if (!inserted) continue;

    for (const txId of provider.source_transaction_ids) {
      const tx = txById.get(txId);
      if (!tx) continue;

      visitRows.push({
        user_id: userId,
        provider_id: inserted.id,
        source: "transaction",
        visit_date: tx.date,
        amount_cents: Math.round(Math.abs(tx.amount) * 100),
      });
    }
  }

  const { error: visitInsertError } = await supabaseAdmin
    .from("provider_visits")
    .insert(visitRows);

  if (visitInsertError) {
    throw new Error(visitInsertError.message);
  }

  return {
    provider_count: insertedProviders?.length ?? 0,
    visit_count: visitRows.length,
  };
}