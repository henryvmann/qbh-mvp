// src/lib/qbh/discovery/build-provider-registry.ts

import { classifyTransactionsWithAI } from "../../openai/classify-transactions";
import { batchNpiLookup } from "../../npi/lookup";
import { lookupPlacePhone } from "../../google/places-lookup";
import { supabaseAdmin } from "../../supabase-server";

/**
 * HEALTHCARE_ALLOWLIST — merchants that ALWAYS classify as healthcare,
 * regardless of any user feedback. The feedback loop (per-user
 * dismissals → filter on next scan) lets users tell us "this isn't
 * healthcare for me," but real chains shouldn't be poisonable. If a
 * user dismisses CVS because they only buy snacks there, that signal
 * stays on their account; another user's CVS pickups still classify
 * as pharmacy.
 *
 * Uppercase normalized form. Match is exact-equality on
 * normalized_name AFTER normalizeProviderName runs.
 */
const HEALTHCARE_ALLOWLIST = new Set([
  "CVS", "CVS PHARMACY", "WALGREENS", "RITE AID", "DUANE READE",
  "MOUNT SINAI", "MOUNT SINAI HOSP", "NORTHWELL HEALTH", "KAISER PERMANENTE",
  "ONE MEDICAL", "QUEST DIAGNOSTICS", "LABCORP",
  "WARBY PARKER", "PEARLE VISION", "LENSCRAFTERS", "VISIONWORKS",
  "CITYMD URGENT CARE", "CITYMD",
]);

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

/**
 * NPI's taxonomy includes plenty of entries that are *registered*
 * providers but not what a user thinks of as a clinical care visit:
 *   - "Local Education Agency (LEA)" — public schools that employ
 *     nurses; will match "Westport Public Schools" by name.
 *   - "Massage Therapist", "Massage Therapy" — chains like Massage
 *     Envy match cleanly; not part of QBH's care-team mental model.
 *   - "Aide" / "Assistant" / "Technician" categories with no LICENSE
 *     to deliver primary care.
 * A clean NPI hit on a non-clinical taxonomy should NOT auto-promote
 * the merchant to HEALTHCARE. This filter keeps the override conservative.
 */
function _isClinicalNpiType(npiType: string | null | undefined): boolean {
  // Null taxonomy = NPI matched a registered entity but didn't return
  // a type. Without taxonomy we can't be confident it's a clinical
  // provider — refuse to auto-promote.
  if (!npiType) return false;
  const t = npiType.toLowerCase();
  const NON_CLINICAL = [
    "local education agency",
    "school",
    "massage therapist",
    "massage therapy",
    "aide",
    "assistant",
    "technician",
    "support staff",
  ];
  return !NON_CLINICAL.some((nc) => t.includes(nc));
}

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

/** Common abbreviations in transaction descriptions */
const ABBREVIATION_MAP: Record<string, string> = {
  "cnslts": "Consultants", "cnslt": "Consultant", "assoc": "Associates",
  "hlth": "Health", "med": "Medical", "dntl": "Dental", "grp": "Group",
  "ctr": "Center", "svcs": "Services", "mgmt": "Management",
  "phys": "Physical", "thrpy": "Therapy", "ortho": "Orthopedic",
  "peds": "Pediatric", "derm": "Dermatology", "psych": "Psychiatry",
  "obgyn": "OB/GYN", "surg": "Surgery", "hosp": "Hospital",
  "fam": "Family", "int": "Internal", "rehab": "Rehabilitation",
  "diag": "Diagnostic", "img": "Imaging", "lab": "Laboratory",
  "pharm": "Pharmacy", "rx": "Pharmacy", "prof": "Professional",
};

