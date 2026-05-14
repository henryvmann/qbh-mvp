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

  // Step 0: Look up the oracle (intended date + scenario) written by
  // test-loop before the call started. Used to grade date_accuracy
  // separately from behavior. Best-effort — if the table or row is
  // missing, fall through to plain rubric-only grading.
  let oracle:
    | {
        vapi_call_id: string;
        scenario: string;
        date_pattern: string | null;
        intended_iso: string | null;
        intended_phrase: string | null;
        is_regression: boolean;
        attempt_id: string | null;
      }
    | null = null;
  try {
    // First try matching by vapi_call_id (the canonical key). If the
    // webhook passed an "attempt-N" sentinel instead (which it does
    // when triggered from the auto-analyze path), fall back to
    // matching by attempt_id. Without this fallback the lookup
    // silently fails on every webhook-triggered grade and
    // date_accuracy stays ungraded.
    const { data: byVapi } = await supabaseAdmin
      .from("call_test_oracles")
      .select("vapi_call_id, scenario, date_pattern, intended_iso, intended_phrase, is_regression, attempt_id")
      .eq("vapi_call_id", callId)
      .maybeSingle();
    if (byVapi) {
      oracle = byVapi;
    } else if (typeof callId === "string" && callId.startsWith("attempt-")) {
      const attemptId = callId.slice("attempt-".length);
      const { data: byAttempt } = await supabaseAdmin
        .from("call_test_oracles")
        .select("vapi_call_id, scenario, date_pattern, intended_iso, intended_phrase, is_regression, attempt_id")
        .eq("attempt_id", attemptId)
        .maybeSingle();
      if (byAttempt) oracle = byAttempt;
    }
  } catch (oracleErr) {
    console.error("[test-analyze] oracle lookup failed:", oracleErr);
  }

  // Step 0.5: If we have an oracle and an attempt_id, look up what
  // calendar_event actually got booked. Three-way comparison
  // (intended vs transcript vs booked) catches the failure mode that
  // the Caroline Andrew bug landed in: transcript said "the 28th",
  // calendar_event landed on the 14th.
  let bookedIso: string | null = null;
  if (oracle?.attempt_id) {
    try {
      const { data } = await supabaseAdmin
        .from("calendar_events")
        .select("start_at")
        .eq("attempt_id", Number(oracle.attempt_id))
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.start_at) bookedIso = data.start_at;
    } catch {}
  }

  // Compute date_accuracy deterministically (same calendar day in ET).
  // We don't compare exact times because the receptionist sometimes
  // drifts a few minutes between offer and confirm. The day is what
  // breaks user trust.
  function sameDay(a: string | null, b: string | null): boolean {
    if (!a || !b) return false;
    return new Date(a).toISOString().slice(0, 10) ===
      new Date(b).toISOString().slice(0, 10);
  }
  // For "refusal" patterns, the IDEAL outcome is that Kate does NOT
  // book. So "no booking landed" is a PASS, not a fail. Patterns where
  // Kate should push back (past date, wrong-day-of-week assertion) are
  // listed here; everything else expects a matching booking.
  const REFUSAL_PATTERNS = new Set(["passed_date", "dow_dom_mismatch"]);
  const expectsRefusal = oracle?.date_pattern
    ? REFUSAL_PATTERNS.has(oracle.date_pattern)
    : false;

  // Did Sandra actually speak the scripted date phrase? Edge cases
  // (frustrated_repeat_caller, outstanding_balance, wrong_specialty,
  // walk_in_only, restricted_slots, etc.) frequently override the
  // date pattern entirely — Sandra runs the edge case instead of
  // offering the scripted slot, so the date pattern never gets
  // tested. We detect this by scanning the transcript for fragments
  // of the intended phrase. If none appear, the date pattern didn't
  // run and date_accuracy is N/A (skip the deterministic check;
  // grade behavior only).
  function patternRanInTranscript(): boolean {
    if (!oracle?.intended_iso || !transcript) return false;
    const d = new Date(oracle.intended_iso);
    if (Number.isNaN(d.getTime())) return false;
    const dayNum = d.getDate();
    const month = d.toLocaleString("en-US", { month: "long", timeZone: "America/New_York" });
    const shortMonth = d.toLocaleString("en-US", { month: "short", timeZone: "America/New_York" });
    const ordinalWords = ["", "first","second","third","fourth","fifth","sixth","seventh","eighth","ninth","tenth","eleventh","twelfth","thirteenth","fourteenth","fifteenth","sixteenth","seventeenth","eighteenth","nineteenth","twentieth","twenty[- ]?first","twenty[- ]?second","twenty[- ]?third","twenty[- ]?fourth","twenty[- ]?fifth","twenty[- ]?sixth","twenty[- ]?seventh","twenty[- ]?eighth","twenty[- ]?ninth","thirtieth","thirty[- ]?first"];
    const anchors: string[] = [
      `\\b${dayNum}(st|nd|rd|th)?\\b`,
      `\\b${month}\\b`,
      `\\b${shortMonth}\\b`,
    ];
    if (ordinalWords[dayNum]) anchors.push(`\\b${ordinalWords[dayNum]}\\b`);
    // For passed_date the receptionist says "last [weekday]" — check
    // for that phrase pattern as anchor.
    const weekday = d.toLocaleString("en-US", { weekday: "long", timeZone: "America/New_York" });
    anchors.push(`\\blast\\s+${weekday}\\b`);
    anchors.push(`\\b${weekday}\\b`);
    const re = new RegExp(anchors.join("|"), "i");
    return re.test(transcript);
  }
  const patternRan = patternRanInTranscript();

  const dateAccuracyComputed: { pass: boolean; note: string; na?: boolean } | null = oracle
    ? !patternRan
      ? {
          pass: true, // N/A — don't hard-fail Kate when the harness didn't actually test the date pattern
          na: true,
          note: `N/A — Sandra's edge case overrode the date pattern. Intended phrase "${oracle.intended_phrase ?? ""}" did not appear in the transcript, so the ${oracle.date_pattern} test did not run on this call. Behavior graded by rubric only.`,
        }
      : expectsRefusal
      ? bookedIso
        ? {
            pass: false,
            note: `Refusal scenario "${oracle.date_pattern}" — Kate should have pushed back, but a booking landed at ${bookedIso.slice(0, 10)}. Phrase: "${oracle.intended_phrase ?? ""}"`,
          }
        : {
            pass: true,
            note: `Refusal scenario "${oracle.date_pattern}" — Kate correctly declined to book. Phrase: "${oracle.intended_phrase ?? ""}"`,
          }
      : bookedIso
        ? {
            pass: sameDay(bookedIso, oracle.intended_iso),
            note: `Intended: ${oracle.intended_iso?.slice(0, 10) ?? "?"} | Booked: ${bookedIso.slice(0, 10)} | Phrase: "${oracle.intended_phrase ?? ""}"`,
          }
        : {
            pass: false,
            note: `No confirmed booking landed; intended ${oracle.intended_iso?.slice(0, 10) ?? "?"} from phrase "${oracle.intended_phrase ?? ""}". Either Kate didn't book, or the booking didn't reach calendar_events.`,
          }
    : null;

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

