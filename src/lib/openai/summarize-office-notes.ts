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
          content: `You extract clean, user-facing notes from a transcript of a phone call between Kate (an AI assistant calling a doctor's office on a patient's behalf) and the office receptionist.

Your output is shown to the patient on their provider page as "Important Notes from Office." So it must be:
- Clean prose, not raw dialogue.
- Only the things the office actually told Kate to convey to the patient.
- Concise — under 200 characters total when possible.
- Written FROM Kate's perspective summarizing what the office said.

Return JSON in this EXACT shape:
{
  "office_instructions": "<short prose, or null>",
  "follow_up_notes": "<short prose, or null>"
}

WHAT GOES IN office_instructions:
- "Bring photo ID and insurance card"
- "Arrive 15 minutes early"
- "Office prefers cash payment for new patients"
- "Mention you're a new patient when you check in"
- Visit-prep instructions, what to bring, who to ask for, when to arrive

WHAT GOES IN follow_up_notes:
- "Office asked us to send insurance info ahead of the appointment"
- "They want lab results from prior provider before visit"
- Anything the patient or Kate needs to follow up on before / after the visit

WHAT TO IGNORE (set to null if the call only contained these):
- Receptionist clarifying questions ("hold on, was that for the patient or another person?")
- Hold music, voicemail prompts, abrupt endings, "doctor retired" type info that ended the call
- Kate's own statements
- Anything that's a transcript artifact rather than real instruction
- Generic confirmations like "see you Tuesday" without instruction content

If the call had no real instruction content, return BOTH fields as null. Better to return nothing than fabricate or echo raw dialogue.`,
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
      office_instructions: office && office.length > 0 ? office : null,
      follow_up_notes: followUp && followUp.length > 0 ? followUp : null,
    };
  } catch (err) {
    console.error("[summarize-office-notes] failed:", err);
    return null;
  }
}
