// Voice layer — turns the rule layer's structural answer into Kate's
// actual words.
//
// Phase 1 (this file): rule-based templates. Predictable, debuggable,
// no LLM cost, and forces us to confront the data gaps honestly.
// Phase 2: swap the body of `composeMessage` for an LLM call constrained
// to the same inputs and asked to produce the same shape.

import type { KateFacts, KateItem } from "./types";
import type { RuleResult } from "./rules";

export const VOICE_VERSION = "kate-voice-v1-templates";

export function composeMessage(rule: RuleResult, facts: KateFacts): string {
  switch (rule.bucket) {
    case "quiet":
      return quietMessage(facts);
    case "one_thing":
      return oneThingMessage(rule, facts);
    case "couple_things":
      return coupleThingsMessage(rule, facts);
    case "lots":
      return lotsMessage(rule, facts);
    case "celebratory":
      return celebratoryMessage(rule);
    case "recap":
      return recapMessage(facts);
  }
}

export function composeStatusBand(
  rule: RuleResult,
  facts: KateFacts
): { stateText: string; score: number | null; deltaText: string | null } {
  return {
    stateText: stateTextFor(rule, facts),
    score: facts.score,
    deltaText:
      facts.scoreDelta !== null
        ? `${facts.scoreDelta >= 0 ? "↑" : "↓"} ${Math.abs(facts.scoreDelta)} this week`
        : null,
  };
}

// ─────────────────────────────────────────────────────────────────
// State text — drives the band above Kate. Honest, not aspirational.
// ─────────────────────────────────────────────────────────────────

function stateTextFor(rule: RuleResult, facts: KateFacts): string {
  if (rule.bucket === "celebratory") return "Quiet wins this week.";
  if (rule.bucket === "lots") return "A few things piling up.";
  if (rule.bucket === "couple_things") return "A couple of things to look at.";
  if (rule.bucket === "one_thing") return "One thing to look at.";
  // quiet bucket — but only confident if we have evidence the user is
  // active. For brand-new accounts with no data, soften the claim.
  if (facts.daysSinceSignup < 3 && facts.activeProviderCount === 0) {
    return "Just getting set up.";
  }
  return "You're in a good place.";
}

// ─────────────────────────────────────────────────────────────────
// Per-bucket message templates
// ─────────────────────────────────────────────────────────────────

function quietMessage(facts: KateFacts): string {
  // For brand-new users with nothing on the books, be honest about it
  // rather than fake-warm. Kate's credibility lives in not pretending.
  if (facts.daysSinceSignup < 3 && facts.activeProviderCount === 0) {
    return [
      "Hey — we're just getting started.",
      "",
      "Once I have a bit of your care info I'll start watching for the things you'd otherwise have to track yourself. For now, anything specific on your mind?",
    ].join("\n");
  }

  if (facts.upcomingAppointments.length > 0) {
    const next = facts.upcomingAppointments[0];
    return [
      "Nothing on my radar that needs your attention.",
      "",
      `Next up is **${next.provider_name}** — I'll keep an eye on it.`,
    ].join("\n");
  }

  return [
    "Nothing on my radar today.",
    "",
    "You're in a good place. I'll check back when something needs you.",
  ].join("\n");
}

function oneThingMessage(rule: RuleResult, facts: KateFacts): string {
  const item = rule.items[0];
  void facts;
  // New-provider items get a slightly different opener — the user just
  // told us this provider matters, so framing as "first appointment"
  // reads more accurately than "follow-up."
  if (item.type === "new_provider_no_visits") {
    return [
      `**${item.title}** is on your team but doesn't have an appointment yet.`,
      "",
      "Want me to book a first visit?",
    ].join("\n");
  }
  return [
    `Hey — I've got one thing for you.`,
    "",
    `**${item.title}** — ${item.detail}.`,
    "",
    "Want me to handle it?",
  ].join("\n");
}

function coupleThingsMessage(rule: RuleResult, facts: KateFacts): string {
  void facts;
  // Detect "all of these are new providers with no visits yet" and
  // open with proactive booking framing rather than the generic
  // "I've got a couple of things" opener.
  const items = rule.items.slice(0, 4);
  const allNew = items.every((i) => i.type === "new_provider_no_visits");
  if (allNew) {
    const lines = items.map((i) => `• **${i.title}**`).join("\n");
    return [
      `You added ${items.length === 1 ? "one provider" : `${items.length} providers`} but haven't booked anything yet:`,
      "",
      lines,
      "",
      "Want me to start booking first appointments?",
    ].join("\n");
  }

  const lines = items
    .map((i) => `• **${i.title}** — ${i.detail}`)
    .join("\n");

  const opener =
    rule.confidence === "new"
      ? "Hey — I'm still getting to know your care, but I'm seeing a couple of things:"
      : "Hey — I've got a couple of things for you today.";

  return [opener, "", lines, "", "Want me to handle it?"].join("\n");
}

function lotsMessage(rule: RuleResult, facts: KateFacts): string {
  const top = rule.items.slice(0, 3);
  const more = rule.items.length - top.length;
  void facts;
  const lines = top.map((i) => `• **${i.title}** — ${i.detail}`).join("\n");
  return [
    "Quite a bit on the list right now.",
    "",
    "Top things I'm watching:",
    lines,
    more > 0 ? `…plus ${more} more.` : "",
    "",
    "Want me to start with the most important?",
  ]
    .filter((s) => s !== "")
    .join("\n");
}

function celebratoryMessage(rule: RuleResult): string {
  const c = rule.items[0];
  if (!c) return "You're ahead today.";
  return [
    `**${c.title}** is booked. Nice — that one's off your plate.`,
    "",
    "I'll bring the next thing back when it's time.",
  ].join("\n");
}

function recapMessage(facts: KateFacts): string {
  void facts;
  return [
    "You stayed steady this week.",
    "",
    "A couple small things will keep you there. Want to look together?",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Item formatter — used by the API to keep item titles consistent
// with what's shown in the message body.
// ─────────────────────────────────────────────────────────────────

export function formatItemForUI(item: KateItem): KateItem {
  // Pass-through for now; reserved for any voice-layer rewriting of
  // item titles (e.g. "Dr. Smith follow-up" → "Annual physical").
  return item;
}
