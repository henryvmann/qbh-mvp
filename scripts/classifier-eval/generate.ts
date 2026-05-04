/**
 * Fixture generator.
 *
 * Builds N labeled Plaid-shape transactions per call by:
 *   1. Choosing a target healthcare ratio (default 10%, mirrors real data).
 *   2. Sampling seeds from REAL_SEEDS / EDGE_CASES / AMBIGUOUS_HEALTHCARE
 *      according to that ratio.
 *   3. Resolving placeholders ({{NAME}}, {{NUM4}}, etc.) with a seeded RNG.
 *   4. Emitting visit_pattern-appropriate counts (recurring → 3-12, occasional
 *      → 1-3, one-off → 1) so distributions look realistic and the classifier's
 *      visit-count signal is exercised.
 *
 * Each output row pairs a Plaid-shaped tx with its ground-truth label.
 * The same seed flows through unchanged across runs IF the RNG seed
 * matches; deterministic for regression, randomized for variance tests.
 */

import { FIRST_NAMES, LAST_NAMES, RESTAURANT_POOL, EDGE_CASES, REAL_SEEDS, AMBIGUOUS_HEALTHCARE, type Seed, type SeedTruth } from "./seeds";

export type LabeledTx = {
  tx: {
    transaction_id: string;
    name: string;
    merchant_name: string | null;
    amount: number;
    date: string; // YYYY-MM-DD
    category: string[] | null;
  };
  truth: SeedTruth & {
    /** Stable canonical name for the merchant — used to roll up multiple
     *  transactions to a single ground-truth provider when scoring. */
    canonical_name: string;
    /** The seed that produced this tx — for failure-mode grouping. */
    tag: string | undefined;
  };
};

/** Mulberry32 — small, deterministic PRNG. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng: () => number, lo: number, hi: number): number {
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

function randAmount(rng: () => number, range: [number, number] | undefined): number {
  const [lo, hi] = range || [10, 100];
  // Round to cents; bias slightly low.
  return Math.round((lo + rng() * (hi - lo)) * 100) / 100;
}

function randDateInLast12mo(rng: () => number): string {
  const now = new Date();
  const past = new Date(now);
  past.setMonth(past.getMonth() - 12);
  const ms = past.getTime() + rng() * (now.getTime() - past.getTime());
  return new Date(ms).toISOString().slice(0, 10);
}

function txId(rng: () => number): string {
  // Plaid transaction_id is ~37 chars alphanum
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 25; i++) id += chars[Math.floor(rng() * chars.length)];
  return id;
}

// Common US town names — used to fill {{TOWN_UPPER}} so generated
// merchants look like real geographically-diverse Plaid output rather
// than collapsing to "westport" everything.
const TOWN_POOL = [
  "Westport", "Stamford", "Norwalk", "Greenwich", "Wilton", "Ridgefield",
  "Fairfield", "Bridgeport", "New Canaan", "Darien", "Trumbull",
  "Brooklyn", "Manhattan", "Queens", "Bronx", "Astoria", "Hoboken",
  "Boston", "Cambridge", "Newton", "Brookline", "Somerville",
  "Chicago", "Evanston", "Oak Park", "Naperville",
  "Austin", "Houston", "Dallas", "San Antonio", "Plano",
  "Denver", "Boulder", "Aurora",
  "Seattle", "Portland", "Bellevue",
  "San Francisco", "Oakland", "Berkeley", "Palo Alto", "San Jose",
  "Los Angeles", "Pasadena", "Santa Monica", "Long Beach",
  "Atlanta", "Decatur", "Marietta",
  "Miami", "Tampa", "Orlando",
  "Philadelphia", "Pittsburgh",
  "Charlotte", "Raleigh", "Durham",
  "Nashville", "Memphis", "Knoxville",
  "Phoenix", "Scottsdale", "Tempe",
];

const STATE_POOL = [
  "CT", "NY", "NJ", "MA", "PA", "VA", "MD", "DC", "FL", "GA", "NC",
  "SC", "TX", "CO", "WA", "OR", "CA", "IL", "OH", "MI", "TN", "AZ",
];

function fillPlaceholders(template: string, rng: () => number): string {
  const first = pick(FIRST_NAMES, rng);
  const last = pick(LAST_NAMES, rng);
  const upper = (s: string) => s.toUpperCase();
  const alphanum = (n: number) => {
    const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let r = "";
    for (let i = 0; i < n; i++) r += c[Math.floor(rng() * c.length)];
    return r;
  };

  const replacements: Array<[RegExp, () => string]> = [
    [/\{\{FIRST_LAST_UPPER\}\}/g, () => upper(`${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`)],
    [/\{\{FIRST_UPPER\}\}/g, () => upper(pick(FIRST_NAMES, rng))],
    [/\{\{LAST_UPPER\}\}/g, () => upper(pick(LAST_NAMES, rng))],
    [/\{\{FIRSTNAME_UPPER\}\}/g, () => upper(pick(FIRST_NAMES, rng))],
    [/\{\{LASTNAME_UPPER\}\}/g, () => upper(pick(LAST_NAMES, rng))],
    [/\{\{FIRST\}\}/g, () => pick(FIRST_NAMES, rng)],
    [/\{\{TOWN_UPPER\}\}/g, () => upper(pick(TOWN_POOL, rng))],
    [/\{\{STATE\}\}/g, () => pick(STATE_POOL, rng)],
    [/\{\{RESTAURANT\}\}/g, () => pick(RESTAURANT_POOL, rng)],
    [/\{\{RETAILER\}\}/g, () => pick(["TARGET", "WALMART", "WHOLE FOODS", "WEGMANS", "TRADER JOES"], rng)],
    [/\{\{NUM2\}\}/g, () => String(randInt(rng, 10, 99))],
    [/\{\{NUM3\}\}/g, () => String(randInt(rng, 100, 999))],
    [/\{\{NUM4\}\}/g, () => String(randInt(rng, 1000, 9999))],
    [/\{\{NUM5\}\}/g, () => String(randInt(rng, 10_000, 99_999))],
    [/\{\{NUM6\}\}/g, () => String(randInt(rng, 100_000, 999_999))],
    [/\{\{NUM7\}\}/g, () => String(randInt(rng, 1_000_000, 9_999_999))],
    [/\{\{NUM10\}\}/g, () => String(randInt(rng, 1_000_000_000, 9_999_999_999))],
    [/\{\{ALPHA8\}\}/g, () => alphanum(8)],
    [/\{\{ALPHANUM6\}\}/g, () => alphanum(6)],
    [/\{\{ALPHANUM10\}\}/g, () => alphanum(10)],
    [/\{\{NANNY_LABEL\}\}/g, () => pick(["NANNY", "BABYSITTER", "TUTOR", "HOUSEKEEPER"], rng)],
  ];
  let out = template;
  for (const [re, fn] of replacements) {
    out = out.replace(re, fn);
  }
  // Use first/last in any plain {{NAME}} variant
  out = out.replace(/\{\{NAME\}\}/g, `${first} ${last}`);
  return out;
}

function visitsForPattern(rng: () => number, p: Seed["visit_pattern"]): number {
  switch (p) {
    case "recurring": return randInt(rng, 3, 12);
    case "occasional": return randInt(rng, 1, 3);
    case "one-off":
    default: return 1;
  }
}

export type FixtureBatch = {
  seed: number;
  txs: LabeledTx[];
  /** Counts by truth bucket so eval can sanity-check distribution. */
  stats: { total: number; healthcare_tx: number; non_healthcare_tx: number; ambiguous_tx: number };
};

