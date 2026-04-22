export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    let documentText = textContent || "";

    if (file) {
      // Read file content as text
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder().decode(buffer);
      documentText = text;
    }

    if (!documentText.trim()) {
      return NextResponse.json({ ok: false, error: "No content provided" }, { status: 400 });
    }

    // Summarize with GPT-4o
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are a medical document summarizer for Quarterback Health. The user has uploaded a health document. Extract and organize the key information into a structured summary. Include:
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

    // Append to health_history in patient profile
    const { data: userData } = await supabaseAdmin
      .from("app_users")
      .select("patient_profile")
      .eq("id", appUserId)
      .single();

    const profile = (userData?.patient_profile || {}) as Record<string, unknown>;
    const existingHistory = (profile.health_history as string) || "";
    const updatedHistory = existingHistory
      ? `${existingHistory}\n\n--- Uploaded Document Summary (${new Date().toLocaleDateString()}) ---\n${summary}`
      : `--- Uploaded Document Summary (${new Date().toLocaleDateString()}) ---\n${summary}`;

    await supabaseAdmin
      .from("app_users")
      .update({
        patient_profile: { ...profile, health_history: updatedHistory },
      })
      .eq("id", appUserId);

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[health-docs] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to process document" }, { status: 500 });
  }
}
