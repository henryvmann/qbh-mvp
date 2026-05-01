/**
 * Golden set — hand-curated regression fixtures the classifier MUST
 * keep getting right. No randomization, no placeholders, no name pool.
 * Each entry is a single labeled merchant string drawn from the real
 * merchant patterns we've seen in production, plus a few synthetic
 * edge cases that have repeatedly caused failures during Phase 1.
 *
 * Each future change to the classifier (prompt edit, denylist addition,
 * threshold change) must keep the golden-set score from regressing.
 *
 * Format intentionally identical to the fixture-generator's labeled
 * tx so the same eval harness can run it.
 */

import type { LabeledTx } from "./generate";

type GoldenSeed = {
  /** Plaid `name` field — exact string we'd see from Plaid for this merchant. */
  name: string;
  /** Plaid `merchant_name` field — sometimes null, sometimes cleaner. */
  merchant_name?: string | null;
  /** Plaid `category[]` array. */
  category?: string[];
  /** Truth label. */
  is_healthcare: boolean;
  /** Expected provider_type when is_healthcare=true. Null otherwise. */
  expected_provider_type:
    | "doctor" | "dentist" | "mental_health" | "pt"
    | "pharmacy" | "lab" | "vision" | "chiropractic"
    | "specialist" | "hospital" | "urgent_care" | "imaging"
    | null;
  /** Visit count to use when synthesizing the fixture (drives recurring vs one-off heuristics). */
  visits?: number;
  /** Avg amount for this merchant. */
  avg_amount?: number;
  /** Tag explaining why this is in the golden set — useful for failure grouping. */
  tag: string;
  /** Note for human review of failures. */
  note?: string;
};

