// Public entry — orchestrates signals → rules → voice and returns the
// shape the API hands to the UI.

import { gatherKateFacts } from "./signals";
import { classify, RULES_VERSION } from "./rules";
import { composeMessage, composeStatusBand, formatItemForUI, VOICE_VERSION } from "./voice";
import type { KateState } from "./types";

export async function getKateState(appUserId: string): Promise<KateState> {
  const facts = await gatherKateFacts(appUserId);
  const rule = classify(facts);
  const message = composeMessage(rule, facts);
  const status = composeStatusBand(rule, facts);

  return {
    bucket: rule.bucket,
    tone: rule.tone,
    daysSinceSignup: facts.daysSinceSignup,
    confidence: rule.confidence,
    message,
    items: rule.items.map(formatItemForUI),
    chips: rule.chips,
    status,
    meta: {
      generatedAt: new Date().toISOString(),
      rulesVersion: RULES_VERSION,
      voiceVersion: VOICE_VERSION,
    },
  };
}
