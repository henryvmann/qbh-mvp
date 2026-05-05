export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { storeHealthDocument } from "../../../lib/aws/s3";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/insurance-eob — upload an EOB (Explanation of Benefits)
 * PDF or image. We store the raw file in S3 under the user's
 * pseudonymized key, run GPT-4o vision extraction, generate a
 * plain-English summary in Kate's voice, and persist the structured
 * row in insurance_eobs.
 *
 * GET /api/insurance-eob — list all EOBs for the current user.
 */

const EXTRACTION_PROMPT = `Extract the following fields from this Explanation of Benefits (EOB) document. Return ONLY valid JSON with these exact keys (use null for missing fields). If the document contains MULTIPLE claims/dates, extract the most recent one.

{
  "payer": "insurance company name",
  "claim_number": "claim or reference number",
  "date_of_service": "service date in YYYY-MM-DD",
  "provider_name": "name of the doctor or facility",
  "billed_amount": "total amount the provider billed (number only)",
  "allowed_amount": "amount your plan allowed (number only, may equal billed if PPO in-network)",
  "plan_paid": "amount your plan paid (number only)",
  "patient_owes": "amount you owe / patient responsibility (number only)",
  "deductible_applied": "amount applied to deductible (number only)",
  "copay": "copay amount (number only)",
  "coinsurance": "coinsurance amount (number only)",
  "status": "Paid | Denied | In review | Processed | Appealed",
  "denial_reason": "if denied, the stated reason"
}

Be precise. Use null for missing values. Do not infer.`;

const KATE_EXPLANATION_PROMPT = `You are Kate, a calm and direct healthcare assistant. The user uploaded an Explanation of Benefits document. Given the structured data below, write a 2-3 sentence plain-English summary that explains what happened and what (if anything) the user needs to do next. No medical jargon. No insurance jargon — translate terms like "allowed amount" or "coinsurance" into simple language.

Don't be cheerful or overly warm. Just be clear. Lead with the bottom line: what they owe, why, and any action.

Data: {{DATA}}

Summary:`;

type EOBExtraction = {
  payer?: string | null;
  claim_number?: string | null;
  date_of_service?: string | null;
  provider_name?: string | null;
  billed_amount?: number | null;
  allowed_amount?: number | null;
  plan_paid?: number | null;
  patient_owes?: number | null;
  deductible_applied?: number | null;
  copay?: number | null;
  coinsurance?: number | null;
  status?: string | null;
  denial_reason?: string | null;
};

async function generateKateExplanation(extracted: EOBExtraction): Promise<string> {
  try {
    const prompt = KATE_EXPLANATION_PROMPT.replace(
      "{{DATA}}",
      JSON.stringify(extracted, null, 2)
    );
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const s3Key = await storeHealthDocument(
    appUserId,
    buf,
    file.name || "eob.pdf",
    file.type || "application/pdf",
    "upload"
  );

  // GPT-4o vision handles both image formats and PDFs (with vision-
  // capable models, PDFs are passed as image_url with the data:URI
  // mimetype set correctly).
  let extracted: EOBExtraction = {};
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${file.type};base64,${buf.toString("base64")}` },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    extracted = JSON.parse(text);
  } catch (err) {
    console.error("[insurance-eob] extraction error", err);
    // Still save the row — user can re-upload or we can re-process later
    extracted = {};
  }

  const explanation = Object.keys(extracted).length > 0
    ? await generateKateExplanation(extracted)
    : "";

  // Try to fuzzy-match a provider already on the user's care team.
  let relatedProviderId: string | null = null;
  if (extracted.provider_name) {
    const { data: providers } = await supabaseAdmin
      .from("providers")
      .select("id, name")
      .eq("app_user_id", appUserId)
      .eq("status", "active");
    const norm = extracted.provider_name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
    for (const p of providers ?? []) {
      const pn = p.name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
      if (pn.includes(norm) || norm.includes(pn)) {
        relatedProviderId = p.id;
        break;
      }
    }
  }

  const { data: row, error } = await supabaseAdmin
    .from("insurance_eobs")
    .insert({
      app_user_id: appUserId,
      s3_key: s3Key,
      payer: extracted.payer ?? null,
      claim_number: extracted.claim_number ?? null,
      date_of_service: extracted.date_of_service ?? null,
      provider_name: extracted.provider_name ?? null,
      billed_amount: extracted.billed_amount ?? null,
      allowed_amount: extracted.allowed_amount ?? null,
      plan_paid: extracted.plan_paid ?? null,
      patient_owes: extracted.patient_owes ?? null,
      status: extracted.status ?? null,
      kate_explanation: explanation,
      raw_extraction: extracted,
      related_provider_id: relatedProviderId,
    })
    .select()
    .single();

  if (error) {
    console.error("[insurance-eob] insert error", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eob: row });
}

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("insurance_eobs")
    .select("*")
    .eq("app_user_id", appUserId)
    .order("uploaded_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, eobs: data ?? [] });
}