export const GOLDEN_SEEDS: GoldenSeed[] = [
  // ── Person-name therapists (the Elizabeth Seckler / Megan Nisenson class) ──
  {
    name: "ELIZABETH SECKLER",
    is_healthcare: true,
    expected_provider_type: "mental_health",
    visits: 8,
    avg_amount: 310,
    tag: "person-therapist-real",
    note: "Real licensed therapist found via NPI. Recurring $310 charges.",
  },
  {
    name: "MEGAN NISENSON",
    is_healthcare: true,
    expected_provider_type: "mental_health",
    visits: 6,
    avg_amount: 325,
    tag: "person-therapist-real",
    note: "Real licensed therapist found via NPI. Recurring $325 charges.",
  },
  {
    name: "DR JANE CARTER MD",
    is_healthcare: true,
    expected_provider_type: "doctor",
    visits: 2,
    avg_amount: 350,
    tag: "credentialed-doctor",
  },
  {
    name: "ROBERT HARTLEY LCSW",
    is_healthcare: true,
    expected_provider_type: "mental_health",
    visits: 4,
    avg_amount: 175,
    tag: "credentialed-therapist",
  },
  {
    name: "SAMANTHA KIM PSYD",
    is_healthcare: true,
    expected_provider_type: "mental_health",
    visits: 3,
    avg_amount: 200,
    tag: "credentialed-therapist",
  },

  // ── Pharmacy chains (must NOT be silently dropped by category filter) ──
  {
    name: "CVS",
    merchant_name: "CVS",
    category: ["Shops", "Pharmacy"],
    is_healthcare: true,
    expected_provider_type: "pharmacy",
    visits: 7,
    avg_amount: 35,
    tag: "pharmacy-chain",
    note: "Plaid tags as ['Shops','Pharmacy'] — used to be IGNOREd by 'Shops' rule before pre-filter ordering fix.",
  },
  {
    name: "WALGREENS #4218",
    category: ["Shops", "Pharmacy"],
    is_healthcare: true,
    expected_provider_type: "pharmacy",
    visits: 4,
    avg_amount: 28,
    tag: "pharmacy-chain",
  },
  {
    name: "RITE AID 0327",
    category: ["Shops", "Pharmacy"],
    is_healthcare: true,
    expected_provider_type: "pharmacy",
    visits: 3,
    avg_amount: 22,
    tag: "pharmacy-chain",
  },
  {
    name: "DUANE READE 14102",
    category: ["Shops", "Pharmacy"],
    is_healthcare: true,
    expected_provider_type: "pharmacy",
    visits: 5,
    avg_amount: 18,
    tag: "pharmacy-chain",
  },
  {
    name: "WESTON PHARMACY",
    is_healthcare: true,
    expected_provider_type: "pharmacy",
    visits: 12,
    avg_amount: 45,
    tag: "pharmacy-named",
    note: "Local pharmacy with 'Pharmacy' in the name.",
  },

  // ── Mental health practices ──
  {
    name: "BE WELL MENTAL HEALTH",
    is_healthcare: true,
    expected_provider_type: "mental_health",
    visits: 4,
    avg_amount: 165,
    tag: "named-mental-health-practice",
  },
  {
    name: "WESTPORT MENTAL HEALTH ASSOC",
    is_healthcare: true,
    expected_provider_type: "mental_health",
    visits: 3,
    avg_amount: 210,
    tag: "named-mental-health-practice",
  },

  // ── Specialty clinics ──
  {
    name: "MODERN DERMATOLOGY",
    is_healthcare: true,
    expected_provider_type: "specialist",
    visits: 2,
    avg_amount: 350,
    tag: "specialty-clinic",
  },
  {
    name: "BOSTON CARDIOLOGY ASSOC",
    is_healthcare: true,
    expected_provider_type: "specialist",
    visits: 2,
    avg_amount: 425,
    tag: "specialty-clinic",
  },
  {
    name: "WESTSIDE ORTHOPEDIC SURGERY",
    is_healthcare: true,
    expected_provider_type: "specialist",
    visits: 1,
    avg_amount: 850,
    tag: "specialty-clinic",
  },
  {
    name: "GREENWICH DERMATOLOGY PC",
    is_healthcare: true,
    expected_provider_type: "specialist",
    visits: 2,
    avg_amount: 285,
    tag: "specialty-clinic",
  },

  // ── Pediatrics / primary care ──
  {
    name: "PEDIATRIC ASSOCIATES OF NORWALK",
    is_healthcare: true,
    expected_provider_type: "doctor",
    visits: 5,
    avg_amount: 180,
    tag: "pediatrics",
  },
  {
    name: "ONE MEDICAL",
    is_healthcare: true,
    expected_provider_type: "doctor",
    visits: 2,
    avg_amount: 225,
    tag: "primary-care",
  },
  {
    name: "WILLOWS PEDIATRIC",
    is_healthcare: true,
    expected_provider_type: "doctor",
    visits: 2,
    avg_amount: 195,
    tag: "pediatrics",
  },
  {
    name: "MED*WILLOWS PEDIATRIC",
    is_healthcare: true,
    expected_provider_type: "doctor",
    visits: 2,
    avg_amount: 195,
    tag: "pediatrics-pos-prefix",
    note: "POS prefix variant — same provider, harder for classifier to read.",
  },

  // ── Hospital systems ──
  {
    name: "MOUNT SINAI HEALTH SYSTEM",
    is_healthcare: true,
    expected_provider_type: "hospital",
    visits: 3,
    avg_amount: 1200,
    tag: "hospital-system",
  },
  {
    name: "NORTHWELL HEALTH-NW",
    is_healthcare: true,
    expected_provider_type: "hospital",
    visits: 2,
    avg_amount: 875,
    tag: "hospital-system",
  },

  // ── Labs ──
  {
    name: "QUEST DIAGNOSTICS-9170",
    is_healthcare: true,
    expected_provider_type: "lab",
    visits: 1,
    avg_amount: 145,
    tag: "lab",
  },
  {
    name: "LABCORP/MEDLAB",
    is_healthcare: true,
    expected_provider_type: "lab",
    visits: 2,
    avg_amount: 95,
    tag: "lab",
  },

  // ── Urgent care ──
  {
    name: "CITYMD URGENT CARE - 89TH ST",
    is_healthcare: true,
    expected_provider_type: "urgent_care",
    visits: 2,
    avg_amount: 175,
    tag: "urgent-care",
  },

  // ── Dentists ──
  {
    name: "DR. NAVARRO ORTHODONTIC",
    is_healthcare: true,
    expected_provider_type: "dentist",
    visits: 1,
    avg_amount: 850,
    tag: "ortho-dentist",
  },
  {
    name: "RIDGEFIELD DENTAL ASSOCIATES",
    is_healthcare: true,
    expected_provider_type: "dentist",
    visits: 2,
    avg_amount: 320,
    tag: "named-dental",
  },
  {
    name: "SQ *DR ERIC ECHELMAN DDS",
    is_healthcare: true,
    expected_provider_type: "dentist",
    visits: 2,
    avg_amount: 285,
    tag: "square-pos-dentist",
    note: "Square POS prefix; classifier had trouble parsing 'SQ *' before.",
  },

  // ── Vision ──
  {
    name: "WARBY PARKER",
    is_healthcare: true,
    expected_provider_type: "vision",
    visits: 1,
    avg_amount: 225,
    tag: "vision-retail",
  },
  {
    name: "VISION CNSLTS OF",
    is_healthcare: true,
    expected_provider_type: "vision",
    visits: 2,
    avg_amount: 285,
    tag: "vision-clinic-truncated",
    note: "Real merchant string seen in user data; truncated company name.",
  },

  // ── Physical therapy ──
  {
    name: "JASON MITCHELL DPT PHYSICAL THERAP",
    is_healthcare: true,
    expected_provider_type: "pt",
    visits: 6,
    avg_amount: 165,
    tag: "physical-therapy",
  },

  // ── Insurance carriers (NOT healthcare — premium payments) ──
  {
    name: "LEMONADE INSURANCE",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 7,
    avg_amount: 143,
    tag: "insurance-carrier",
    note: "Real recurring transaction. Classifier MUST not classify as therapist.",
  },
  {
    name: "WILLIAM PENN PREM DEBIT PPD ID: 3131976260",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 7,
    avg_amount: 48,
    tag: "insurance-ach",
  },
  {
    name: "GEICO AUTO",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 5,
    avg_amount: 145,
    tag: "insurance-auto",
  },
  {
    name: "CIGNA HEALTH SVCS",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 4,
    avg_amount: 280,
    tag: "insurance-health-payer",
    note: "'Cigna' has 'health' in our denylist context — must stay denied.",
  },

  // ── Therapy billing platforms (NOT the provider themselves) ──
  {
    name: "ALMA THERAPY",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 3,
    avg_amount: 175,
    tag: "platform-not-provider",
  },
  {
    name: "HEADWAY HEALTH INC",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 2,
    avg_amount: 125,
    tag: "platform-not-provider",
  },
  {
    name: "BETTERHELP.COM",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 4,
    avg_amount: 80,
    tag: "platform-not-provider",
  },

  // ── Ambiguous LLC / "Practice" names (must classify NOT or REVIEW) ──
  {
    name: "FAMILY PRACTICE LLC",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 2,
    avg_amount: 350,
    tag: "ambiguous-llc",
    note: "Could be law / consulting / medical. No medical-signal in name → must NOT confidently classify as doctor.",
  },
  {
    name: "WESTSIDE PRACTICE GROUP",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 1,
    avg_amount: 225,
    tag: "ambiguous-llc",
  },
  {
    name: "PREMIER OFFICE LLC",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 2,
    avg_amount: 425,
    tag: "ambiguous-llc",
  },

  // ── Wellness confounders (must NOT classify as healthcare) ──
  {
    name: "WELLNESS CENTER OF BOSTON",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 2,
    avg_amount: 110,
    tag: "wellness-confounder",
    note: "Spa / yoga, not provider.",
  },
  {
    name: "PREMIER HEALTH CLUB",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 12,
    avg_amount: 89,
    tag: "gym-with-health",
  },
  {
    name: "MIND BODY STUDIO",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 8,
    avg_amount: 95,
    tag: "yoga-studio",
  },
  {
    name: "SOULCYCLE WEST 22",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 6,
    avg_amount: 185,
    tag: "fitness-class",
  },
  {
    name: "EQUINOX FITNESS",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 12,
    avg_amount: 245,
    tag: "gym",
  },
  {
    name: "MASSAGE ENVY 4827",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 4,
    avg_amount: 105,
    tag: "massage-chain",
  },
  {
    name: "EUROPEAN WAX CENTER",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 3,
    avg_amount: 78,
    tag: "wellness-confounder",
  },

  // ── Pet / vet (NOT human healthcare) ──
  {
    name: "BANFIELD PET HOSPITAL",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 3,
    avg_amount: 245,
    tag: "vet",
    note: "Has 'Hospital' in name; must NOT classify (we only track HUMAN healthcare).",
  },
  {
    name: "PAW PATROL VETERINARY",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 2,
    avg_amount: 165,
    tag: "vet",
  },

  // ── Wellness products (NOT providers) ──
  {
    name: "NOOM INC SUB.NOOM.COM",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 6,
    avg_amount: 65,
    tag: "wellness-app",
  },
  {
    name: "DESIGNS FOR HEALTH INC",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 4,
    avg_amount: 125,
    tag: "supplement-store",
    note: "Vitamin / supplement retailer — has 'Health' in name but isn't a provider.",
  },

  // ── Common food / retail / transit decoys ──
  {
    name: "WESTON MARKET",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 14,
    avg_amount: 28,
    tag: "market-confounder",
    note: "Grocery — has 'Market' in name. Real merchant from sample data.",
  },
  {
    name: "VILLAGE MARKET",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 5,
    avg_amount: 167,
    tag: "market-confounder",
  },
  {
    name: "TST*BLUE OWL CAFE",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 3,
    avg_amount: 32,
    tag: "pos-restaurant",
  },
  {
    name: "STARBUCKS STORE 08021",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 10,
    avg_amount: 22,
    tag: "coffee",
  },
  {
    name: "TRADER JOE'S #520",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 13,
    avg_amount: 176,
    tag: "grocery",
  },
  {
    name: "WHOLE FOODS MARKET 10115",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 4,
    avg_amount: 145,
    tag: "grocery",
  },
  {
    name: "EXXONMOBIL  47651226",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 15,
    avg_amount: 16,
    tag: "gas",
  },
  {
    name: "SHELL OIL 5754",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 5,
    avg_amount: 44,
    tag: "gas",
  },
  {
    name: "MTA*MNR ETIX TICKET",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 18,
    avg_amount: 20,
    tag: "transit",
  },

  // ── Person-name decoys (random people, NOT therapists) ──
  {
    name: "ZELLE PAYMENT TO NANCY HARTLEY JPM99CA8CEZV",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 4,
    avg_amount: 800,
    tag: "zelle-nanny",
    note: "Zelle to nanny — recurring, person name. Must NOT classify as therapist.",
  },
  {
    name: "CAROL JENKINS",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 1,
    avg_amount: 45,
    tag: "person-non-therapist",
    note: "Single $45 charge to a person name. Could be friend / contractor / one-off; not a recurring provider relationship.",
  },

  // ── Bank fees / transfers / subscriptions ──
  {
    name: "MONTHLY SERVICE FEE",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 12,
    avg_amount: 5,
    tag: "bank-fee",
  },
  {
    name: "LATE FEE",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 9,
    avg_amount: 40,
    tag: "bank-fee",
  },
  {
    name: "ONLINE TRANSFER FROM CHK ...7893 TRANSACTION#: 28543493673",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 7,
    avg_amount: -7000,
    tag: "transfer",
  },
  {
    name: "BILT CARD HOUSING PPD ID: 1844372402",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 10,
    avg_amount: 7050,
    tag: "rent",
  },
  {
    name: "APPLE.COM/BILL",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 50,
    avg_amount: 13,
    tag: "subscription",
  },
  {
    name: "EVERSOURCE WEB_PAY PPD ID: 3020181050",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 7,
    avg_amount: 208,
    tag: "utilities",
  },
  {
    name: "SPOTIFY",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 7,
    avg_amount: 21,
    tag: "subscription",
  },

  // ── Salon / personal-care decoys ──
  {
    name: "CAMORO SALON",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 5,
    avg_amount: 213,
    tag: "salon",
  },
  {
    name: "SHARKEYS CUTS FOR KIDS -",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 6,
    avg_amount: 48,
    tag: "salon",
  },

  // ── Doctor-named non-medical (provoking false positives) ──
  {
    name: "DR. PEPPER CO",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 1,
    avg_amount: 8,
    tag: "doctor-named-non-medical",
    note: "Has 'DR' prefix but obviously a beverage company.",
  },
  {
    name: "DR SQUATCH HOLDINGS",
    is_healthcare: false,
    expected_provider_type: null,
    visits: 2,
    avg_amount: 35,
    tag: "doctor-named-non-medical",
    note: "Soap / personal care brand.",
  },
];

