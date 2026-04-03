// src/lib/qbh/discovery/build-provider-registry.ts

import { classifyTransactionsWithAI } from "../../openai/classify-transactions";
import { batchNpiLookup } from "../../npi/lookup";

type DiscoveryBucket = "HEALTHCARE" | "REVIEW_NEEDED" | "IGNORE";

export type PlaidDiscoveryTransaction = {
  transaction_id: string;
  name: string | null;
  merchant_name: string | null;
  amount: number | string | null;
  date: string;
  category: string[] | null;
};

export type DiscoveredProvider = {
  provider_key: string;
  provider_name: string;
  normalized_name: string;
  bucket: DiscoveryBucket;
  care_action_type: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  visit_count: number;
  median_gap_days: number | null;
  source_transaction_ids: string[];
};

function normalizeProviderName(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(
      /\b(ACH|POS|PURCHASE|DEBIT|CHECKCARD|CHECK CARD|CARD|ONLINE|PMT|PAYMENT)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function pickProviderName(tx: PlaidDiscoveryTransaction): string {
  const raw = (tx.merchant_name || tx.name || "").trim();
  return raw || "UNKNOWN PROVIDER";
}

function daysBetween(a: string, b: string): number {
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  return Math.round((bMs - aMs) / (1000 * 60 * 60 * 24));
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Groups transactions by merchant, then uses OpenAI to classify each
 * as healthcare or not. Falls back to keyword matching if AI fails.
 */
export async function buildProviderRegistry(
  transactions: PlaidDiscoveryTransaction[]
): Promise<DiscoveredProvider[]> {
  // Step 1: Group transactions by normalized merchant name
  const grouped = new Map<
    string,
    {
      provider_name: string;
      normalized_name: string;
      transaction_ids: string[];
      dates: string[];
      amounts: number[];
      categories: string[];
    }
  >();

  for (const tx of transactions) {
    const providerName = pickProviderName(tx);
    const normalizedName = normalizeProviderName(providerName);
    if (!normalizedName) continue;

    const txCategories = Array.isArray(tx.category) ? tx.category : [];
    const existing = grouped.get(normalizedName);

    if (existing) {
      existing.transaction_ids.push(tx.transaction_id);
      existing.dates.push(tx.date);
      existing.amounts.push(Math.abs(Number(tx.amount || 0)));
      existing.categories.push(...txCategories);
      continue;
    }

    grouped.set(normalizedName, {
      provider_name: providerName,
      normalized_name: normalizedName,
      transaction_ids: [tx.transaction_id],
      dates: [tx.date],
      amounts: [Math.abs(Number(tx.amount || 0))],
      categories: [...txCategories],
    });
  }

  // Step 2: Prepare merchant list for AI classification
  const merchantInputs = Array.from(grouped.values()).map((entry) => ({
    name: entry.provider_name,
    normalized_name: entry.normalized_name,
    plaid_categories: [...new Set(entry.categories)],
    visit_count: entry.transaction_ids.length,
    avg_amount:
      entry.amounts.length > 0
        ? entry.amounts.reduce((s, v) => s + v, 0) / entry.amounts.length
        : 0,
  }));

  // Step 3: Classify with AI (batched — gpt-4o-mini handles up to ~100 merchants easily)
  let aiClassifications = new Map<string, { is_healthcare: boolean; confidence: string; provider_type: string | null }>();

  try {
    console.log(`[buildProviderRegistry] Classifying ${merchantInputs.length} merchants with AI...`);
    const results = await classifyTransactionsWithAI(merchantInputs);
    aiClassifications = results;
    console.log(`[buildProviderRegistry] AI classified ${results.size} merchants`);
  } catch (err) {
    console.error("[buildProviderRegistry] AI classification failed, using fallback:", err);
    // AI failed — fall through to empty map, everything becomes REVIEW_NEEDED or IGNORE via fallback
  }

  // Step 4: NPI registry check for merchants AI classified as "not healthcare"
  // Person-name merchants (2+ words, recurring, $100-500 avg) might be therapists
  const npiCandidates: Array<{ normalized_name: string; original_name: string }> = [];

  for (const input of merchantInputs) {
    const aiResult = aiClassifications.get(input.normalized_name);
    const words = input.normalized_name.split(" ").filter(Boolean);
    const looksLikePersonName = words.length >= 2 && words.length <= 4 && words.every(w => /^[A-Z]+$/.test(w));

    // Check NPI for: person-name merchants that AI said "not healthcare" or had no result
    if (looksLikePersonName && (!aiResult || !aiResult.is_healthcare)) {
      npiCandidates.push({
        normalized_name: input.normalized_name,
        original_name: input.name,
      });
    }
  }

  let npiResults = new Map<string, { found: boolean; provider_type: string | null }>();
  if (npiCandidates.length > 0) {
    try {
      console.log(`[buildProviderRegistry] Checking ${npiCandidates.length} person-name merchants against NPI registry...`);
      npiResults = await batchNpiLookup(npiCandidates);
      const npiHits = Array.from(npiResults.values()).filter(r => r.found).length;
      console.log(`[buildProviderRegistry] NPI found ${npiHits} licensed providers`);
    } catch (err) {
      console.error("[buildProviderRegistry] NPI lookup failed:", err);
    }
  }

  // Step 5: Build provider list using AI results + NPI verification
  const providers: DiscoveredProvider[] = [];

  for (const entry of grouped.values()) {
    const sortedDates = [...entry.dates].sort();
    const gaps: number[] = [];
    for (let i = 1; i < sortedDates.length; i += 1) {
      gaps.push(daysBetween(sortedDates[i - 1], sortedDates[i]));
    }

    const aiResult = aiClassifications.get(entry.normalized_name);
    const npiResult = npiResults.get(entry.normalized_name);

    let bucket: DiscoveryBucket;
    let care_action_type: string | null;

    // NPI registry match overrides AI — if they have a license, they're healthcare
    if (npiResult?.found) {
      bucket = "HEALTHCARE";
      care_action_type = "CHECK_APPOINTMENT_STATUS";
      console.log(`[buildProviderRegistry] NPI override: "${entry.provider_name}" → HEALTHCARE (${npiResult.provider_type})`);
    } else if (aiResult) {
      if (aiResult.is_healthcare && aiResult.confidence === "high") {
        bucket = "HEALTHCARE";
        care_action_type = "CHECK_APPOINTMENT_STATUS";
      } else if (aiResult.is_healthcare) {
        // Medium/low confidence healthcare — let user confirm
        bucket = "REVIEW_NEEDED";
        care_action_type = "REVIEW_PROVIDER";
      } else {
        // AI says not healthcare
        bucket = "IGNORE";
        care_action_type = null;
      }
    } else {
      // No AI result (fallback) — use simple heuristic
      bucket = "IGNORE";
      care_action_type = null;
    }

    if (bucket === "IGNORE") continue;

    providers.push({
      provider_key: entry.normalized_name.toLowerCase().replace(/\s+/g, "_"),
      provider_name: entry.provider_name,
      normalized_name: entry.normalized_name,
      bucket,
      care_action_type,
      first_seen_at: sortedDates[0] || null,
      last_seen_at: sortedDates[sortedDates.length - 1] || null,
      visit_count: entry.transaction_ids.length,
      median_gap_days: median(gaps),
      source_transaction_ids: entry.transaction_ids,
    });
  }

  providers.sort((a, b) => {
    const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return bTime - aTime;
  });

  console.log(`[buildProviderRegistry] Result: ${providers.filter(p => p.bucket === "HEALTHCARE").length} healthcare, ${providers.filter(p => p.bucket === "REVIEW_NEEDED").length} review_needed`);

  return providers;
}
