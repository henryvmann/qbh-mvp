// src/lib/qbh/discovery/build-provider-registry.ts

import { classifyTransactionsWithAI } from "../../openai/classify-transactions";
import { batchNpiLookup } from "../../npi/lookup";
import { lookupPlacePhone } from "../../google/places-lookup";

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
  provider_type: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  visit_count: number;
  median_gap_days: number | null;
  source_transaction_ids: string[];
  phone_number: string | null;
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

  // Step 1.5: Pre-filter obvious non-healthcare by name and Plaid category
  // These never need AI — saves cost and prevents false positives
  const OBVIOUS_NOT_HEALTHCARE = [
    // Food & drink
    "ICE CREAM", "PIZZA", "BURGER", "TACO", "SUSHI", "BAKERY", "CAFE", "COFFEE",
    "RESTAURANT", "GRILL", "DINER", "BISTRO", "BAR ", "PUB ", "BREWERY", "DONUT",
    "BAGEL", "SANDWICH", "WING", "BBQ", "BUFFET", "NOODLE", "RAMEN",
    // Retail / grocery
    "MARKET", "GROCERY", "SUPERMARKET", "DELI", "LIQUOR", "WINE", "BEER",
    // Transport
    "GAS STATION", "CAR WASH", "AUTO ", "PARKING", "TOLL ", "TAXI",
    // Beauty / personal
    "SALON", "BARBER", "NAIL", "SPA ", "BEAUTY", "HAIR", "WAXING", "LASH", "TATTOO",
    // Fitness
    "GYM", "FITNESS", "CROSSFIT", "YOGA", "PILATES",
    // Entertainment
    "CINEMA", "MOVIE", "THEATER", "THEATRE", "ARCADE", "BOWLING",
    // Finance / transfers
    "TRANSFER", "DEPOSIT", "WITHDRAWAL", "ZELLE", "VENMO", "PAYROLL", "PAYCHECK",
    "LATE FEE", "INTEREST ", "PREMIUM", "MORTGAGE", "LOAN ", "INVEST", "BROKERAGE",
    "FIDELITY", "SCHWAB", "VANGUARD", "AMERITRADE", "MERRILL",
    // Insurance (not a provider — paying premiums is NOT a provider visit)
    "INSURANCE", "INSUR ",
    "WILLIAM PENN", "GEICO", "STATE FARM", "ALLSTATE", "PROGRESSIVE",
    "LIBERTY MUTUAL", "NATIONWIDE", "USAA", "FARMERS", "METLIFE",
    "CIGNA", "AETNA", "ANTHEM", "HUMANA", "KAISER",
    "UNITED HEALTH", "UNITEDHEALTH", "BLUE CROSS", "BLUECROSS", "BCBS",
    "GUARDIAN", "LINCOLN FINANCIAL", "AFLAC", "PRUDENTIAL", "HARTFORD",
    "TRAVELERS", "MUTUAL OF OMAHA",
    // Healthcare platforms/tools (not providers)
    "SIMPLEPRACTICE", "SIMPLE PRACTICE", "PSYCHTODAY", "PSYCH TODAY", "PSYCHOLOGY TODAY",
    "THERAPYNOTES", "THERAPY NOTES", "HEADWAY", "ZOCDOC", "HEALTHGRADES",
    // Misc
    "PET ", "VET ", "VETERINA", "LANDSCAP", "CLEANING", "LAUNDRY", "DRY CLEAN",
  ];

  const OBVIOUS_HEALTHCARE = [
    "PHARMACY", "CVS", "WALGREENS", "RITE AID", "DUANE READE",
    "HOSPITAL", "MEDICAL", "CLINIC", "HEALTH", "DENTAL", "DENTIST",
    "DOCTOR", " MD", "DR ", "PEDIATRIC", "CARDIO", "ORTHO", "DERMA",
    "RADIOLOGY", "IMAGING", "LABCORP", "QUEST DIAG", "URGENT CARE",
    "CHIROPRACTIC", "PHYSICAL THERAPY", "MENTAL HEALTH", "PSYCHIATR", "PSYCHOLOG",
  ];

  const NON_HEALTHCARE_PLAID_CATEGORIES = [
    "FOOD", "RESTAURANT", "COFFEE", "BAR",
    "SHOP", "CLOTHING", "ELECTRONICS", "DEPARTMENT STORE", "SUPERMARKET", "GROCERY",
    "TRAVEL", "AIRLINE", "HOTEL", "LODGING", "CAR RENTAL",
    "RECREATION", "GYM", "FITNESS", "SPORT", "ENTERTAINMENT", "MUSIC", "GAME",
    "PERSONAL CARE", "SALON", "BARBER", "BEAUTY",
    "AUTOMOTIVE", "GAS STATION", "PARKING",
    "UTILITIES", "PHONE", "INTERNET", "CABLE",
    "INSURANCE",
    "RENT", "MORTGAGE",
    "TRANSFER", "DEPOSIT", "WITHDRAWAL", "ATM",
    "TAX", "GOVERNMENT",
    "EDUCATION", "TUITION",
    "PET",
    "SUBSCRIPTION",
  ];

  const PHARMACY_HINTS = ["PHARMACY", "CVS", "WALGREENS", "RITE AID", "DUANE READE"];
  const LAB_HINTS = ["LABCORP", "QUEST DIAG"];

  // Pre-classify: split merchants into definite buckets vs ambiguous (needs AI)
  const preClassified = new Map<string, { bucket: "HEALTHCARE" | "IGNORE"; provider_type: string | null }>();

  for (const entry of grouped.values()) {
    const n = entry.normalized_name;
    const cats = entry.categories.join(" ").toUpperCase();

    // Check obvious non-healthcare by name
    if (OBVIOUS_NOT_HEALTHCARE.some((hint) => n.includes(hint))) {
      preClassified.set(n, { bucket: "IGNORE", provider_type: null });
      continue;
    }

    // Check obvious non-healthcare by Plaid category
    if (NON_HEALTHCARE_PLAID_CATEGORIES.some((cat) => cats.includes(cat))) {
      preClassified.set(n, { bucket: "IGNORE", provider_type: null });
      continue;
    }

    // Check obvious healthcare by name — detect specific types
    if (OBVIOUS_HEALTHCARE.some((hint) => n.includes(hint))) {
      const isPharmacy = PHARMACY_HINTS.some((h) => n.includes(h));
      const isLab = LAB_HINTS.some((h) => n.includes(h));
      const pType = isPharmacy ? "pharmacy" : isLab ? "lab" : null;
      preClassified.set(n, { bucket: "HEALTHCARE", provider_type: pType });
      continue;
    }

    // Check healthcare by Plaid category
    if (["DOCTOR", "HOSPITAL", "PHARMACY", "MEDICAL", "HEALTHCARE"].some((cat) => cats.includes(cat))) {
      const isPharmacy = cats.includes("PHARMACY");
      preClassified.set(n, { bucket: "HEALTHCARE", provider_type: isPharmacy ? "pharmacy" : null });
      continue;
    }

    // Ambiguous — will go to AI
  }

  console.log(`[buildProviderRegistry] Pre-filter: ${Array.from(preClassified.values()).filter(v => v.bucket === "IGNORE").length} ignored, ${Array.from(preClassified.values()).filter(v => v.bucket === "HEALTHCARE").length} healthcare, ${grouped.size - preClassified.size} need AI`);

  // Step 2: Prepare ONLY ambiguous merchants for AI classification
  const merchantInputs = Array.from(grouped.values())
    .filter((entry) => !preClassified.has(entry.normalized_name))
    .map((entry) => ({
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

  let npiResults = new Map<string, { found: boolean; provider_type: string | null; phone_number: string | null }>();
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

  // Step 5: Google Places phone lookup for healthcare providers not found in NPI
  const placesPhoneByName = new Map<string, string | null>();
  const placesCandidates: Array<{ normalized_name: string; provider_name: string }> = [];

  for (const input of merchantInputs) {
    const aiResult = aiClassifications.get(input.normalized_name);
    const npiResult = npiResults.get(input.normalized_name);

    // If AI says healthcare but NPI didn't find them (or NPI found but no phone), try Google Places
    if (aiResult?.is_healthcare && (!npiResult?.found || !npiResult?.phone_number)) {
      placesCandidates.push({
        normalized_name: input.normalized_name,
        provider_name: input.name,
      });
    }
  }

  if (placesCandidates.length > 0) {
    console.log(`[buildProviderRegistry] Looking up ${placesCandidates.length} providers via Google Places...`);
    const PLACES_CONCURRENCY = 3;
    for (let i = 0; i < placesCandidates.length; i += PLACES_CONCURRENCY) {
      const batch = placesCandidates.slice(i, i + PLACES_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (c) => ({
          key: c.normalized_name,
          phone: await lookupPlacePhone(c.provider_name).catch(() => null),
        }))
      );
      for (const { key, phone } of results) {
        placesPhoneByName.set(key, phone);
      }
    }
    const placesHits = Array.from(placesPhoneByName.values()).filter(Boolean).length;
    console.log(`[buildProviderRegistry] Google Places found ${placesHits} phone numbers`);
  }

  // Step 6: Build provider list using AI results + NPI verification
  const providers: DiscoveredProvider[] = [];

  for (const entry of grouped.values()) {
    const sortedDates = [...entry.dates].sort();
    const gaps: number[] = [];
    for (let i = 1; i < sortedDates.length; i += 1) {
      gaps.push(daysBetween(sortedDates[i - 1], sortedDates[i]));
    }

    const preResult = preClassified.get(entry.normalized_name);
    const aiResult = aiClassifications.get(entry.normalized_name);
    const npiResult = npiResults.get(entry.normalized_name);

    let bucket: DiscoveryBucket;
    let care_action_type: string | null;
    let provider_type: string | null = null;

    // Priority: pre-filter → NPI → AI → ignore
    if (preResult?.bucket === "IGNORE") {
      bucket = "IGNORE";
      care_action_type = null;
    } else if (preResult?.bucket === "HEALTHCARE") {
      bucket = "HEALTHCARE";
      care_action_type = "CHECK_APPOINTMENT_STATUS";
      provider_type = preResult.provider_type;
    } else if (npiResult?.found) {
      bucket = "HEALTHCARE";
      care_action_type = "CHECK_APPOINTMENT_STATUS";
      provider_type = npiResult.provider_type;
      console.log(`[buildProviderRegistry] NPI override: "${entry.provider_name}" → HEALTHCARE (${npiResult.provider_type})`);
    } else if (aiResult) {
      if (aiResult.is_healthcare && aiResult.confidence === "high") {
        bucket = "HEALTHCARE";
        care_action_type = "CHECK_APPOINTMENT_STATUS";
        provider_type = aiResult.provider_type;
      } else if (aiResult.is_healthcare) {
        bucket = "REVIEW_NEEDED";
        care_action_type = "REVIEW_PROVIDER";
        provider_type = aiResult.provider_type;
      } else {
        bucket = "IGNORE";
        care_action_type = null;
      }
    } else {
      bucket = "IGNORE";
      care_action_type = null;
    }

    if (bucket === "IGNORE") continue;

    // Phone number: prefer NPI, then Google Places
    const phoneNumber =
      npiResult?.phone_number ||
      placesPhoneByName.get(entry.normalized_name) ||
      null;

    providers.push({
      provider_key: entry.normalized_name.toLowerCase().replace(/\s+/g, "_"),
      provider_name: entry.provider_name,
      normalized_name: entry.normalized_name,
      bucket,
      care_action_type,
      provider_type,
      first_seen_at: sortedDates[0] || null,
      last_seen_at: sortedDates[sortedDates.length - 1] || null,
      visit_count: entry.transaction_ids.length,
      median_gap_days: median(gaps),
      source_transaction_ids: entry.transaction_ids,
      phone_number: phoneNumber,
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
