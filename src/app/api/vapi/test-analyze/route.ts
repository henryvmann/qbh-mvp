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

  // Dedupe: if a row for this call_id already exists, return it instead of re-analyzing.
  // VAPI can send multiple terminal webhooks for the same call (status-update with
  // ended status + end-of-call-report); without this guard we'd analyze twice.
  try {
    const { data: existing } = await supabaseAdmin
      .from("call_test_logs")
      .select("id, call_id, score, analysis")
      .eq("call_id", callId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log("[test-analyze] dedupe hit, skipping re-analysis:", callId);
      return NextResponse.json({ ok: true, callId, deduped: true });
    }
  } catch (dedupeErr) {
    console.error("[test-analyze] dedupe check failed:", dedupeErr);
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
          content: `You are a QA analyst for Kate, an AI care coordinator who calls doctor's offices on behalf of patients to schedule appointments, ask about availability, or check in on existing appointments.

CRITICAL: score Kate on whether she handled the situation appropriately, NOT on a fixed checklist. The right outcome depends on what the receptionist actually said and did. Some scenarios SHOULD end without a booking — and Kate is correct to bail. Examples of appropriate non-booking outcomes:
- Office is voicemail only → leave a clear callback message
- Walk-in clinic, no appointments → acknowledge and end politely
- Office refuses to book with an AI → ask if a callback is OK and end politely
- Outstanding balance / payment required first → relay the issue to the patient and end
- Practice is wrong specialty / patient was sent to wrong number → confirm and end politely
- Doctor retired or no longer at practice → ask about alternatives, end if none fit
- Referral required → ask what the office needs and end with a plan
- Office is closing / relocating → confirm next steps and end politely

In each of these, "didn't book" is the CORRECT outcome — score appropriateness, not bookings.

STEP 1 — Identify the scenario in one sentence ("what kind of office/situation was this?").
STEP 2 — Determine the IDEAL outcome for that scenario (booking vs graceful exit vs request follow-up).
STEP 3 — Score Kate on whether her behavior matched that ideal.

Return a JSON object (no markdown, just raw JSON) with this exact structure:
{
  "scenario": "one-sentence description of what the receptionist threw at Kate",
  "ideal_outcome": "one-sentence description of what a great human care coordinator would have done",
  "actual_outcome": "one-sentence description of what Kate actually did",
  "pass": true/false,
  "score": 0-10,
  "rubric": {
    "identified_situation": { "pass": true/false, "note": "did Kate correctly understand what the office was telling her?" },
    "appropriate_response": { "pass": true/false, "note": "given the scenario, did Kate take the right next step (book / ask follow-up / end politely)?" },
    "tool_use_correct": { "pass": true/false, "note": "did Kate call the right tools at the right time, or skip them appropriately when no booking was possible?" },
    "natural_voice": { "pass": true/false, "note": "did Kate sound like a real care coordinator — warm, concise, not robotic? Paraphrasing tool messages naturally is FINE." },
    "no_forced_booking": { "pass": true/false, "note": "did Kate AVOID pushing for a booking when the scenario clearly didn't allow one (walk-in only, voicemail, balance owed, etc.)?" },
    "patient_info_protected": { "pass": true/false, "note": "did Kate share only the info that was actually requested? Didn't leak DOB/insurance/SSN unnecessarily?" },
    "graceful_close": { "pass": true/false, "note": "did Kate end the call politely with a clear next step (booked / will call back / message left)?" },
    "correct_doctor_name": { "pass": true/false, "note": "did Kate use the right doctor name (ignore phonetic transcript drift like Nasonson↔Niesanson↔Nissenson — the speech-to-text frequently mis-spells unusual names; only fail this if Kate clearly said a DIFFERENT person's name or used DDS/MD/Dr. prefixes wrong)?" }
  },
  "issues": ["specific things Kate did wrong, given the scenario"],
  "wins": ["specific things Kate did well, given the scenario"],
  "prompt_fixes": [
    { "find": "exact text from Kate's prompt to find", "replace": "exact replacement text", "confidence": "high/medium/low", "reason": "why this fix is needed" }
  ],
  "summary": "One paragraph summary of the call quality."
}

GUIDANCE FOR PROMPT FIXES — be conservative:
- Only suggest "high" confidence when the fix is specific, would not break behavior on OTHER scenarios, and addresses a clear root cause.
- Do NOT suggest fixes that would push Kate to book in scenarios where booking is wrong.
- Do NOT suggest fixes that would force Kate to recite tool messages verbatim — natural paraphrasing is correct.
- Do NOT suggest fixes that punish Kate for asking clarifying questions when the office was unclear.
- If Kate handled the call well, return prompt_fixes: [].

Score 9-10 = handled an edge case excellently. Score 7-8 = solid, minor wobble. Score 5-6 = correct outcome but rough execution. Score 3-4 = wrong outcome or significant issues. Score 0-2 = catastrophic.`,
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

    // Step 2: Auto-apply high-confidence prompt fixes.
    // Gated on AUTO_APPLY_PROMPT_FIXES=true AND the rubric being explicitly
    // marked as calibrated (RUBRIC_CALIBRATED=true). The rubric was rewritten
    // to be scenario-aware and could still produce bad fixes during the
    // calibration window — keep auto-apply OFF until we're confident.
    let appliedFixes: string[] = [];
    const autoApplyEnabled =
      process.env.AUTO_APPLY_PROMPT_FIXES === "true" &&
      process.env.RUBRIC_CALIBRATED === "true";
    if (autoApplyEnabled && analysisData.prompt_fixes?.length > 0) {
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
      const { error: insertError } = await supabaseAdmin.from("call_test_logs").insert({
        call_id: callId,
        transcript,
        analysis: JSON.stringify(analysisData),
        score: analysisData.score || 0,
      });
      if (insertError) {
        console.error("[test-analyze] DB insert error:", insertError);
      } else {
        console.log("[test-analyze] saved to call_test_logs:", { callId, score: analysisData.score });
      }
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
