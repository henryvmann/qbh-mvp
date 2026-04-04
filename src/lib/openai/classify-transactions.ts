import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type TransactionClassification = {
  merchant_name: string;
  is_healthcare: boolean;
  confidence: "high" | "medium" | "low";
  provider_type: string | null; // e.g., "doctor", "lab", "pharmacy", "hospital", "dentist", "specialist", "urgent_care", "mental_health"
  reasoning: string;
};

type MerchantInput = {
  name: string;
  normalized_name: string;
  plaid_categories: string[];
  visit_count: number;
  avg_amount: number;
};

/**
 * Uses OpenAI to classify a batch of merchants as healthcare or not.
 * Only sends merchant names and transaction metadata — no PII.
 */
export async function classifyTransactionsWithAI(
  merchants: MerchantInput[]
): Promise<Map<string, TransactionClassification>> {
  if (merchants.length === 0) return new Map();

  const merchantList = merchants
    .map(
      (m, i) =>
        `${i + 1}. "${m.name}" (normalized: "${m.normalized_name}", plaid_categories: [${m.plaid_categories.join(", ")}], visits: ${m.visit_count}, avg_amount: $${m.avg_amount.toFixed(2)})`
    )
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a STRICT healthcare transaction classifier. You must be VERY conservative — only classify something as healthcare if you are CERTAIN it is a healthcare provider. When in doubt, classify as NOT healthcare.

HEALTHCARE (classify as true):
- Doctors, dentists, specialists, hospitals, clinics
- Labs: LabCorp, Quest Diagnostics
- Pharmacies: CVS, Walgreens, Rite Aid, Weston Pharmacy, any store with "Pharmacy" in the name
- Urgent care centers
- Physical therapy, occupational therapy
- Mental health providers, therapists, psychologists, psychiatrists
- Optometry, ophthalmology, vision care
- Chiropractic
- Radiology, imaging centers
- Health systems: Northwell, Kaiser, Mount Sinai, etc.
- Ambulance, home health, hospice, dialysis, infusion centers
- Platforms: SimplePractice, TherapyNotes, Headway, Alma, BetterHelp, Talkspace, Psychology Today

DEFINITELY NOT HEALTHCARE (classify as false):
- ANY food/drink business: restaurants, cafes, bakeries, ice cream shops, bars, grocery stores, markets, delis
- Retail stores of ANY kind
- Gas stations, car washes, parking
- Gyms, fitness, yoga, pilates
- Beauty, salons, barbers, spas, nail salons
- Insurance companies and premium payments (paying an insurance bill is NOT a provider visit)
- Utilities, subscriptions, streaming services
- Payroll, transfers, Zelle, Venmo, deposits, withdrawals
- Entertainment, sports facilities, recreation centers
- Education, childcare, nanny payments
- Pet stores, veterinarians (we only track HUMAN healthcare)
- Any store name that is clearly a consumer brand or retail business

CRITICAL RULES:
1. A "market" or "village market" or similar is a GROCERY STORE, not healthcare
2. An ice cream shop is NEVER healthcare, even if transactions are recurring
3. Insurance premium payments (e.g., "William Penn" insurance, "GEICO", "State Farm") are NOT healthcare providers — they are insurance companies
4. If the merchant name sounds like it COULD be a restaurant, store, or consumer business, it is NOT healthcare
5. "Pharmacy" in the name = healthcare. But "Market" or "Store" in the name = NOT healthcare
6. When in doubt, classify as NOT healthcare. We'd rather miss a provider than include a non-provider.

THERAPIST DETECTION:
- Many therapists bill under their personal name (e.g., "Jane Smith").
- If you see payments to a person's name with amounts $100-$500 and 2+ visits, classify as healthcare with MEDIUM confidence (not high)
- But ONLY if the name doesn't clearly belong to another category (nanny, tutor, contractor, etc.)

Respond with JSON: { "classifications": [ { "index": 1, "is_healthcare": true/false, "confidence": "high"/"medium"/"low", "provider_type": "doctor"/"lab"/"pharmacy"/"hospital"/"dentist"/"specialist"/"urgent_care"/"mental_health"/"other_healthcare"/null, "reasoning": "brief explanation" } ] }`,
      },
      {
        role: "user",
        content: `Classify these ${merchants.length} merchants:\n\n${merchantList}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return new Map();

  let parsed: { classifications: Array<{ index: number; is_healthcare: boolean; confidence: string; provider_type: string | null; reasoning: string }> };
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("[classifyTransactionsWithAI] Failed to parse response:", content);
    return new Map();
  }

  const result = new Map<string, TransactionClassification>();

  for (const c of parsed.classifications || []) {
    const merchant = merchants[c.index - 1];
    if (!merchant) continue;

    result.set(merchant.normalized_name, {
      merchant_name: merchant.name,
      is_healthcare: c.is_healthcare,
      confidence: (c.confidence as "high" | "medium" | "low") || "low",
      provider_type: c.provider_type || null,
      reasoning: c.reasoning || "",
    });
  }

  return result;
}
