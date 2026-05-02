// Public entry — orchestrates signals → rules → voice and returns the
// shape the API hands to the UI. Two functions:
//
//   getOpeningKateState — what Kate says when the user opens the app
//     fresh (or after the resume window closed). This applies the
//     dedup filter so items the user dismissed recently don't reappear.
//
//   getKateReplyState   — what Kate says in response to the user's
//     last reply (chip-tap or typed text). For now uses the same
//     bucket/voice machinery; the Phase 2 LLM voice will fold prior
//     conversation history into context.
//
// Both functions are pure of API/transport concerns; the route handlers
// in src/app/api/kate/* compose them with the conversation-persistence
// layer to record turns.

import { gatherKateFacts } from "./signals";
import { classify, RULES_VERSION } from "./rules";
import { composeMessage, composeStatusBand, formatItemForUI, VOICE_VERSION } from "./voice";
import { recentlyDismissedItemIds, type MessageRow } from "./conversation";
import { applyLLMVoice } from "./voice-llm";
import type { KateState } from "./types";

export async function getOpeningKateState(appUserId: string): Promise<KateState> {
  let facts;
  let dismissed: Set<string>;
  try {
    facts = await gatherKateFacts(appUserId);
  } catch (err) {
    console.error("[kate/state] signals failed, using degraded facts:", err);
    facts = emptyFacts(appUserId);
  }
  try {
    dismissed = await recentlyDismissedItemIds(appUserId);
  } catch {
    dismissed = new Set();
  }

  // Apply dedup at the rule-input level: items the user said "not now"
  // to in the last 36h are filtered out of the various candidate lists
  // so the rules don't re-pitch them.
  const filteredFacts = {
    ...facts,
    overdueFollowUps: facts.overdueFollowUps.filter(
      (o) => !dismissed.has(`overdue-${o.provider_id}`)
    ),
    newProvidersNeverSeen: facts.newProvidersNeverSeen.filter(
      (n) => !dismissed.has(`new-${n.provider_id}`)
    ),
    failedAttempts: facts.failedAttempts.filter(
      (f) => !dismissed.has(`failed-${f.schedule_attempt_id}`)
    ),
  };

  const rule = classify(filteredFacts);
  const templateMessage = composeMessage(rule, filteredFacts);
  const status = composeStatusBand(rule, filteredFacts);

  const candidate: KateState = {
    bucket: rule.bucket,
    tone: rule.tone,
    daysSinceSignup: filteredFacts.daysSinceSignup,
    confidence: rule.confidence,
    message: templateMessage,
    items: rule.items.map(formatItemForUI),
    chips: rule.chips,
    status,
    meta: {
      generatedAt: new Date().toISOString(),
      rulesVersion: RULES_VERSION,
      voiceVersion: VOICE_VERSION,
    },
  };

  // LLM voice swap. If ANTHROPIC_API_KEY isn't set or the call fails,
  // applyLLMVoice returns the template-version unchanged.
  return applyLLMVoice(candidate, { facts: filteredFacts, rule });
}

/**
 * Compute Kate's reply to a specific user action.
 *
 * Phase 1: deterministic responses based on chip intent. The LLM voice
 * layer (Phase 6 of the build plan) will replace this with a call that
 * folds in conversation history and produces natural language.
 */
export async function getKateReplyState(args: {
  appUserId: string;
  chipIntent?: string;
  typedText?: string;
  history?: MessageRow[];
}): Promise<KateState> {
  let facts;
  try {
    facts = await gatherKateFacts(args.appUserId);
  } catch (err) {
    console.error("[kate/reply] signals failed, using degraded facts:", err);
    facts = emptyFacts(args.appUserId);
  }
  const confidence: KateState["confidence"] =
    facts.daysSinceSignup < 8 ? "new" : facts.daysSinceSignup < 30 ? "settled" : "established";

  const rule = {
    bucket: "quiet" as const,
    tone: "calm" as const,
    confidence,
    items: [],
    chips: [],
  };
  const status = composeStatusBand(rule, facts);

  const templateMessage = replyMessage(args, facts);
  const chips = replyChips(args, facts);

  const candidate: KateState = {
    bucket: "quiet",
    tone: "calm",
    daysSinceSignup: facts.daysSinceSignup,
    confidence,
    message: templateMessage,
    items: [],
    chips,
    status,
    meta: {
      generatedAt: new Date().toISOString(),
      rulesVersion: RULES_VERSION,
      voiceVersion: VOICE_VERSION,
    },
  };

  return applyLLMVoice(candidate, {
    facts,
    rule,
    history: args.history,
    userReply: { chipIntent: args.chipIntent, typedText: args.typedText },
  });
}