CRITICAL — IF THE OFFICE HUNG UP FIRST, DO NOT PENALIZE KATE for "not re-engaging" or "not providing a clear next step". When the receptionist abruptly says "goodbye" / "bye" / cuts off after Kate's intro, Kate cannot magically re-open a terminated phone line. Score appropriate_response based on what Kate did with the time she had, not on outcomes she couldn't control. If Kate's only chance was the intro before the office hung up, score 6+ as long as her intro was correct. Do not score graceful_close=false in this case — the call ended ungracefully because of the OFFICE, not Kate.

CRITICAL — RECEPTIONISTS RELENT. This trips the rubric repeatedly. Receptionists routinely state a policy ("speak to patient", "email us", "don't book over the phone") and then ANYWAY offer specific appointment times. If at ANY point in the transcript the office says any of:
  - "Monday at 3 works" / "I have Tuesday at..."
  - "what time works for you?" / "which one works best?"
  - "I can offer you..." / "we have availability on..."
  - "I'll just take your info anyway" / "let me make this work" / "I guess we can go ahead"
…that is EXPLICIT CONSENT to book. Kate accepting an offered time after consent is THE CORRECT BEHAVIOR — not a "forced booking", not "ignoring the office's preference". The initial objection is irrelevant once the office offers times.

DO NOT score no_forced_booking=false or appropriate_response=false in this case. Score 8+ when Kate gracefully acknowledges the policy AND books an offered time. The only "forced booking" failure is when the office refuses to offer ANY times and Kate insists on booking anyway — read the whole transcript first.

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
    "correct_doctor_name": { "pass": true/false, "note": "did Kate use the right doctor name (ignore phonetic transcript drift like Nasonson↔Niesanson↔Nissenson — the speech-to-text frequently mis-spells unusual names; only fail this if Kate clearly said a DIFFERENT person's name or used DDS/MD/Dr. prefixes wrong)?" },
    "date_accuracy": { "pass": true/false, "note": "Did Kate book the date the receptionist actually meant? Compare the receptionist's literal offer in the transcript with what Kate confirmed back. If the receptionist said 'Thursday the 28th' and Kate confirmed back any other date, FAIL. If the receptionist's offer was ambiguous and Kate clarified before committing, PASS. The ORACLE block below (when present) tells you the date the receptionist was scripted to convey." },
    "disambiguation_when_needed": { "pass": true/false, "note": "When the receptionist used ambiguous date phrasing ('this Thursday', 'two Thursdays from now', a wrong day-of-week assertion, a mid-sentence correction, a mumbled time), did Kate ask a CLARIFYING question before committing? PASS = Kate asked 'just to confirm, that's [explicit date]?' or similar. FAIL = Kate accepted silently. N/A only when the receptionist's offer was unambiguous." },
    "care_coordinator_posture": { "pass": true/false, "note": "Did Kate sound like the patient's advocate and operational lead, not another receptionist? PASS signals: representing patient preferences, pushing back on bad slots, surfacing calendar conflicts, taking ownership of the call. FAIL signals: passively accepting whatever's offered, deferring questions she can answer, sounding like an intake form. THIS IS THE PRIMARY POSTURE TEST." }
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
        {
          role: "user",
          content: oracle
            ? `ORACLE (the scenario Sandra was scripted to run):
- Scenario: ${oracle.scenario}
- Date phrasing pattern: ${oracle.date_pattern ?? "none"}
- Sandra was scripted to convey the date: ${oracle.intended_iso ?? "(none)"}
- Sandra was scripted to speak this exact phrase: "${oracle.intended_phrase ?? "(none)"}"
- Booked calendar_event start_at (what actually got written to the DB): ${bookedIso ?? "(no confirmed booking)"}
- Date accuracy (computed deterministically by comparing intended vs booked day): ${dateAccuracyComputed ? (dateAccuracyComputed.pass ? "PASS" : "FAIL") : "unknown"}
- Regression case (pinned, must always pass): ${oracle.is_regression ? "YES — this is the Caroline Andrew replay" : "no"}

When grading date_accuracy, the deterministic computed answer above is authoritative. Mirror it in your rubric output. Use the transcript to explain WHY (did Kate confirm the date verbally? did the receptionist drift? did Kate fail to clarify?).

Transcript:

${transcript}`
            : `Transcript:\n\n${transcript}`,
        },
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

    // Date accuracy is a HARD FAIL gate. If we computed deterministically
    // that the booked date drifted from the intended date, force the
    // rubric line + overall pass=false regardless of what the LLM said.
    // The Caroline Andrew bug shipped to prod because no rubric line
    // checked this; we don't let that happen twice.
    if (dateAccuracyComputed) {
      analysisData.rubric = analysisData.rubric || {};
      analysisData.rubric.date_accuracy = {
        pass: dateAccuracyComputed.pass,
        note: dateAccuracyComputed.note,
        ...(dateAccuracyComputed.na ? { na: true } : {}),
      };
      if (!dateAccuracyComputed.pass) {
        analysisData.pass = false;
        analysisData.issues = Array.isArray(analysisData.issues)
          ? analysisData.issues
          : [];
        analysisData.issues.unshift(
          `DATE_ACCURACY HARD FAIL: ${dateAccuracyComputed.note}`
        );
        // Cap the score so a date-wrong call can never look like a win.
        if (typeof analysisData.score === "number" && analysisData.score > 3) {
          analysisData.score = 3;
        }
      }
    }
    // Surface oracle metadata in the saved analysis so we can group
    // results by date_pattern / regression in dashboards later.
    if (oracle) {
      analysisData.oracle = {
        scenario: oracle.scenario,
        date_pattern: oracle.date_pattern,
        intended_iso: oracle.intended_iso,
        intended_phrase: oracle.intended_phrase,
        booked_iso: bookedIso,
        is_regression: oracle.is_regression,
      };
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