export function makeFixtureBatch(opts: {
  size?: number;
  seed?: number;
  /** Target % of TX (not unique merchants) that are truth=healthcare. */
  healthcareRatio?: number;
  /** Target % of TX that are AMBIGUOUS (still healthcare=true but should
   *  end up review_needed/medium-confidence). */
  ambiguousRatio?: number;
} = {}): FixtureBatch {
  const size = opts.size ?? 2000;
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const healthcareRatio = opts.healthcareRatio ?? 0.10;
  const ambiguousRatio = opts.ambiguousRatio ?? 0.04;

  const rng = makeRng(seed);

  const txs: LabeledTx[] = [];
  let healthcareCount = 0;
  let ambiguousCount = 0;
  let nonHealthcareCount = 0;

  // Healthcare seeds split between REAL (real-data formats) and EDGE (curated tricky cases)
  const healthcareSeeds = [
    ...REAL_SEEDS.filter(s => s.truth.is_healthcare),
    ...EDGE_CASES.filter(s => s.truth.is_healthcare),
  ];
  const nonHealthcareSeeds = [
    ...REAL_SEEDS.filter(s => !s.truth.is_healthcare),
    ...EDGE_CASES.filter(s => !s.truth.is_healthcare),
  ];

  // Build until we hit `size` transactions. Each "merchant pick" emits
  // visit_count transactions (so a recurring therapist contributes
  // multiple txs from one seed pick).
  while (txs.length < size) {
    const remaining = size - txs.length;
    const r = rng();

    let seedToUse: Seed;
    let isAmbiguous = false;
    if (r < healthcareRatio) {
      // Healthcare slot
      if (rng() < ambiguousRatio / healthcareRatio) {
        seedToUse = pick(AMBIGUOUS_HEALTHCARE, rng);
        isAmbiguous = true;
      } else {
        seedToUse = pick(healthcareSeeds, rng);
      }
    } else {
      seedToUse = pick(nonHealthcareSeeds, rng);
    }

    // Resolve placeholders ONCE per merchant pick — all visits should
    // have the same canonical name (so the registry rolls them up).
    const resolved = fillPlaceholders(seedToUse.template, rng);
    const visitCount = Math.min(visitsForPattern(rng, seedToUse.visit_pattern), remaining);

    for (let i = 0; i < visitCount; i++) {
      const amount = randAmount(rng, seedToUse.amount_range);
      const date = randDateInLast12mo(rng);
      txs.push({
        tx: {
          transaction_id: txId(rng),
          name: resolved,
          // Plaid sometimes provides a cleaner merchant_name; mimic that ~40% of the time
          merchant_name: rng() < 0.4 ? resolved.replace(/\s{2,}/g, " ").trim() : null,
          amount,
          date,
          category: seedToUse.category ?? null,
        },
        truth: {
          ...seedToUse.truth,
          canonical_name: resolved,
          tag: seedToUse.tag,
        },
      });
      if (seedToUse.truth.is_healthcare) {
        healthcareCount++;
        if (isAmbiguous) ambiguousCount++;
      } else {
        nonHealthcareCount++;
      }
    }
  }

  return {
    seed,
    txs: txs.slice(0, size),
    stats: {
      total: txs.length,
      healthcare_tx: healthcareCount,
      non_healthcare_tx: nonHealthcareCount,
      ambiguous_tx: ambiguousCount,
    },
  };
}

