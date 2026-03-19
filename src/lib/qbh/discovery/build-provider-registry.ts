// src/lib/qbh/discovery/build-provider-registry.ts

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

function classifyProvider(
  normalizedName: string,
  visitCount: number,
  amountSamples: number[],
  categories: string[]
): { bucket: DiscoveryBucket; care_action_type: string | null } {
  const joined = normalizedName;
  const words = new Set(normalizedName.split(" ").filter(Boolean));
  const joinedCategories = categories.join(" ").toUpperCase();

  const healthcareHints = [
    "MD",
    "DR",
    "DENTAL",
    "ORTHO",
    "PEDIATRIC",
    "CARDIO",
    "MEDICAL",
    "HOSPITAL",
    "HEALTH",
    "CLINIC",
    "RADIOLOGY",
    "IMAGING",
    "LAB",
    "LABCORP",
    "QUEST",
    "PHARMACY",
    "URGENT CARE",
    "DERM",
    "OBGYN",
    "VISION",
    "OPTICAL",
    "THERAPY",
    "PT",
    "CHIROPRACTIC",
    "PEDS",
  ];

  const ignoreHints = [
    "AMAZON",
    "UBER",
    "LYFT",
    "SHELL",
    "EXXON",
    "CHEVRON",
    "MCDONALD",
    "STARBUCKS",
    "TARGET",
    "WALMART",
    "COSTCO",
    "WHOLE FOODS",
    "TRADER JOE",
    "VENMO",
    "ZELLE",
    "GUSTO",
    "PAYROLL",
    "ADP",
    "PAYCHEX",
    "INTUIT PAYROLL",
    "QUICKBOOKS PAYROLL",
    "RIPPLING",
    "TRINET",
    "JUSTWORKS",
    "DEEL",
  ];

  const pharmacyHealthcareHints = ["CVS", "WALGREENS"];

  const pharmacyReviewHints = ["RITE AID", "DUANE READE"];

  const hasHint = (hint: string): boolean => {
    if (hint.includes(" ")) {
      return joined.includes(hint);
    }

    return words.has(hint);
  };

  if (ignoreHints.some(hasHint)) {
    return { bucket: "IGNORE", care_action_type: null };
  }

  if (
    joinedCategories.includes("DOCTOR") ||
    joinedCategories.includes("HOSPITAL") ||
    joinedCategories.includes("PHARMACY") ||
    joinedCategories.includes("MEDICAL") ||
    joinedCategories.includes("HEALTHCARE")
  ) {
    return {
      bucket: "HEALTHCARE",
      care_action_type: "CHECK_APPOINTMENT_STATUS",
    };
  }

  if (pharmacyHealthcareHints.some(hasHint)) {
    return {
      bucket: "HEALTHCARE",
      care_action_type: "CHECK_APPOINTMENT_STATUS",
    };
  }

  if (healthcareHints.some(hasHint)) {
    return {
      bucket: "HEALTHCARE",
      care_action_type: "CHECK_APPOINTMENT_STATUS",
    };
  }

  if (pharmacyReviewHints.some(hasHint)) {
    return {
      bucket: "REVIEW_NEEDED",
      care_action_type: "REVIEW_PROVIDER",
    };
  }

  const avgAmount =
    amountSamples.length > 0
      ? amountSamples.reduce((sum, value) => sum + value, 0) /
        amountSamples.length
      : 0;

  if (visitCount >= 2 && avgAmount > 40) {
    return { bucket: "REVIEW_NEEDED", care_action_type: "REVIEW_PROVIDER" };
  }

  return { bucket: "IGNORE", care_action_type: null };
}

export function buildProviderRegistry(
  transactions: PlaidDiscoveryTransaction[]
): DiscoveredProvider[] {
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

  const providers: DiscoveredProvider[] = [];

  for (const entry of grouped.values()) {
    const sortedDates = [...entry.dates].sort();
    const gaps: number[] = [];

    for (let i = 1; i < sortedDates.length; i += 1) {
      gaps.push(daysBetween(sortedDates[i - 1], sortedDates[i]));
    }

    const { bucket, care_action_type } = classifyProvider(
      entry.normalized_name,
      entry.transaction_ids.length,
      entry.amounts,
      entry.categories
    );

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

  return providers;
}