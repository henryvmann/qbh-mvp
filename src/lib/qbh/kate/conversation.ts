// Conversation persistence layer — opens/resumes Kate conversations,
// records turns, exposes recent history for the voice layer to use as
// context.
//
// Backed by `kate_conversations` + `kate_messages` (see
// db/migrations/2026-05-kate-conversations.sql). When those tables
// don't exist (migration not yet run), every function logs once and
// returns null/[]; the API gracefully falls back to stateless mode so
// shipping the code doesn't require the migration to be live.

import { supabaseAdmin } from "../../supabase-server";
import type { KateChip, KateItem, KateState } from "./types";

const RESUME_WINDOW_HOURS = 18; // Conversations older than this start fresh

export type ConversationRow = {
  id: string;
  app_user_id: string;
  status: string;
  started_at: string;
  last_activity_at: string;
  last_facts_json: unknown;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  app_user_id: string;
  role: "kate" | "user" | "system";
  content: string;
  items_referenced: KateItem[];
  chips_offered: KateChip[];
  user_chip_intent: string | null;
  kate_bucket: string | null;
  kate_tone: string | null;
  kate_confidence: string | null;
  created_at: string;
};

let _missingTablesLogged = false;
function logMissingOnce() {
  if (_missingTablesLogged) return;
  _missingTablesLogged = true;
  console.warn(
    "[kate/conversation] kate_conversations / kate_messages not found — falling back to stateless. Run db/migrations/2026-05-kate-conversations.sql to enable persistence."
  );
}

/**
 * Get the active conversation for the user if one exists and is fresh
 * (within RESUME_WINDOW_HOURS), else null. Used at GET /api/kate/state
 * to decide whether to resume or open a new conversation.
 */
export async function getActiveConversation(
  appUserId: string
): Promise<ConversationRow | null> {
  const { data, error } = await supabaseAdmin
    .from("kate_conversations")
    .select("*")
    .eq("app_user_id", appUserId)
    .eq("status", "active")
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      logMissingOnce();
      return null;
    }
    console.error("[kate/conversation] getActive error:", error);
    return null;
  }
  if (!data) return null;

  // Fresh-window check
  const ageHours =
    (Date.now() - new Date(data.last_activity_at).getTime()) /
    (1000 * 60 * 60);
  if (ageHours > RESUME_WINDOW_HOURS) {
    // Archive stale conversation so a new one starts cleanly
    await supabaseAdmin
      .from("kate_conversations")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", data.id);
    return null;
  }

  return data as ConversationRow;
}

/** Open a new conversation row. */
export async function openConversation(
  appUserId: string,
  factsJson: unknown
): Promise<ConversationRow | null> {
  const { data, error } = await supabaseAdmin
    .from("kate_conversations")
    .insert({
      app_user_id: appUserId,
      status: "active",
      last_facts_json: factsJson,
    })
    .select("*")
    .single();
  if (error) {
    if (isMissingTableError(error)) {
      logMissingOnce();
      return null;
    }
    console.error("[kate/conversation] openConversation error:", error);
    return null;
  }
  return data as ConversationRow;
}

/** Insert a single message turn. */
export async function recordMessage(args: {
  conversationId: string;
  appUserId: string;
  role: "kate" | "user" | "system";
  content: string;
  itemsReferenced?: KateItem[];
  chipsOffered?: KateChip[];
  userChipIntent?: string | null;
  kateBucket?: string;
  kateTone?: string;
  kateConfidence?: string;
}): Promise<MessageRow | null> {
  const { data, error } = await supabaseAdmin
    .from("kate_messages")
    .insert({
      conversation_id: args.conversationId,
      app_user_id: args.appUserId,
      role: args.role,
      content: args.content,
      items_referenced: args.itemsReferenced ?? [],
      chips_offered: args.chipsOffered ?? [],
      user_chip_intent: args.userChipIntent ?? null,
      kate_bucket: args.kateBucket ?? null,
      kate_tone: args.kateTone ?? null,
      kate_confidence: args.kateConfidence ?? null,
    })
    .select("*")
    .single();

  // Bump the conversation's last_activity_at so resumes work.
  await supabaseAdmin
    .from("kate_conversations")
    .update({
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.conversationId);

  if (error) {
    if (isMissingTableError(error)) {
      logMissingOnce();
      return null;
    }
    console.error("[kate/conversation] recordMessage error:", error);
    return null;
  }
  return data as MessageRow;
}

/** Last N messages of a conversation, oldest-first. */
export async function getRecentMessages(
  conversationId: string,
  limit = 10
): Promise<MessageRow[]> {
  const { data, error } = await supabaseAdmin
    .from("kate_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) {
      logMissingOnce();
      return [];
    }
    console.error("[kate/conversation] getRecent error:", error);
    return [];
  }
  return ((data ?? []) as MessageRow[]).reverse();
}

/**
 * Items Kate has surfaced to this user in the last `windowHours` that
 * the user already responded to (chip-tap or system dismissal). The
 * rule layer uses this to dedup — don't re-pitch a "follow up with Dr.
 * Smith" if the user said "not now" on it 6 hours ago.
 */
export async function recentlyDismissedItemIds(
  appUserId: string,
  windowHours = 36
): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("kate_messages")
    .select("user_chip_intent, items_referenced, conversation_id, created_at")
    .eq("app_user_id", appUserId)
    .eq("role", "user")
    .gte("created_at", cutoff);

  if (error) {
    if (isMissingTableError(error)) return new Set();
    console.error("[kate/conversation] recentlyDismissed error:", error);
    return new Set();
  }

  // Find the kate message immediately preceding each user message and
  // collect the items it referenced when the user said "not now".
  // Cheaper than a joined query at this scale.
  const dismissedConversationIds = (data ?? [])
    .filter((m) => m.user_chip_intent === "defer")
    .map((m) => m.conversation_id);

  if (dismissedConversationIds.length === 0) return new Set();

  const { data: kateMsgs } = await supabaseAdmin
    .from("kate_messages")
    .select("items_referenced, conversation_id, created_at")
    .in("conversation_id", dismissedConversationIds)
    .eq("role", "kate")
    .gte("created_at", cutoff);

  const ids = new Set<string>();
  for (const m of kateMsgs ?? []) {
    for (const item of (m.items_referenced as KateItem[] | null) ?? []) {
      if (item?.id) ids.add(item.id);
    }
  }
  return ids;
}

/** Stash the latest KateState into the conversation's last_facts_json. */
export async function updateLastFacts(
  conversationId: string,
  facts: unknown
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("kate_conversations")
    .update({
      last_facts_json: facts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
  if (error && !isMissingTableError(error)) {
    console.error("[kate/conversation] updateLastFacts error:", error);
  }
}

function isMissingTableError(err: { code?: string; message?: string }): boolean {
  // Postgres "relation does not exist" — surfaces from PostgREST as 42P01.
  if (err?.code === "42P01") return true;
  if ((err?.message || "").toLowerCase().includes("does not exist")) return true;
  return false;
}

/**
 * Convenience: pack a KateState into a recordMessage() call.
 */
export async function recordKateTurn(
  conversationId: string,
  appUserId: string,
  state: KateState
) {
  return recordMessage({
    conversationId,
    appUserId,
    role: "kate",
    content: state.message,
    itemsReferenced: state.items,
    chipsOffered: state.chips,
    kateBucket: state.bucket,
    kateTone: state.tone,
    kateConfidence: state.confidence,
  });
}