/**
 * Convert a GoldenSeed into the LabeledTx[] shape (one row per visit)
 * so we can feed it through the same eval scoring path.
 */
export function expandGoldenSet(): LabeledTx[] {
  const out: LabeledTx[] = [];
  let idCounter = 0;
  // Stable date — we don't need recency randomization for the regression
  // suite; classifier behavior shouldn't depend on the calendar date.
  const baseDate = new Date("2026-04-15T12:00:00Z");
  for (const seed of GOLDEN_SEEDS) {
    const visits = seed.visits ?? 1;
    for (let v = 0; v < visits; v++) {
      const d = new Date(baseDate.getTime());
      d.setDate(d.getDate() - v * 14); // 2-week spacing per visit
      const date = d.toISOString().slice(0, 10);
      const txid = `golden-${idCounter++}`;
      out.push({
        tx: {
          transaction_id: txid,
          name: seed.name,
          merchant_name: seed.merchant_name ?? null,
          amount: seed.avg_amount ?? 50,
          date,
          category: seed.category ?? null,
        },
        truth: {
          is_healthcare: seed.is_healthcare,
          bucket: null,
          expected_provider_type: seed.expected_provider_type,
          canonical_name: seed.name,
          tag: seed.tag,
          note: seed.note,
        },
      });
    }
  }
  return out;
}
