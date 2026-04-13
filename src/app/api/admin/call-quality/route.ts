export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "../../../../lib/supabase-server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type CallScorecard = {
  attempt_id: number;
  overall_score: number;
  scores: {
    opening: number;
    info_handling: number;
    patient_status: number;
    objection_handling: number;
    conversation_flow: number;
    outcome: number;
  };
  issues: string[];
  prompt_suggestions: string[];
  call_summary: string;
  booked: boolean;
};

// GET: Fetch scorecards for recent calls
export async function GET() {
  const { data: rawNotes, error } = await supabaseAdmin
    .from("call_notes")
    .select("attempt_id, transcript, summary, booking_summary, follow_up_notes, created_at")
    .not("transcript", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);

  // Deduplicate by attempt_id — keep the one with the longest transcript
  const byAttempt = new Map<number, typeof rawNotes extends (infer T)[] | null ? T : never>();
  for (const note of rawNotes || []) {
    const existing = byAttempt.get(note.attempt_id);
    if (!existing || (note.transcript?.length || 0) > (existing.transcript?.length || 0)) {
      byAttempt.set(note.attempt_id, note);
    }
  }
  const notes = Array.from(byAttempt.values()).slice(0, 20);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Check for existing scorecards
  const attemptIds = (notes || []).map((n) => n.attempt_id).filter(Boolean);
  const { data: existingScorecards } = await supabaseAdmin
    .from("call_scorecards")
    .select("*")
    .in("attempt_id", attemptIds.length > 0 ? attemptIds : [-1]);

  const scorecardMap = new Map((existingScorecards || []).map((s: any) => [s.attempt_id, s]));

  const results = (notes || []).map((note) => ({
    attempt_id: note.attempt_id,
    transcript_preview: (note.transcript || "").slice(0, 200),
    summary: note.summary,
    created_at: note.created_at,
    scorecard: scorecardMap.get(note.attempt_id) || null,
  }));

  return NextResponse.json({ ok: true, calls: results });
}

// POST: Generate scorecard for a specific call
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const attemptId = body.attempt_id;

  if (!attemptId) {
    return NextResponse.json({ ok: false, error: "attempt_id required" }, { status: 400 });
  }

  // Fetch transcript — get the longest one if duplicates exist
  const { data: notes } = await supabaseAdmin
    .from("call_notes")
    .select("attempt_id, transcript, summary")
    .eq("attempt_id", attemptId)
    .order("created_at", { ascending: false })
    .limit(5);

  const note = (notes || [])
    .sort((a, b) => (b.transcript?.length || 0) - (a.transcript?.length || 0))[0];

  if (!note?.transcript || note.transcript.length < 20) {
    return NextResponse.json({ ok: false, error: "No transcript available for this call" }, { status: 404 });
  }

  // Fetch attempt metadata
  const { data: attempt } = await supabaseAdmin
    .from("schedule_attempts")
    .select("metadata, status")
    .eq("id", attemptId)
    .maybeSingle();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: `Analyze this healthcare scheduling call transcript and score it.

TRANSCRIPT:
${note.transcript}

CALL STATUS: ${attempt?.status || "unknown"}
CALL METADATA: ${JSON.stringify(attempt?.metadata || {}).slice(0, 500)}

Score each category 1-5:
1. Opening (1-5): Did Kate use full name? Correct greeting for mode (BOOK vs ADJUST)? Waited for IVR?
2. Info Handling (1-5): Insurance pacing (name first, pause, then ID)? DOB correct? Only gave info when asked?
3. Patient Status (1-5): Correctly identified new/existing? Confident answer?
4. Objection Handling (1-5): Tried to book despite referral/insurance issues? Gathered details?
5. Conversation Flow (1-5): Natural pacing? No long silences? Didn't talk over people? Wrapped up cleanly?
6. Outcome (1-5): Booked? If not, gathered useful info? Graceful ending?

Also identify:
- Specific issues (list each problem)
- Prompt improvement suggestions (specific changes to make Kate better)
- Whether an appointment was actually booked (true/false)
- A 1-sentence call summary

Return JSON:
{
  "scores": { "opening": N, "info_handling": N, "patient_status": N, "objection_handling": N, "conversation_flow": N, "outcome": N },
  "overall_score": N (average),
  "issues": ["issue1", "issue2"],
  "prompt_suggestions": ["suggestion1", "suggestion2"],
  "booked": true/false,
  "call_summary": "one sentence"
}`
      }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ ok: false, error: "No analysis generated" }, { status: 500 });
    }

    const scorecard = JSON.parse(content);

    // Store scorecard
    await supabaseAdmin
      .from("call_scorecards")
      .upsert({
        attempt_id: attemptId,
        overall_score: scorecard.overall_score,
        scores: scorecard.scores,
        issues: scorecard.issues,
        prompt_suggestions: scorecard.prompt_suggestions,
        call_summary: scorecard.call_summary,
        booked: scorecard.booked,
        analyzed_at: new Date().toISOString(),
      }, { onConflict: "attempt_id" });

    return NextResponse.json({ ok: true, scorecard });
  } catch (err) {
    console.error("[call-quality] error:", err);
    return NextResponse.json({ ok: false, error: "Analysis failed" }, { status: 500 });
  }
}
