export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const KATE_ASSISTANT_ID = "c06f2b9d-bc33-4eaf-9843-4924488c4c00";

/**
 * POST /api/vapi/test-analyze
 * Analyzes a call transcript, scores it, and optionally auto-fixes Kate's prompt.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const transcript = body.transcript || "";
  const callId = body.call_id || `manual-${Date.now()}`;

  if (!transcript.trim()) {
    return NextResponse.json({ ok: false, error: "No transcript" }, { status: 400 });
  }

  try {
    // Step 1: Analyze and score
    const analysis = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `You are a QA analyst for an AI voice calling system. Kate is an AI care coordinator calling doctor's offices to book appointments. Analyze this call transcript.

Return a JSON object (no markdown, just raw JSON) with this exact structure:
{
  "pass": true/false,
  "score": 0-10,
  "rubric": {
    "intro_correct": { "pass": true/false, "note": "brief reason" },
    "accepted_first_time": { "pass": true/false, "note": "did Kate accept the first offered time without asking to repeat?" },
    "followed_tool_response": { "pass": true/false, "note": "did Kate say message_to_say word for word?" },
    "confirmed_before_ending": { "pass": true/false, "note": "did Kate confirm date+time+provider?" },
    "asked_what_to_bring": { "pass": true/false, "note": "did Kate ask about what to bring?" },
    "natural_goodbye": { "pass": true/false, "note": "did Kate say goodbye naturally?" },
    "no_repetition": { "pass": true/false, "note": "did Kate avoid repeating herself?" },
    "correct_doctor_name": { "pass": true/false, "note": "did Kate use the right doctor name, no DDS/MD prefix issues?" }
  },
  "issues": ["issue 1", "issue 2"],
  "prompt_fixes": [
    { "find": "text to find in current prompt", "replace": "text to replace with", "confidence": "high/medium/low", "reason": "why" }
  ],
  "summary": "One paragraph summary of the call quality"
}

Be precise. Only suggest prompt_fixes that are specific text changes, not vague suggestions. Use "high" confidence only when you're certain the fix will help without side effects.`,
        },
        { role: "user", content: `Transcript:\n\n${transcript}` },
      ],
    });

    let analysisData: any = {};
    try {
      const raw = analysis.choices[0]?.message?.content || "{}";
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysisData = JSON.parse(cleaned);
    } catch {
      analysisData = { pass: false, score: 0, summary: analysis.choices[0]?.message?.content || "Parse error", issues: [], prompt_fixes: [] };
    }

    // Step 2: Auto-apply high-confidence prompt fixes
    let appliedFixes: string[] = [];
    if (process.env.AUTO_APPLY_PROMPT_FIXES === "true" && analysisData.prompt_fixes?.length > 0) {
      const vapiKey = process.env.VAPI_API_KEY;
      if (vapiKey) {
        // Fetch current Kate prompt
        const kateRes = await fetch(`https://api.vapi.ai/assistant/${KATE_ASSISTANT_ID}`, {
          headers: { Authorization: `Bearer ${vapiKey}` },
        });
        const kateData = await kateRes.json();
        let currentPrompt = kateData?.model?.messages?.[0]?.content || "";

        for (const fix of analysisData.prompt_fixes) {
          if (fix.confidence === "high" && fix.find && fix.replace && currentPrompt.includes(fix.find)) {
            currentPrompt = currentPrompt.replace(fix.find, fix.replace);
            appliedFixes.push(`${fix.reason}: "${fix.find}" → "${fix.replace}"`);
          }
        }

        if (appliedFixes.length > 0) {
          const updateRes = await fetch(`https://api.vapi.ai/assistant/${KATE_ASSISTANT_ID}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${vapiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: {
                ...kateData.model,
                messages: [{ role: "system", content: currentPrompt }],
              },
            }),
          });

          if (!updateRes.ok) {
            console.error("[test-analyze] Failed to update Kate prompt:", await updateRes.text());
            appliedFixes = [];
          } else {
            console.log(`[test-analyze] Auto-applied ${appliedFixes.length} prompt fixes`);
          }
        }
      }
    }

    // Step 3: Save to database
    try {
      await supabaseAdmin.from("call_test_logs").insert({
        call_id: callId,
        transcript,
        analysis: JSON.stringify(analysisData),
        score: analysisData.score || 0,
      });
    } catch (dbErr) {
      console.error("[test-analyze] DB save failed:", dbErr);
    }

    return NextResponse.json({
      ok: true,
      callId,
      score: analysisData.score,
      pass: analysisData.pass,
      summary: analysisData.summary,
      issues: analysisData.issues,
      appliedFixes,
      rubric: analysisData.rubric,
    });
  } catch (err) {
    console.error("[test-analyze] error:", err);
    return NextResponse.json({ ok: false, error: "Analysis failed" }, { status: 500 });
  }
}