/**
 * Universe-based fixture batch — samples from the broad merchant
 * universe (every category of US consumer spending). Use this to
 * stress the classifier against the long tail; the canonical
 * makeFixtureBatch above samples from the smaller hand-curated seed
 * pool and is better for fast regression checks.
 */
export function makeUniverseFixtureBatch(opts: {
  size?: number;
  seed?: number;
} = {}): FixtureBatch {
  const size = opts.size ?? 3000;
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(seed);

  // Lazy-import to avoid circular dep at top of file.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { UNIVERSE } = require("./universe") as { UNIVERSE: Seed[] };

  const txs: LabeledTx[] = [];
  let healthcareCount = 0;
  let nonHealthcareCount = 0;

  while (txs.length < size) {
    const remaining = size - txs.length;
    const seedToUse = pick(UNIVERSE, rng);
    const resolved = fillPlaceholders(seedToUse.template, rng);
    const visitCount = Math.min(
      visitsForPattern(rng, seedToUse.visit_pattern),
      remaining
    );
    for (let i = 0; i < visitCount; i++) {
      const amount = randAmount(rng, seedToUse.amount_range);
      const date = randDateInLast12mo(rng);
      txs.push({
        tx: {
          transaction_id: txId(rng),
          name: resolved,
          merchant_name: rng() < 0.4 ? resolved.replace(/\s{2,}/g, " ").trim() : null,
          amount,
          date,
          category: seedToUse.category ?? null,
        },
        truth: {
          ...seedToUse.truth,
          canonical_name: resolved,
          tag: seedToUse.tag,
        },
      });
      if (seedToUse.truth.is_healthcare) healthcareCount++;
      else nonHealthcareCount++;
    }
  }

  return {
    seed,
    txs: txs.slice(0, size),
    stats: {
      total: txs.length,
      healthcare_tx: healthcareCount,
      non_healthcare_tx: nonHealthcareCount,
      ambiguous_tx: 0,
    },
  };
}

/** Roll labeled transactions up to ground-truth providers, mirroring
 *  what buildProviderRegistry does on the classifier side. Used by
 *  the eval harness to compare provider-level accuracy. */
export function truthProvidersFromBatch(batch: FixtureBatch): Array<{
  canonical_name: string;
  is_healthcare: boolean;
  expected_provider_type: string | null;
  visit_count: number;
  tag: string | undefined;
}> {
  const map = new Map<string, { is_healthcare: boolean; expected_provider_type: string | null; visit_count: number; tag: string | undefined }>();
  for (const row of batch.txs) {
    const key = row.truth.canonical_name.toUpperCase().trim();
    const e = map.get(key);
    if (e) {
      e.visit_count++;
    } else {
      map.set(key, {
        is_healthcare: row.truth.is_healthcare,
        expected_provider_type: row.truth.expected_provider_type ?? null,
        visit_count: 1,
        tag: row.truth.tag,
      });
    }
  }
  return Array.from(map.entries()).map(([canonical_name, v]) => ({ canonical_name, ...v }));
}
