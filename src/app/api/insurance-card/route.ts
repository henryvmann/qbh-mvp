export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { storeHealthDocument } from "../../../lib/aws/s3";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/insurance-card
 *
 * Accepts multipart with `front` and (optional) `back` image files.
 * Stores both in S3 under the user's pseudonymized prefix, runs
 * GPT-4o vision extraction across both images, and merges the
 * extracted fields into patient_profile.
 *
 * Why GPT-4o vision (not Veryfi or Mindee): we already have the
 * OpenAI BAA in place, vision quality on insurance cards is well
 * within frontier-model capability, and per-card cost runs ~$0.02.
 * Phase 1 may swap in a vertical vendor if extraction quality drops
 * below ~95% across our user base.
 */

const EXTRACTION_PROMPT = `Extract the following fields from this insurance card. Return ONLY valid JSON with these exact keys (use null for missing fields):

{
  "carrier": "company name (e.g. 'Aetna', 'United Healthcare', 'Blue Cross Blue Shield')",
  "member_id": "member/subscriber ID exactly as printed",
  "group_number": "group number if present",
  "plan_type": "plan type label (HMO, PPO, EPO, POS, etc.) if printed",
  "rx_bin": "pharmacy BIN if present",
  "rx_pcn": "pharmacy PCN if present",
  "customer_service_phone": "main customer-service phone number, formatted as digits only",
  "copay_pcp": "primary care copay if printed (e.g. '$25')",
  "copay_specialist": "specialist copay if printed",
  "copay_er": "ER copay if printed",
  "deductible": "deductible amount if printed (number only)",
  "effective_date": "effective date if printed (YYYY-MM-DD)"
}

Be precise. If a field is not visible on the card, use null. Do not infer or guess.`;

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

  const front = formData.get("front") as File | null;
  const back = formData.get("back") as File | null;
  if (!front) {
    return NextResponse.json({ ok: false, error: "Missing 'front' image" }, { status: 400 });
  }

  // Store both images in S3 under pseudonymized keys
  const frontBuf = Buffer.from(await front.arrayBuffer());
  const frontKey = await storeHealthDocument(
    appUserId,
    frontBuf,
    front.name || "card-front.jpg",
    front.type || "image/jpeg",
    "upload"
  );

  let backKey: string | null = null;
  let backBuf: Buffer | null = null;
  if (back && back.size > 0) {
    backBuf = Buffer.from(await back.arrayBuffer());
    backKey = await storeHealthDocument(
      appUserId,
      backBuf,
      back.name || "card-back.jpg",
      back.type || "image/jpeg",
      "upload"
    );
  }

  // Build vision prompt. Front + back share one extraction pass so
  // the model can reconcile data that spans both sides (member ID
  // on front, customer service on back, etc.).
  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: EXTRACTION_PROMPT },
    {
      type: "image_url",
      image_url: { url: `data:${front.type};base64,${frontBuf.toString("base64")}` },
    },
  ];
  if (backBuf && back) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${back.type};base64,${backBuf.toString("base64")}` },
    });
  }

  let extracted: Record<string, unknown> = {};
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: userContent }],
      response_format: { type: "json_object" },
      max_tokens: 600,
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    extracted = JSON.parse(text);
  } catch (err) {
    console.error("[insurance-card] extraction error", err);
    return NextResponse.json(
      { ok: false, error: "Couldn't read the card. Try clearer photos." },
      { status: 500 }
    );
  }

  // Merge extracted fields into patient_profile (existing jsonb).
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .maybeSingle();
  const profile = (appUser?.patient_profile ?? {}) as Record<string, unknown>;

  const updates: Record<string, unknown> = {
    insurance_card_front_s3_key: frontKey,
    insurance_card_back_s3_key: backKey,
    insurance_card_uploaded_at: new Date().toISOString(),
  };
  if (extracted.carrier) updates.insurance_provider = extracted.carrier;
  if (extracted.member_id) updates.insurance_member_id = extracted.member_id;
  if (extracted.group_number) updates.insurance_group_number = extracted.group_number;
  if (extracted.plan_type) updates.insurance_plan_type = extracted.plan_type;
  if (extracted.rx_bin) updates.insurance_rx_bin = extracted.rx_bin;
  if (extracted.rx_pcn) updates.insurance_rx_pcn = extracted.rx_pcn;
  if (extracted.customer_service_phone) updates.insurance_customer_service_phone = extracted.customer_service_phone;

  await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: { ...profile, ...updates } })
    .eq("id", appUserId);

  return NextResponse.json({
    ok: true,
    extracted,
    saved_fields: Object.keys(updates),
  });
}
