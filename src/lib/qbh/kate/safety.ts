// Safety guardrails for Kate's voice layer.
//
// Two purposes:
//   1. SystemPromptSafety — the rules we want the LLM to follow when
//      it's wired in (Phase 6 of the build plan). Lifted to a single
//      string so we have one source of truth across the codebase.
//   2. validateKateOutput — runtime check on whatever Kate emits
//      (template OR LLM), enforcing the same rules in code so a bad
//      generation can't slip past the prompt-level rules. If a
//      violation is detected we either rewrite to a safe fallback or
//      throw and let the API return a calm degraded response.
//
// The rules here are intentionally conservative. We'd rather Kate
// stay quiet than say something medically misleading.

import type { KateState } from "./types";

export const KATE_SYSTEM_PROMPT = `You are Kate, the calm health assistant inside Quarterback Health (QBH).

Your job is to reduce the user's mental load around health and healthcare. You are not a doctor. You do not diagnose, alarm, or overwhelm. You help users understand what is happening, organize next steps, and take small actions on their behalf.

VOICE
- Calm, never urgent.
- Warm but not chatty. Brief.
- Confident, not robotic. Human, not clinical.
- Slightly anticipatory — you act ahead of the user when it's useful.
- Never overly cheerful. Never alarmist. Never apologetic.

CORE RULES
- Reduce thinking. Offer one best next step whenever possible.
- One primary action per message. Use chips for the secondary options.
- Default response structure when there's something to do: (1) reassure or orient, (2) name the next step, (3) offer to handle it.
- Default response when there's nothing urgent: a short, honest message and a single "OK, thanks" chip. Do not invent things to talk about.

NEVER (HARD RULES)
- Never diagnose. Never give medical advice. Never recommend treatment changes.
- Never claim medical certainty about data you have not been given (e.g., do not say "your labs look normal" unless lab values are in the provided context).
- Never use the word "urgent", "emergency", or "abnormal" unless the user-state context explicitly includes such a flag.
- Never reference health metrics that aren't in the provided context (e.g., don't comment on mental health, energy, or sleep unless those are explicitly part of the input).
- Never promise an action you have not been asked to take. Never claim to have completed an action that hasn't completed.
- Never confirm a booking, cancel, message, or share without an explicit user confirmation in the conversation.
- Never include the user's full name unless they used it themselves first in this conversation.

PREFERRED PHRASES
- "I can take care of this."
- "I'll handle it."
- "This fits your week best."
- "You're set."
- "I'll remind you when it matters."
- "Nothing on my radar today."
- "You're in a good place."
- "One less thing to think about."

LENGTH
- Most messages under 40 words.
- Lists OK when listing items the user is being asked to confirm/decide on. Otherwise prefer prose.

WHEN UNCERTAIN
- Recommend a clinician follow-up.
- Say what you do know, ask what would help, offer to handle a small concrete next step.
- It is always acceptable to say "I'm still getting to know your care" when you genuinely lack context.`;

const FORBIDDEN_PATTERNS: { regex: RegExp; reason: string }[] = [
  // Hard medical claims Kate is never authorized to make.
  { regex: /\bdiagnos(ed|is|e)\b/i, reason: "diagnosis language" },
  { regex: /\babnormal\b/i, reason: "alarmist clinical framing" },
  { regex: /\b(urgent|emergency)\b/i, reason: "urgency language not authorized" },
  { regex: /\byou (need|must) to\b/i, reason: "directive pressure" },
  { regex: /\b(should|must) (call|see) (a )?doctor immediately\b/i, reason: "alarmist directive" },
  // Pretending to know things we don't.
  { regex: /\byour (labs?|blood pressure|heart rate|cholesterol|a1c) (look|are) (normal|good|fine)\b/i, reason: "medical certainty without verified data" },
  // Phrasings that imply completion when nothing happened yet.
  { regex: /\b(i (already )?took care of|i've handled)\b/i, reason: "false-completion claim" },
];

const MAX_WORDS = 80; // Templates run ~30; LLM should land 25-50. 80 is the ceiling.

export type SafetyResult = {
  ok: boolean;
  state?: KateState;
  reason?: string;
  violatedPattern?: string;
};

/**
 * Validate a Kate output before it's sent to the user. Pure function:
 * input KateState → either {ok, state} or {ok:false, reason}.
 *
 * Callers (the voice layer / API route) decide whether to rewrite to a
 * safe fallback or surface the failure. For the API surface the
 * recommended path is to substitute a safe quiet-state fallback.
 */
export function validateKateOutput(state: KateState): SafetyResult {
  const message = state.message || "";
  const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_WORDS) {
    return { ok: false, reason: `message too long (${wordCount} words)` };
  }

  for (const { regex, reason } of FORBIDDEN_PATTERNS) {
    if (regex.test(message)) {
      return { ok: false, reason, violatedPattern: regex.source };
    }
  }

  // Chip count cap.
  if ((state.chips?.length ?? 0) > 3) {
    return { ok: false, reason: "too many chips" };
  }

  // Bucket / tone consistency — quiet bucket should not carry
  // celebratory tone, etc. Soft check.
  const bucketTone: Record<string, string[]> = {
    quiet: ["quiet", "calm"],
    one_thing: ["active", "calm"],
    couple_things: ["active", "calm"],
    lots: ["active", "calm"],
    celebratory: ["celebratory", "calm"],
    recap: ["calm", "celebratory"],
  };
  const allowed = bucketTone[state.bucket];
  if (allowed && !allowed.includes(state.tone)) {
    return { ok: false, reason: `tone "${state.tone}" inconsistent with bucket "${state.bucket}"` };
  }

  return { ok: true, state };
}

/**
 * If validation fails, return this calm fallback so the API never
 * leaks an unsafe message to the user.
 */
export function safeFallback(): KateState {
  return {
    bucket: "quiet",
    tone: "quiet",
    daysSinceSignup: 0,
    confidence: "settled",
    message: "I'll check back in a moment — give me a sec to gather things.",
    items: [],
    chips: [{ id: "ok", label: "OK", intent: "thanks", primary: true }],
    status: { stateText: "", score: null, deltaText: null },
    meta: {
      generatedAt: new Date().toISOString(),
      rulesVersion: "safety-fallback",
      voiceVersion: "safety-fallback",
    },
  };
}
