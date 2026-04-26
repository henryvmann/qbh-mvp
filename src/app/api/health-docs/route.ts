export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { storeHealthDocument } from "../../../lib/aws/s3";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function appendToHistory(appUserId: string, summary: string, providerName: string | null) {
  const { data: userData } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  const profile = (userData?.patient_profile || {}) as Record<string, unknown>;
  const existingHistory = (profile.health_history as string) || "";
  const providerTag = providerName ? ` — ${providerName}` : "";
  const header = `--- Document Summary (${new Date().toLocaleDateString()}${providerTag}) ---`;
  const updatedHistory = existingHistory
    ? `${existingHistory}\n\n${header}\n${summary}`
    : `${header}\n${summary}`;

  await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: { ...profile, health_history: updatedHistory } })
    .eq("id", appUserId);
}

/** Upload a health document (text or file), summarize with AI, persist to profile */
export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const textContent = formData.get("text") as string | null;
    const providerName = formData.get("provider_name") as string | null;

    let documentText = textContent || "";

    if (file) {
      const buffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(buffer);
      const fileName = file.name.toLowerCase();

      // Store original file in S3 (pseudonymized, KMS-encrypted)
      let s3Key: string | undefined;
      try {
        s3Key = await storeHealthDocument(appUserId, fileBuffer, file.name, file.type || "application/octet-stream");
      } catch (s3Err) {
        console.error("[health-docs] S3 upload failed (continuing with summarization):", s3Err);
      }

      if (fileName.endsWith(".pdf")) {
        const base64 = fileBuffer.toString("base64");
        documentText = `[PDF Document: ${file.name}]\nBase64 content (first 10000 chars): ${base64.slice(0, 10000)}`;
      } else if (fileName.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
        const base64 = fileBuffer.toString("base64");
        const mimeType = fileName.endsWith(".png") ? "image/png" : "image/jpeg";

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          temperature: 0.3,
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `This is a health document${providerName ? ` from ${providerName}` : ""}. Extract and summarize all medical information: conditions, medications, procedures, lab results, dates, and follow-up recommendations. Be factual and concise. Do NOT add medical advice.` },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
              ],
            },
          ],
        });

        const summary = response.choices[0]?.message?.content || "Could not read this image.";
        await appendToHistory(appUserId, summary, providerName);
        return NextResponse.json({ ok: true, summary, s3Key });
      } else {
        documentText = new TextDecoder().decode(buffer);
      }
    }

    if (!documentText.trim()) {
      return NextResponse.json({ ok: false, error: "No content provided" }, { status: 400 });
    }

    const providerContext = providerName ? `This document is from ${providerName}. ` : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are a medical document summarizer for Quarterback Health. ${providerContext}The user has uploaded a health document. Extract and organize the key information into a structured summary. Include:
- Conditions/diagnoses mentioned
- Medications listed
- Procedures or surgeries
- Lab results or test findings
- Provider names mentioned
- Dates of care
- Follow-up recommendations

Be factual and concise. Do NOT add medical advice. Just summarize what the document contains.

Return a clear, bullet-pointed summary that the user can review.`,
        },
        {
          role: "user",
          content: `Please summarize this health document:\n\n${documentText.slice(0, 10000)}`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content || "Could not summarize this document.";
    await appendToHistory(appUserId, summary, providerName);
    return NextResponse.json({ ok: true, summary, s3Key: undefined });
  } catch (err) {
    console.error("[health-docs] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to process document" }, { status: 500 });
  }
}
