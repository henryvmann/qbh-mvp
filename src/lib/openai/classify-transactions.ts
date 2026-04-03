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
        content: `You are a healthcare transaction classifier. Given a list of merchant names from bank transactions, classify each as healthcare or not.

Healthcare providers include: doctors, dentists, specialists, hospitals, clinics, labs (LabCorp, Quest), pharmacies (CVS, Walgreens, Rite Aid), urgent care, physical therapy, mental health, optometry, chiropractic, radiology/imaging centers, ambulance services, home health, hospice, dialysis, infusion centers, rehabilitation facilities, and health systems (e.g., Northwell, Kaiser, Mount Sinai).

NOT healthcare: restaurants, retail stores, grocery stores, gas stations, gyms/fitness, beauty/salons, insurance companies (paying premiums is not a provider visit), utilities, subscriptions, payroll, transfer apps, automotive, entertainment, education, pet services, or general services.

Edge cases:
- CVS, Walgreens, Rite Aid = healthcare (pharmacy)
- "Wellness" in name could be healthcare OR spa — use context (amount, frequency)
- Insurance premium payments are NOT healthcare providers
- Copay/coinsurance payments TO a provider ARE healthcare
- "Associates" or "Group" alone isn't enough — needs medical context

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
