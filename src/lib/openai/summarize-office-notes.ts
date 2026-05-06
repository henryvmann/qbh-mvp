// AI-summarize the office side of a Kate↔receptionist call transcript
// into clean, user-facing notes. The webhook used to extract these via
// regex+keyword filtering, which leaked raw verbatim dialogue ("Oh
// hold on, I just wanted to make sure...") into the user's provider
// page as if it were the office's actual instructions. This function
// replaces that with a constrained LLM summarization.
//
// Returns:
//   - office_instructions: short user-facing prose ("Bring photo ID,
//     paperwork sent in advance, arrive 15 min early"), or null if no
//     real instructions surfaced.
//   - follow_up_notes: anything the office asked the patient to do
//     before/after the visit (lab work, fasting, referrals).
// All fields are null when the call had nothing instruction-like in it
// (Sandra's test calls, hold music, abrupt endings, etc.).

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type SummarizedOfficeNotes = {
  office_instructions: string | null;
  follow_up_notes: string | null;
};

export async function summarizeOfficeNotes(
  transcript: string
): Promise<SummarizedOfficeNotes | null> {
  if (!transcript || transcript.trim().length < 30) return null;

  // Trim transcript to a reasonable size — we only need the office
  // (user role) lines to extract instructions, but keeping context
  // helps with disambiguation. Cap at ~6000 chars.
  const trimmed = transcript.length > 6000 ? transcript.slice(-6000) : transcript;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You convert a transcript of a phone call between Kate (an AI calling a doctor's office on a patient's behalf) and the office receptionist into clean, user-facing notes.

Your output renders on the patient's provider page under "Important Notes from Office." It must therefore:
- Be CLEAN PROSE, never raw dialogue.
- Never quote, paraphrase, or summarize anything Kate said. ONLY summarize what the OFFICE conveyed.
- Be written as a third-person summary ("The office asks you to bring photo ID..."), not as direct speech.
- Be concise — under 200 characters when possible.

Return JSON exactly:
{ "office_instructions": "<prose or null>", "follow_up_notes": "<prose or null>" }

office_instructions = visit-prep instructions the office gave for the patient:
- "Bring photo ID and insurance card."
- "Arrive 15 minutes early to fill out paperwork."
- "New patient — mention this at check-in."
- "Office accepts only cash for first visit."

follow_up_notes = things to do BEFORE the next visit:
- "Office requested insurance info be sent ahead of the appointment."
- "Lab results from prior provider needed before visit."

HARD RULES — output null instead if any of these apply:
1. The candidate text is a question. Receptionists don't issue questions to the patient. Questions in the transcript are ALWAYS Kate asking ("Can you spell the patient's name?"). Drop them.
2. The text starts with "I", "I'm", "I want", "I just", "Let me", "Hold on", "Oh", or "Sorry" — these are speaker fillers, not instructions.
3. The text is something Kate would say (referring to herself, asking the office something, requesting clarification).
4. The text describes call mechanics ("doctor retired," "they're not taking new patients," "left a voicemail").
5. The text is a generic confirmation ("see you Tuesday") without instruction content.

If neither field has clean instruction content, return both as null. Empty output is correct and expected — most calls will have nothing for these fields. NEVER fabricate or echo verbatim dialogue.`,
        },
        {
          role: "user",
          content: `Transcript:\n\n${trimmed}`,
        },
      ],
    });

    const content = resp.choices[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const office = typeof parsed.office_instructions === "string" ? parsed.office_instructions.trim() : null;
    const followUp = typeof parsed.follow_up_notes === "string" ? parsed.follow_up_notes.trim() : null;
    return {
      office_instructions: gateOutput(office),
      follow_up_notes: gateOutput(followUp),
    };
  } catch (err) {
    console.error("[summarize-office-notes] failed:", err);
    return null;
  }
}

/**
 * Sanity gate. Even with a strict prompt, the LLM occasionally still
 * returns Kate's verbatim dialogue (questions, hesitations, "let me
 * just"-style fillers). When it does, we'd rather show nothing than
 * leak it onto the user's provider page. Returns null when the text
 * looks like dialogue rather than a real instruction.
 */
function gateOutput(text: string | null): string | null {
  if (!text || text.length < 5) return null;
  const t = text.trim();
  // Questions — receptionists don't issue questions to patients; these
  // are always Kate asking the office something.
  if (t.endsWith("?")) return null;
  // First-person dialogue tells (Kate's own utterances).
  if (/^(i\b|i'm|i'll|i just|let me|hold on|oh\b|sorry\b|um\b|uh\b|wait\b|yeah\b|okay so)/i.test(t)) {
    return null;
  }
  // Quoted dialogue — instructions don't include the office's own
  // quoted speech, that's a transcript artifact.
  if (/^["“]/.test(t)) return null;
  return t;
}
