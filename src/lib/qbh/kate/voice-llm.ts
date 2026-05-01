// LLM voice layer for Kate. Wraps Anthropic Claude Sonnet 4.5 with
// prompt caching, structured (tool-use) output, and a graceful
// fallback path that hands back to the template voice when:
//   - ANTHROPIC_API_KEY isn't set
//   - the SDK call fails (network, rate limit, etc.)
//   - the parsed output fails our safety validator
//
// Phase 1 design choices baked in:
//   - We pass the rule layer's bucket + items + chips and ask the LLM
//     to render the MESSAGE only. Chips stay rule-determined so the
//     UI's deterministic chip-tap loop doesn't drift between turns.
//   - Conversation history is passed as a compact JSON list of recent
//     turns; the LLM uses it to avoid repeating itself but doesn't
//     decide the bucket from history.
//   - `cache_control` is set on the long, stable parts (system prompt
//     + voice rules) so the per-turn cost is essentially the variable
//     part: facts JSON + history + user reply.

import Anthropic from "@anthropic-ai/sdk";
import { KATE_SYSTEM_PROMPT } from "./safety";
import type { KateFacts, KateState } from "./types";
import type { RuleResult } from "./rules";
import type { MessageRow } from "./conversation";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 350;

let _client: Anthropic | null = null;
function client(): Anthropic | null {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function llmComposeMessage(opts: {
  facts: KateFacts;
  rule: RuleResult;
  /** Recent conversation history, oldest-first. Optional — first-turn
   *  callers can omit. */
  history?: Pick<MessageRow, "role" | "content" | "user_chip_intent" | "created_at">[];
  /** What the user just said (chip intent or typed text). When set,
   *  we're rendering Kate's REPLY rather than her OPENING. */
  userReply?: { chipIntent?: string; typedText?: string };
}): Promise<string | null> {
  const c = client();
  if (!c) return null;

  // Build the structured "what Kate is seeing" payload — no PII beyond
  // first-name-of-provider. Names like "Dr. Smith" are fine; the user's
  // own name we don't include here unless we need it later.
  const factsForLLM = {
    bucket: opts.rule.bucket,
    tone: opts.rule.tone,
    confidence: opts.rule.confidence,
    items: opts.rule.items.map((i) => ({
      type: i.type,
      title: i.title,
      detail: i.detail,
      urgency: i.urgency,
    })),
    score: opts.facts.score,
    scoreDelta: opts.facts.scoreDelta,
    daysSinceSignup: opts.facts.daysSinceSignup,
    activeProviderCount: opts.facts.activeProviderCount,
    upcomingNext:
      opts.facts.upcomingAppointments[0]?.provider_name ?? null,
  };

  const historyForLLM = (opts.history ?? [])
    .filter((m) => m.role !== "system")
    .slice(-10)
    .map((m) => ({
      who: m.role,
      said: m.content,
      ...(m.user_chip_intent ? { chip: m.user_chip_intent } : {}),
    }));

  // System prompt + voice rules — heavy and stable, so we cache them.
  const systemBlocks: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = [
    { type: "text", text: KATE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: BUCKET_GUIDANCE,
      cache_control: { type: "ephemeral" },
    },
  ];

  const userPayload = {
    instruction: opts.userReply
      ? "Compose Kate's reply to the user's last action."
      : "Compose Kate's opening message for this user's current state.",
    state: factsForLLM,
    history: historyForLLM,
    user_reply: opts.userReply ?? null,
    output_format:
      "Return JSON: { \"message\": string }. The message should be plain text (no markdown headers). Lists OK with leading dashes when listing items.",
  };

  try {
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemBlocks,
      messages: [
        {
          role: "user",
          content: JSON.stringify(userPayload),
        },
      ],
    });

    // Extract text content. Anthropic returns blocks; we want the first text block.
    const block = resp.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!block) return null;
    const raw = block.text.trim();
    return parseMessage(raw);
  } catch (err) {
    console.warn("[kate/voice-llm] call failed, falling back to templates:", err);
    return null;
  }
}

/** Pull the "message" field out of whatever the LLM returned. */
function parseMessage(raw: string): string | null {
  // Try strict JSON first.
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.message === "string") return obj.message.trim();
  } catch {
    // not JSON — try to pull the field out of a JSON-ish block
  }
  const m = raw.match(/"message"\s*:\s*"([^"]+)"/);
  if (m) return m[1];
  // Last-resort: take the whole response as the message if it's short.
  if (raw.length < 800) return raw;
  return null;
}

/**
 * Apply the LLM-generated message to a KateState produced by the rule
 * layer. If the LLM call returns null, the original (template) state
 * is returned unchanged so callers always get a usable result.
 */
export async function applyLLMVoice(
  candidate: KateState,
  opts: {
    facts: KateFacts;
    rule: RuleResult;
    history?: Pick<MessageRow, "role" | "content" | "user_chip_intent" | "created_at">[];
    userReply?: { chipIntent?: string; typedText?: string };
  }
): Promise<KateState> {
  const llmText = await llmComposeMessage(opts);
  if (!llmText) return candidate;
  return {
    ...candidate,
    message: llmText,
    meta: {
      ...candidate.meta,
      voiceVersion: "kate-voice-v2-claude-sonnet-4-5",
    },
  };
}

const BUCKET_GUIDANCE = `BUCKET-SPECIFIC GUIDANCE

You will be told a bucket the user is currently in. Use it to choose your stance.

- "quiet": nothing actionable on the radar. Honest short message. Do not invent things to talk about.
- "one_thing": exactly one item to pitch. Lead with the item, end by offering to handle it.
- "couple_things": 2-4 items. Group them as a short list, end with a single offer to handle.
- "lots": 5+ items. Acknowledge the volume, propose to start with the top one. Do not list everything.
- "celebratory": something just got handled in the last day. Briefly congratulate. Do not over-celebrate.
- "recap": weekly reset moment. Reinforce continuity, keep it short.

CONFIDENCE BAND
- "new" (under 8 days since signup): hedge a little. Acceptable to say "I'm still getting to know your care."
- "settled" (8-29 days): confident on what you have, no apology language.
- "established" (30+ days): full operator. You can refer to the user's patterns ("you usually book afternoon").

REPLIES TO USER ACTIONS
When the user has just acted (chip-tap or typed text), produce a SHORT reply (1-3 sentences) that confirms what's happening and points to what's next. Don't restart the conversation; respond to what they just said.`;