function replyMessage(
  args: { chipIntent?: string; typedText?: string },
  _facts: unknown
): string {
  if (args.typedText && args.typedText.trim()) {
    // Phase 1 stub — the LLM voice layer (Phase 6) handles real free-form
    // replies. For now, acknowledge and offer to look into it.
    return "Let me look into that for you.";
  }
  switch (args.chipIntent) {
    case "handle":
      return [
        "On it. I'll start with the most important one and work through the rest.",
        "",
        "I'll bring updates back when each one lands.",
      ].join("\n");
    case "elaborate":
      return [
        "Sure — here's the full picture:",
        "",
        "I'll surface what I'm seeing in detail and you can pick which to handle.",
      ].join("\n");
    case "defer":
      return "No worries. I'll check back tomorrow morning.";
    case "thanks":
      return "Anytime. I'll let you know if anything changes.";
    default:
      return "Got it.";
  }
}

function replyChips(
  args: { chipIntent?: string; typedText?: string },
  _facts: unknown
) {
  if (args.typedText && args.typedText.trim()) {
    return [
      { id: "thanks", label: "Thanks", intent: "thanks" as const, primary: true },
    ];
  }
  switch (args.chipIntent) {
    case "handle":
      return [
        { id: "thanks", label: "Sounds good", intent: "thanks" as const, primary: true },
      ];
    case "elaborate":
      return [
        { id: "handle", label: "Handle them", intent: "handle" as const, primary: true },
        { id: "defer", label: "Hold off", intent: "defer" as const },
      ];
    case "defer":
      return [
        { id: "handle", label: "Actually, let's do it", intent: "handle" as const },
      ];
    case "thanks":
      return [];
    default:
      return [
        { id: "thanks", label: "OK", intent: "thanks" as const, primary: true },
      ];
  }
}

// Degraded facts fallback — when signals fail entirely, Kate has
// nothing real to talk about. This keeps her quiet rather than crashing.
function emptyFacts(appUserId: string) {
  return {
    appUserId,
    daysSinceSignup: 0,
    activeProviderCount: 0,
    overdueFollowUps: [],
    newProvidersNeverSeen: [],
    upcomingAppointments: [],
    inFlightAttempts: [],
    failedAttempts: [],
    recentCompletions: [],
    lastKateMessage: null,
    score: null,
    scoreDelta: null,
  };
}

// Backwards-compat alias for callers that haven't migrated yet.
export const getKateState = getOpeningKateState;

// ─────────────────────────────────────────────────────────────────
// Eval entry points — drive the rule + voice + LLM stack with
// pre-built synthetic facts, bypassing the DB. Used by the kate-eval
// harness in scripts/kate-eval/. NOT used in production code paths.
// ─────────────────────────────────────────────────────────────────

import type { KateFacts } from "./types";

export async function composeOpeningFromFacts(facts: KateFacts): Promise<KateState> {
  const rule = classify(facts);
  const templateMessage = composeMessage(rule, facts);
  const status = composeStatusBand(rule, facts);
  const candidate: KateState = {
    bucket: rule.bucket,
    tone: rule.tone,
    daysSinceSignup: facts.daysSinceSignup,
    confidence: rule.confidence,
    message: templateMessage,
    items: rule.items.map(formatItemForUI),
    chips: rule.chips,
    status,
    meta: {
      generatedAt: new Date().toISOString(),
      rulesVersion: RULES_VERSION,
      voiceVersion: VOICE_VERSION,
    },
  };
  return applyLLMVoice(candidate, { facts, rule });
}

export async function composeReplyFromFacts(opts: {
  facts: KateFacts;
  userReply: { chipIntent?: string; typedText?: string };
  history?: MessageRow[];
}): Promise<KateState> {
  const facts = opts.facts;
  const confidence: KateState["confidence"] =
    facts.daysSinceSignup < 8 ? "new" : facts.daysSinceSignup < 30 ? "settled" : "established";
  const rule = {
    bucket: "quiet" as const,
    tone: "calm" as const,
    confidence,
    items: [],
    chips: [],
  };
  const status = composeStatusBand(rule, facts);
  const templateMessage = "Got it.";
  const candidate: KateState = {
    bucket: "quiet",
    tone: "calm",
    daysSinceSignup: facts.daysSinceSignup,
    confidence,
    message: templateMessage,
    items: [],
    chips: [],
    status,
    meta: {
      generatedAt: new Date().toISOString(),
      rulesVersion: RULES_VERSION,
      voiceVersion: VOICE_VERSION,
    },
  };
  return applyLLMVoice(candidate, {
    facts,
    rule,
    history: opts.history,
    userReply: opts.userReply,
  });
}
