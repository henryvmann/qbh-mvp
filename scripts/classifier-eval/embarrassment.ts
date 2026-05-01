/**
 * Embarrassment list — merchant strings that the classifier MUST NEVER
 * surface as confident HEALTHCARE. A single false positive on this list
 * is a hard launch-blocker, not a metric to push.
 *
 * The contract is asymmetric vs the golden set: golden tracks F1 and
 * accepts the occasional miss. Embarrassment tolerates ZERO violations.
 *
 * What lives here:
 *   1. Items obviously non-medical that have "health"-adjacent words
 *      and trip naive classifiers (HOA fees, gyms with "health",
 *      retail "wellness" stores).
 *   2. Items that would humiliate the product if surfaced as a doctor
 *      to a real user — pet vets, beverage brands with "Dr.",
 *      insurance carriers, billing platforms.
 *   3. Items that real users would screenshot and post to Twitter.
 */

import type { LabeledTx } from "./generate";

export type EmbarrassmentEntry = {
  name: string;
  merchant_name?: string | null;
  category?: string[];
  visits?: number;
  avg_amount?: number;
  /** Why this absolutely cannot classify as healthcare. */
  why_not: string;
  tag: string;
};

export const EMBARRASSMENT_LIST: EmbarrassmentEntry[] = [
  // HOA / building / housing fees
  {
    name: "WESTPORT HOA QTR FEE",
    avg_amount: 850,
    visits: 4,
    why_not: "Homeowners-association fee. Not a provider.",
    tag: "hoa",
  },
  {
    name: "RIDGEFIELD COMMONS HOA",
    avg_amount: 425,
    visits: 12,
    why_not: "HOA dues.",
    tag: "hoa",
  },
  {
    name: "BILT CARD HOUSING PPD ID: 1844372402",
    avg_amount: 7050,
    visits: 10,
    why_not: "Rent payment via Bilt. Not healthcare.",
    tag: "rent",
  },

  // Gyms with health-y names
  {
    name: "PREMIER HEALTH CLUB",
    avg_amount: 89,
    visits: 12,
    why_not: "Gym, despite 'health' in name.",
    tag: "gym-with-health",
  },
  {
    name: "EQUINOX FITNESS",
    avg_amount: 245,
    visits: 12,
    why_not: "Premium gym chain. Membership, not medical care.",
    tag: "gym",
  },
  {
    name: "SOULCYCLE WEST 22",
    avg_amount: 185,
    visits: 6,
    why_not: "Spin-class chain.",
    tag: "fitness-class",
  },
  {
    name: "BARRY'S BOOTCAMP",
    avg_amount: 38,
    visits: 8,
    why_not: "Fitness chain.",
    tag: "fitness-class",
  },
  {
    name: "PURE BARRE",
    avg_amount: 185,
    visits: 5,
    why_not: "Fitness chain (barre).",
    tag: "fitness-class",
  },

  // Spa / massage / personal care
  {
    name: "MASSAGE ENVY 4827",
    avg_amount: 105,
    visits: 4,
    why_not: "Massage retail chain. Not licensed medical massage therapy.",
    tag: "massage-chain",
  },
  {
    name: "EUROPEAN WAX CENTER",
    avg_amount: 78,
    visits: 3,
    why_not: "Has 'Center' in name; not medical. Waxing.",
    tag: "wellness-confounder",
  },
  {
    name: "SOMA SPA + WELLNESS",
    avg_amount: 165,
    visits: 2,
    why_not: "Day spa. 'Wellness' is a marketing word, not a medical one.",
    tag: "spa",
  },
  {
    name: "MIND BODY STUDIO",
    avg_amount: 95,
    visits: 8,
    why_not: "Yoga studio. 'Mind Body' is wellness-branding, not therapy.",
    tag: "yoga-studio",
  },

  // Retail "wellness" / supplement / vitamin
  {
    name: "DESIGNS FOR HEALTH INC",
    avg_amount: 125,
    visits: 4,
    why_not: "Vitamin / supplement retailer. Not a provider.",
    tag: "supplement-store",
  },
  {
    name: "NOOM INC SUB.NOOM.COM",
    avg_amount: 65,
    visits: 6,
    why_not: "Wellness app subscription. Not a provider relationship.",
    tag: "wellness-app",
  },
  {
    name: "WHOOP MEMBERSHIP",
    avg_amount: 30,
    visits: 12,
    why_not: "Wearable subscription. Not a provider.",
    tag: "wellness-app",
  },

  // Vet / pet
  {
    name: "BANFIELD PET HOSPITAL",
    avg_amount: 245,
    visits: 3,
    why_not: "Pet hospital. We track HUMAN healthcare only.",
    tag: "vet",
  },
  {
    name: "PAW PATROL VETERINARY",
    avg_amount: 165,
    visits: 2,
    why_not: "Veterinary clinic.",
    tag: "vet",
  },
  {
    name: "CHEWY PHARMACY",
    avg_amount: 85,
    visits: 6,
    why_not: "Pet pharmacy. Not for the user.",
    tag: "pet-pharmacy",
  },

  // Insurance carriers (premium / debit, not provider visits)
  {
    name: "LEMONADE INSURANCE",
    category: ["Service", "Insurance"],
    avg_amount: 143,
    visits: 7,
    why_not: "Renters / homeowners insurance. Premium payment.",
    tag: "insurance-non-health",
  },
  {
    name: "WILLIAM PENN PREM DEBIT PPD ID: 3131976260",
    category: ["Service", "Insurance"],
    avg_amount: 48,
    visits: 7,
    why_not: "Insurance premium ACH debit.",
    tag: "insurance-ach",
  },
  {
    name: "GEICO AUTO",
    avg_amount: 145,
    visits: 5,
    why_not: "Auto insurance.",
    tag: "insurance-auto",
  },
  {
    name: "CIGNA HEALTH SVCS",
    avg_amount: 280,
    visits: 4,
    why_not: "Health insurance carrier — paying a premium is not seeing a provider.",
    tag: "insurance-health-payer",
  },
  {
    name: "AETNA HEALTH",
    avg_amount: 350,
    visits: 4,
    why_not: "Health insurance carrier.",
    tag: "insurance-health-payer",
  },

  // Therapy billing platforms (not the therapist)
  {
    name: "ALMA THERAPY",
    avg_amount: 175,
    visits: 3,
    why_not: "Therapy-billing platform. Underlying provider is the real one.",
    tag: "platform-not-provider",
  },
  {
    name: "HEADWAY HEALTH INC",
    avg_amount: 125,
    visits: 2,
    why_not: "Therapy-billing platform; not a provider itself.",
    tag: "platform-not-provider",
  },
  {
    name: "BETTERHELP.COM",
    avg_amount: 80,
    visits: 4,
    why_not: "Online therapy marketplace, billing platform.",
    tag: "platform-not-provider",
  },
  {
    name: "ZOCDOC INC",
    avg_amount: 35,
    visits: 1,
    why_not: "Booking platform fee, not a visit.",
    tag: "platform-not-provider",
  },

  // Doctor-named non-medical brands (provoke false positives)
  {
    name: "DR. PEPPER CO",
    avg_amount: 8,
    visits: 4,
    why_not: "Beverage brand.",
    tag: "doctor-named-non-medical",
  },
  {
    name: "DR SQUATCH HOLDINGS",
    avg_amount: 35,
    visits: 2,
    why_not: "Soap / personal-care brand.",
    tag: "doctor-named-non-medical",
  },
  {
    name: "DR MARTENS RETAIL",
    avg_amount: 165,
    visits: 1,
    why_not: "Footwear retailer.",
    tag: "doctor-named-non-medical",
  },

  // Person-name confounders (Zelle to nanny / contractor / friend)
  {
    name: "ZELLE PAYMENT TO NANCY HARTLEY JPM99CA8CEZV",
    avg_amount: 800,
    visits: 4,
    why_not: "Zelle to a nanny. Recurring high-frequency person-name payment that LOOKS like a therapist but isn't.",
    tag: "zelle-nanny",
  },
  {
    name: "ZELLE PAYMENT TO MIKE TUTOR JPM99C9CL54W",
    avg_amount: 250,
    visits: 8,
    why_not: "Zelle to a tutor. Recurring person-name payment, not medical.",
    tag: "zelle-tutor",
  },
  {
    name: "VENMO",
    avg_amount: 133,
    visits: 7,
    why_not: "Generic Venmo charge — no merchant info, no medical signal.",
    tag: "p2p-generic",
  },

  // Bare LLC / "Practice" without medical signal
  {
    name: "FAMILY PRACTICE LLC",
    avg_amount: 350,
    visits: 2,
    why_not: "No medical signal in name (no MD/DDS/specialty). Could be a law / consulting firm.",
    tag: "ambiguous-llc",
  },

  // Restaurants with "doctor" or "wellness" in name
  {
    name: "DR. SMITH'S CAFE",
    avg_amount: 24,
    visits: 6,
    why_not: "Restaurant / cafe with 'Dr.' branding.",
    tag: "doctor-named-restaurant",
  },
];

export function expandEmbarrassmentList(): LabeledTx[] {
  const out: LabeledTx[] = [];
  let idCounter = 0;
  const baseDate = new Date("2026-04-15T12:00:00Z");
  for (const e of EMBARRASSMENT_LIST) {
    const visits = e.visits ?? 1;
    for (let v = 0; v < visits; v++) {
      const d = new Date(baseDate.getTime());
      d.setDate(d.getDate() - v * 14);
      const date = d.toISOString().slice(0, 10);
      out.push({
        tx: {
          transaction_id: `embarrass-${idCounter++}`,
          name: e.name,
          merchant_name: e.merchant_name ?? null,
          amount: e.avg_amount ?? 50,
          date,
          category: e.category ?? null,
        },
        truth: {
          is_healthcare: false,
          bucket: null,
          expected_provider_type: null,
          canonical_name: e.name,
          tag: e.tag,
          note: e.why_not,
        },
      });
    }
  }
  return out;
}
