export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/vapi/test-analyze
 *
 * Receives a call transcript and analyzes it for issues.
 * Can be called manually or from the VAPI webhook on call end.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const transcript = body.transcript || "";
  const callId = body.call_id || `manual-${Date.now()}`;

  if (!transcript.trim()) {
    return NextResponse.json({ ok: false, error: "No transcript provided" }, { status: 400 });
  }

  try {
    // Analyze with Claude/GPT
    const analysis = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 1500,
      messages: [
        {
          role: "system",
          content: `You are a QA analyst reviewing AI voice call transcripts. Kate is an AI care coordinator calling a doctor's office to book appointments. Sandra is a test receptionist AI.

Analyze the transcript and report:

1. **PASS/FAIL**: Did Kate successfully book an appointment?
2. **Issues found**: List each problem (e.g., "Kate asked for the wrong doctor", "Kate didn't follow tool response", "Kate repeated herself")
3. **Prompt changes needed**: Specific wording changes to Kate's system prompt that would fix each issue
4. **Rating**: 1-10 how natural and effective the call was

Be specific and actionable. Reference exact quotes from the transcript.`,
        },
        {
          role: "user",
          content: `Call transcript:\n\n${transcript}`,
        },
      ],
    });

    const analysisText = analysis.choices[0]?.message?.content || "Analysis failed";

    // Save to database
    try {
      await supabaseAdmin.from("call_test_logs").insert({
        call_id: callId,
        transcript,
        analysis: analysisText,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Table might not exist yet — that's ok
      console.log("[test-analyze] Could not save to call_test_logs (table may not exist)");
    }

    return NextResponse.json({
      ok: true,
      callId,
      analysis: analysisText,
    });
  } catch (err) {
    console.error("[test-analyze] error:", err);
    return NextResponse.json({ ok: false, error: "Analysis failed" }, { status: 500 });
  }
}