function cleanTransactionName(raw: string): string {
  let name = raw.trim();

  // Extract name from ACH format: "ORIG CO NAME:Alma ORIG ID:..."
  const achMatch = name.match(/ORIG\s+CO\s+NAME:\s*([^\s]+(?:\s+[^\s]+)*?)\s+ORIG\s+ID:/i);
  if (achMatch) {
    name = achMatch[1].trim();
  }

  // Remove common transaction prefixes/suffixes
  name = name
    // The trailing \b is critical — without it, a token like "SEC" greedily
    // eats the rest of any word it starts ("SECKLER" → ""). The ACH-header
    // tokens we want to strip are always followed by a separator anyway.
    .replace(/\b(ORIG CO NAME|ORIG ID|DESC DATE|CO ENTRY|DESCR|CREDIT|SEC|PPD|TRACE#|EED|IND ID|IND NAME|TRN)\b[:# ]*[A-Z0-9]*/gi, "")
    .replace(/\b(ACH|POS|PURCHASE|DEBIT|CHECKCARD|CHECK CARD|ONLINE|PMT|PAYMENT)\b/gi, "")
    .replace(/\d{6,}/g, "") // Remove long number sequences (trace IDs, etc.)
    .replace(/[:\/#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Expand common abbreviations
  const words = name.split(/\s+/);
  const expanded = words.map((w) => {
    const lower = w.toLowerCase();
    return ABBREVIATION_MAP[lower] || w;
  });
  name = expanded.join(" ");

  // Remove trailing prepositions left from truncation ("Of", "Of The", "And")
  name = name.replace(/\s+(of|the|and|for|in|at)\s*$/i, "").trim();

  // Title case if ALL CAPS
  if (name === name.toUpperCase() && name.length > 3) {
    name = name.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  return name || raw.trim();
}

function pickProviderName(tx: PlaidDiscoveryTransaction): string {
  const merchantName = tx.merchant_name?.trim();
  const txName = tx.name?.trim();

  // Prefer merchant_name (cleaner), fall back to cleaned transaction name
  if (merchantName && !merchantName.match(/ORIG\s+CO\s+NAME/i)) {
    return cleanTransactionName(merchantName);
  }
  if (txName) {
    return cleanTransactionName(txName);
  }
  return "UNKNOWN PROVIDER";
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
  transactions: PlaidDiscoveryTransaction[],
  /** When set, applies per-user feedback filter — drops merchants this
   *  user has previously dismissed (unless on the immune allowlist). */
  appUserId?: string
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
    // Fitness — including "HEALTH CLUB", "FITNESS CLUB" and similar that
    // confused the classifier into treating the word "HEALTH" as a signal.
    "GYM", "FITNESS", "CROSSFIT", "YOGA", "PILATES",
    "HEALTH CLUB", "FITNESS CLUB", "ATHLETIC CLUB", "SPORTS CLUB",
    "SOULCYCLE", "EQUINOX", "PURE BARRE", "BARRY'S",
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
    // Healthcare platforms/tools (not providers themselves — billing /
    // booking / credentialing layers that show up on a card statement).
    "SIMPLEPRACTICE", "SIMPLE PRACTICE", "PSYCHTODAY", "PSYCH TODAY", "PSYCHOLOGY TODAY",
    "THERAPYNOTES", "THERAPY NOTES", "HEADWAY", "ZOCDOC", "HEALTHGRADES",
    "ALMA THERAPY", "ALMA HEALTH", "BETTERHELP", "TALKSPACE", "GROW THERAPY",
    "SPRING HEALTH", "LYRA HEALTH", "MODERN HEALTH",
    // Misc
    "PET ", "VET ", "VETERINA", "LANDSCAP", "CLEANING", "LAUNDRY", "DRY CLEAN",
    // Pet hospitals/clinics — the word "Hospital"/"Clinic" tripped the
    // classifier into thinking these are human healthcare. Use prefix
    // patterns ("ANIMAL HOSPITAL", "PET HOSPITAL", "ANIMAL CLINIC") so
    // we catch any-town variants ("Dallas Animal Hospital").
    "ANIMAL HOSPITAL", "ANIMAL CLINIC", "PET HOSPITAL", "PET CLINIC",
    "BANFIELD", "VCA ANIMAL", "BLUEPEARL", "VETSMART",
    // Massage / spa chains. NPI's "Massage Therapist" profession code
    // matches these by name; not clinical care from a user perspective.
    "MASSAGE ENVY", "MASSAGE HEIGHTS", "HAND & STONE",
    "EUROPEAN WAX", "WAXING THE CITY", "DRYBAR",
    // Childcare / daycare / preschool. AI sometimes labels these
    // "other_healthcare" because they have child-related terms.
    "KINDERCARE", "BRIGHT HORIZONS", "GODDARD SCHOOL", "PRIMROSE SCHOOL",
    "LA PETITE ACADEMY", "CHILDCARE NETWORK", "MONTESSORI", "DAYCARE",
    "CHILDREN'S ACADEMY", "CHILDRENS ACADEMY", "PRESCHOOL",
    // K-12 schools. NPI registry has "Local Education Agency (LEA)"
    // entries — schools that employ nurses get registered, but they
    // aren't medical providers from the user's perspective.
    "PUBLIC SCHOOLS", "ELEMENTARY SCHOOL", "MIDDLE SCHOOL", "HIGH SCHOOL",
    "SCHOOL DISTRICT", " ISD", "PTA ",
    // Pet pharmacies (have "pharmacy" in name but aren't human healthcare)
    "CHEWY", "PETCO", "PETSMART",
    // Big-box / chain grocery — credit card feeds often arrive with no
    // Plaid category attached, so the category-based pre-filter doesn't
    // catch them. Match by name to short-circuit before heuristics.
    "TRADER JOE", "TARGET", "COSTCO", "WALMART", "WAL-MART", "WAL MART",
    "WHOLE FOODS", "PUBLIX", "ALDI", "KROGER", "SAFEWAY", "STOP & SHOP",
    "STOP AND SHOP", "WEGMANS", "SHOPRITE", "FOOD LION", "GIANT EAGLE",
    "HARRIS TEETER", "HEB", "MEIJER", "WINCO", "SPROUTS",
    "SAMS CLUB", "SAM'S CLUB", "BJS WHOLESALE", "BJ'S WHOLESALE",
    "WESTERN BEEF", "ACME MARKETS", "FAIRWAY MARKET", "MORTON WILLIAMS",
    // "Dr.-named" non-medical brands. The "DR" / "DR." prefix is a strong
    // doctor signal, so without explicit denylist these brands get
    // classified as physicians.
    "DR PEPPER", "DR. PEPPER", "DR SQUATCH", "DR. SQUATCH",
    "DR MARTENS", "DR. MARTENS", "DR BRONNER", "DR. BRONNER",
    "DR SCHOLL", "DR. SCHOLL", "DR OETKER", "DR. OETKER",
    // Supplement / vitamin / wellness retailers (have "Health" in names)
    "DESIGNS FOR HEALTH", "VITAMIN SHOPPE", "GNC", "HEALTH FOODS",
    "WHOLE FOODS",
    // HOA / housing / building fees (often have geographic + "Commons" / "HOA"
    // patterns that have nothing to do with healthcare)
    "HOA", "HOMEOWNERS",
    // Utilities — recurring ACH debits that look therapist-shaped to the
    // heuristic ($150–$300, monthly cadence) but obviously aren't.
    "EVERSOURCE", "CON EDISON", "CONED", "PG&E", "DUKE ENERGY",
    "NATIONAL GRID", "DOMINION ENERGY", "OPTIMUM", "VERIZON", "AT&T",
    "T-MOBILE", "TMOBILE", "COMCAST", "XFINITY", "SPECTRUM",
    "WEB_PAY", "WEBPAY", "AUTOPAY", "AUTO-PAY",
  ];

  const OBVIOUS_HEALTHCARE = [
    "PHARMACY", "CVS", "WALGREENS", "RITE AID", "DUANE READE",
    "HOSPITAL", "MEDICAL", "CLINIC", "HEALTH", "DENTAL", "DENTIST",
    "DOCTOR", " MD", "DR ", "PEDIATRIC", "CARDIO", "ORTHO", "DERMA",
    "RADIOLOGY", "IMAGING", "LABCORP", "QUEST DIAG", "URGENT CARE",
    "CHIROPRACTIC", "PHYSICAL THERAPY", "MENTAL HEALTH", "PSYCHIATR", "PSYCHOLOG",
    "WARBY PARKER", "ONE MEDICAL", "MOUNT SINAI", "KAISER PERMANENTE", "NORTHWELL",
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
  const LAB_HINTS = ["LABCORP", "QUEST DIAG", "RADIOLOGY", "IMAGING"];
  const DENTIST_HINTS = ["DENTAL", "DENTIST", "ORTHODONT", "PERIODONT", " DDS"];
  const VISION_HINTS = ["WARBY PARKER", "OPTOMETR", "OPHTHALMOL", "VISION CNSLT", "VISION CARE"];
  const HOSPITAL_HINTS = ["HOSPITAL", "HEALTH SYSTEM", "MEDICAL CENTER", "MOUNT SINAI", "KAISER PERMANENTE", "NORTHWELL"];
  const URGENT_CARE_HINTS = ["URGENT CARE", "CITYMD"];
  const MENTAL_HEALTH_HINTS = ["MENTAL HEALTH", "PSYCHIATR", "PSYCHOLOG", "THERAPY", "COUNSEL", "BEHAVIORAL HEALTH"];
  const PT_HINTS = ["PHYSICAL THERAPY", "PHYSICAL THERAP", "DPT ", " DPT", "REHABILITATION"];
  const SPECIALTY_HINTS = ["DERMATOLOG", "CARDIOLOG", "GASTROENTEROLOG", "NEUROLOG", "ORTHOPEDIC", "GYNECOLOG", "OBGYN", "ONCOLOG", "UROLOG", "ENDOCRINOLOG", "RHEUMATOLOG", "PULMONOLOG"];
  const PEDIATRIC_HINTS = ["PEDIATRIC", "WILLOWS PEDIATRIC"];

  /** Pick the most specific provider_type a name implies, or null. */
  function inferProviderType(n: string): string | null {
    if (PHARMACY_HINTS.some((h) => n.includes(h))) return "pharmacy";
    if (LAB_HINTS.some((h) => n.includes(h))) return "lab";
    if (URGENT_CARE_HINTS.some((h) => n.includes(h))) return "urgent_care";
    if (DENTIST_HINTS.some((h) => n.includes(h))) return "dentist";
    if (VISION_HINTS.some((h) => n.includes(h))) return "vision";
    if (HOSPITAL_HINTS.some((h) => n.includes(h))) return "hospital";
    if (MENTAL_HEALTH_HINTS.some((h) => n.includes(h))) return "mental_health";
    if (PT_HINTS.some((h) => n.includes(h))) return "pt";
    if (SPECIALTY_HINTS.some((h) => n.includes(h))) return "specialist";
    if (PEDIATRIC_HINTS.some((h) => n.includes(h))) return "doctor";
    if (n.includes("ONE MEDICAL")) return "doctor";
    // Generic credential markers as last resort — credentialed names
    // like "DR JANE CARTER MD" without a specialty fall here.
    if (/\bMD\b/.test(n) || /\bDR\s/.test(n) || n.includes("DOCTOR")) return "doctor";
    return null;
  }

  // Pre-classify: split merchants into definite buckets vs ambiguous (needs AI)
  const preClassified = new Map<string, { bucket: "HEALTHCARE" | "IGNORE"; provider_type: string | null }>();

  // Order matters and is subtle:
  //   1) NON_HEALTHCARE name first — multi-word disqualifiers like
  //      "HEALTH CLUB" / "PET HOSPITAL" need to win over the bare
  //      "HEALTH" / "HOSPITAL" hints in OBVIOUS_HEALTHCARE.
  //   2) HEALTHCARE name next — catches CVS / Rite Aid / MD / etc.
  //   3) HEALTHCARE category — catches pharmacies that Plaid tags as
  //      ["Shops","Pharmacy"], BEFORE the bare "SHOPS" non-healthcare
  //      category check kicks in and IGNOREs them.
  //   4) NON_HEALTHCARE category — sweeps everything else.
  for (const entry of grouped.values()) {
    const n = entry.normalized_name;
    const cats = entry.categories.join(" ").toUpperCase();

    if (OBVIOUS_NOT_HEALTHCARE.some((hint) => n.includes(hint))) {
      preClassified.set(n, { bucket: "IGNORE", provider_type: null });
      continue;
    }

    if (OBVIOUS_HEALTHCARE.some((hint) => n.includes(hint))) {
      preClassified.set(n, { bucket: "HEALTHCARE", provider_type: inferProviderType(n) });
      continue;
    }

    if (["DOCTOR", "HOSPITAL", "PHARMACY", "MEDICAL", "HEALTHCARE"].some((cat) => cats.includes(cat))) {
      const isPharmacy = cats.includes("PHARMACY");
      preClassified.set(n, { bucket: "HEALTHCARE", provider_type: isPharmacy ? "pharmacy" : null });
      continue;
    }

    if (NON_HEALTHCARE_PLAID_CATEGORIES.some((cat) => cats.includes(cat))) {
      preClassified.set(n, { bucket: "IGNORE", provider_type: null });
      continue;
    }

    // Ambiguous — will go to AI
  }

  {
    const _vals = Array.from(preClassified.values());
    const _ig = _vals.filter(v => v.bucket === "IGNORE").length;
    const _hc = _vals.filter(v => v.bucket === "HEALTHCARE").length;
    console.log(`[buildProviderRegistry] Pre-filter: ${_ig} ignored, ${_hc} healthcare, ${grouped.size - preClassified.size} need AI (grouped=${grouped.size}, preClassified=${preClassified.size})`);
  }

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

  // Generic English words that, when they make up the WHOLE merchant
  // name, mean we shouldn't ping NPI — the registry has matches for
  // common phrases like "Family Practice" / "Premier Office" that are
  // unrelated to whatever real person paid this LLC.
  const GENERIC_WORDS = new Set([
    "FAMILY", "PRACTICE", "OFFICE", "GROUP", "ASSOCIATES", "ASSOCIATE",
    "PREMIER", "WESTSIDE", "EASTSIDE", "NORTHSIDE", "SOUTHSIDE", "DOWNTOWN",
    "CENTER", "CENTRE", "CONSULTING", "CONSULTANTS", "SOLUTIONS", "SERVICES",
    "LLC", "INC", "PC", "PA", "LLP", "CORP", "COMPANY", "HOLDINGS",
    "WELLNESS", "HEALTH", "HEALTHCARE", "CARE",
  ]);

  for (const input of merchantInputs) {
    const aiResult = aiClassifications.get(input.normalized_name);
    const words = input.normalized_name.split(" ").filter(Boolean);
    const looksLikePersonName = words.length >= 2 && words.length <= 4 && words.every(w => /^[A-Z]+$/.test(w));
    // Suppress NPI when the merchant name is ENTIRELY generic English —
    // no specific person name, no clinical specialty. NPI's name match
    // is too easy to false-positive on phrases like "Family Practice LLC".
    const allGeneric = words.length > 0 && words.every((w) => GENERIC_WORDS.has(w));

    // Check NPI for: person-name merchants that AI said "not healthcare"
    // or had no result, AND aren't entirely generic English.
    if (looksLikePersonName && !allGeneric && (!aiResult || !aiResult.is_healthcare)) {
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

    // Heuristic: a bare person-name merchant (2-4 ALL-CAPS words) that
    // recurs 3+ times in the $100-$500 therapy/specialist range is almost
    // certainly a healthcare provider that NPI happened to miss. Surface
    // it as REVIEW_NEEDED so the user can confirm in onboarding's review-
    // team step. We don't claim confidence; we just refuse to silently
    // drop it like we did before.
    const _words = entry.normalized_name.split(" ").filter(Boolean);
    // Real person names are 2-4 multi-letter words. Single letters
    // (H E B → "H-E-B") aren't names — they're chain initialisms.
    const _looksLikePersonName =
      _words.length >= 2 &&
      _words.length <= 4 &&
      _words.every((w) => /^[A-Z]+$/.test(w) && w.length >= 2);
    const _avgAmount = entry.amounts.length > 0 ? entry.amounts.reduce((s, v) => s + v, 0) / entry.amounts.length : 0;
    // Real therapist visits cluster tightly around the same per-session
    // rate ($150, $200, $250). Grocery / retail / random merchants in
    // the same dollar range vary widely (Trader Joe's: $34 / $217 / $254
    // / $226). Reject anything with > 35% coefficient of variation.
    let _amountConsistent = true;
    if (entry.amounts.length > 1 && _avgAmount > 0) {
      const variance =
        entry.amounts.reduce((s, v) => s + (v - _avgAmount) ** 2, 0) /
        entry.amounts.length;
      const stddev = Math.sqrt(variance);
      _amountConsistent = stddev / _avgAmount < 0.35;
    }
    // First-word tokens that strongly indicate retail / chain / utility /
    // government / payment-processor rather than a person. Disqualify
    // the therapist heuristic regardless of shape match.
    const _firstWord = _words[0] ?? "";
    const _disqualifyingFirstWord = new Set([
      // Grocery / retail chains
      "TRADER", "TARGET", "COSTCO", "WHOLE", "PUBLIX", "ALDI", "KROGER",
      "SAFEWAY", "WEGMANS", "STOP", "FOOD", "GIANT", "HARRIS", "MORTON",
      "FAIRWAY", "WESTERN", "ACME", "SHOPRITE", "MEIJER", "WINCO",
      "SPROUTS", "BJS", "SAMS", "MARKET", "DELI", "GROCER", "STORE",
      "SHOP", "MART", "HEB", "WINN",
      // Apparel / fashion chains (single brand names trip person-shape)
      "ADIDAS", "NIKE", "PUMA", "REEBOK", "UNIQLO", "ZARA", "GAP", "BANANA",
      "MADEWELL", "JCREW", "ATHLETA", "LULULEMON", "COACH", "MICHAEL",
      "SHEIN", "TEMU", "POSHMARK",
      // Utilities / energy / telecom
      "EVERSOURCE", "DOMINION", "DUKE", "CON", "PG&E", "PG", "PSEG",
      "NATIONAL", "SOUTHERN", "VERIZON", "ATT", "AT&T", "TMOBILE", "T-MOBILE",
      "XFINITY", "COMCAST", "OPTIMUM", "SPECTRUM", "CHARTER",
      "CITY", "TOWN", "STATE", "COUNTY",
      // Payment processors / banks
      "ZELLE", "VENMO", "PAYPAL", "CASH", "CASHAPP",
      "FIDELITY", "SCHWAB", "VANGUARD", "ROBINHOOD", "COINBASE",
      // Government
      "DMV", "IRS", "USATAXPYMT", "USPS", "NJ", "NY", "CA", "TX", "FL",
      "MA", "PA", "VA", "GA", "NC", "OH", "IL", "MI", "AZ",
      // Government / municipal indicators that show up mid-string
      "WATER", "POLLUTION", "DEPT", "DEPARTMENT", "MUNICIPAL",
      "POLICE", "FIRE", "COURT", "LICENSE", "REGISTRATION",
      // Religious / charitable
      "ST", "TEMPLE", "CHURCH", "DIOCESE", "PARISH",
    ]);
    // Special characters get stripped by normalize, so we check the
    // raw provider_name for payment-processor / tag separators that
    // signal "not a person." Catches "Cash App*Laura", "AT&T*",
    // "Six Flags *" etc.
    const _hasNonNameToken = /[*&./@#]/.test(entry.provider_name);
    // Match the disqualifier against ANY word, not just the first.
    // "Raleigh Temple", "Oakland Water Pollution Ctl" both have the
    // discriminating token mid-string.
    const _looksLikeRetail = _words.some((w) => _disqualifyingFirstWord.has(w));
    const _therapistFrequencyHit =
      _looksLikePersonName &&
      !_looksLikeRetail &&
      !_hasNonNameToken &&
      _amountConsistent &&
      entry.transaction_ids.length >= 3 &&
      _avgAmount >= 100 &&
      _avgAmount <= 500;

    // Priority: pre-filter → NPI → AI → therapist heuristic → ignore
    if (preResult?.bucket === "IGNORE") {
      bucket = "IGNORE";
      care_action_type = null;
    } else if (preResult?.bucket === "HEALTHCARE") {
      bucket = "HEALTHCARE";
      care_action_type = "CHECK_APPOINTMENT_STATUS";
      provider_type = preResult.provider_type;
    } else if (npiResult?.found && _isClinicalNpiType(npiResult.provider_type)) {
      // NPI lookup by name has a non-trivial false-positive rate — common
      // first/last name combos collide with real registered providers.
      // Treat it as authoritative only when (a) the NPI taxonomy is a
      // real clinical provider type (not Local Education Agency, not
      // Massage Therapist alone, not Acupuncturist Aide etc.) AND (b)
      // the spending pattern suggests a real provider relationship
      // (2+ recurring visits). Otherwise route to REVIEW_NEEDED so the
      // user makes the call.
      const isRecurring = entry.transaction_ids.length >= 2;
      if (isRecurring) {
        bucket = "HEALTHCARE";
        care_action_type = "CHECK_APPOINTMENT_STATUS";
        provider_type = npiResult.provider_type;
        console.log(`[buildProviderRegistry] NPI override: "${entry.provider_name}" → HEALTHCARE (${npiResult.provider_type})`);
      } else {
        bucket = "REVIEW_NEEDED";
        care_action_type = "REVIEW_PROVIDER";
        provider_type = npiResult.provider_type;
        console.log(`[buildProviderRegistry] NPI single-visit: "${entry.provider_name}" → REVIEW_NEEDED (${npiResult.provider_type})`);
      }
    } else if (aiResult) {
      if (aiResult.is_healthcare && aiResult.confidence === "high") {
        bucket = "HEALTHCARE";
        care_action_type = "CHECK_APPOINTMENT_STATUS";
        provider_type = aiResult.provider_type;
      } else if (aiResult.is_healthcare) {
        bucket = "REVIEW_NEEDED";
        care_action_type = "REVIEW_PROVIDER";
        provider_type = aiResult.provider_type;
      } else if (_therapistFrequencyHit) {
        // AI said no, NPI missed, but the spend pattern is very-therapist —
        // surface it for user confirmation rather than silently dropping.
        bucket = "REVIEW_NEEDED";
        care_action_type = "REVIEW_PROVIDER";
        provider_type = "mental_health";
        console.log(`[buildProviderRegistry] Therapist heuristic: "${entry.provider_name}" → REVIEW_NEEDED (visits=${entry.transaction_ids.length}, avg=$${_avgAmount.toFixed(0)})`);
      } else {
        bucket = "IGNORE";
        care_action_type = null;
      }
    } else if (_therapistFrequencyHit) {
      // AI returned nothing AND NPI missed — same heuristic catches it.
      bucket = "REVIEW_NEEDED";
      care_action_type = "REVIEW_PROVIDER";
      provider_type = "mental_health";
      console.log(`[buildProviderRegistry] Therapist heuristic: "${entry.provider_name}" → REVIEW_NEEDED (visits=${entry.transaction_ids.length}, avg=$${_avgAmount.toFixed(0)})`);
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

  // Per-user dismissal filter: drop merchants this user has previously
  // told us aren't healthcare. Allowlisted chains (CVS, Walgreens,
  // etc.) are immune — one user's feedback can't suppress them.
  let filtered = providers;
  if (appUserId) {
    try {
      const { data: dismissed } = await supabaseAdmin
        .from("classifier_dismissals")
        .select("normalized_name")
        .eq("app_user_id", appUserId);
      const dismissSet = new Set(
        (dismissed ?? []).map((d) => String(d.normalized_name).toUpperCase().trim())
      );
      if (dismissSet.size > 0) {
        const before = filtered.length;
        filtered = filtered.filter((p) => {
          const norm = (p.normalized_name ?? "").toUpperCase().trim();
          if (HEALTHCARE_ALLOWLIST.has(norm)) return true; // immune
          return !dismissSet.has(norm);
        });
        if (before !== filtered.length) {
          console.log(
            `[buildProviderRegistry] Per-user dismissal filter: dropped ${before - filtered.length} of ${before} (allowlist immune)`
          );
        }
      }
    } catch (err) {
      // Feedback filter is non-blocking — if the table query fails for
      // any reason, classification still proceeds normally.
      console.error("[buildProviderRegistry] dismissal filter error (continuing):", err);
    }
  }

  console.log(`[buildProviderRegistry] Result: ${filtered.filter(p => p.bucket === "HEALTHCARE").length} healthcare, ${filtered.filter(p => p.bucket === "REVIEW_NEEDED").length} review_needed`);

  return filtered;
}
