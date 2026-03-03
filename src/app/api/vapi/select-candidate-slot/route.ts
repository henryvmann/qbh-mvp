import { supabaseAdmin } from "../../../../lib/supabase-server";

type VapiToolResultEnvelope = {
    toolCallId: string;
    result: string; // JSON-stringified payload
};

type VapiToolCallsBody = {
    message?: {
        type?: string;
        toolCalls?: Array<{
            id?: string;
            function?: { name?: string; arguments?: string | Record<string, any> };
        }>;
    };
    toolCallId?: string;
    tool_call_id?: string;
    id?: string;
};

function jsonToolResults(results: VapiToolResultEnvelope[]) {
    return Response.json({ results });
}

function safeParseArgs(raw: any): Record<string, any> {
    if (!raw) return {};
    if (typeof raw === "object") return raw as Record<string, any>;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }
    return {};
}

function toInt(v: any): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Math.trunc(Number(v));
    return null;
}

function normText(v: any): string {
    return String(v ?? "").trim();
}

function lowerTrim(v: any): string {
    return normText(v).toLowerCase();
}

function canonSelection(s: string): string {
    // deterministic normalization: lowercase, strip punctuation, collapse spaces
    return s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function ordinalToZeroIndex(sel: string): number | null {
    // deterministic whitelist (no fuzzy / no parsing of time)
    const x = canonSelection(sel);

    // remove common deterministic wrappers
    const stripped =
        x
            .replace(/^the /, "")
            .replace(/^option /, "")
            .replace(/^choice /, "")
            .replace(/^number /, "")
            .replace(/ option$/, "")
            .replace(/ choice$/, "")
            .replace(/ one$/, "")
            .trim();

    if (stripped === "first" || stripped === "1" || stripped === "1st" || stripped === "one") return 0;
    if (stripped === "second" || stripped === "2" || stripped === "2nd" || stripped === "two") return 1;
    if (stripped === "third" || stripped === "3" || stripped === "3rd" || stripped === "three") return 2;

    return null;
}

function isAffirmative(sel: string): boolean {
  const x = canonSelection(sel);

  // Deterministic whitelist only (no fuzzy)
  if (
    x === "yes" ||
    x === "yeah" ||
    x === "yep" ||
    x === "sure" ||
    x === "ok" ||
    x === "okay" ||
    x === "correct" ||
    x === "works" ||
    x === "that works" ||
    x === "sounds good" ||
    x === "fine" ||
    x === "perfect" ||
    x === "great"
  ) {
    return true;
  }

  // Deterministic prefixes (common natural speech)
  if (x.startsWith("yes ")) return true;
  if (x.startsWith("yeah ")) return true;
  if (x.startsWith("yep ")) return true;
  if (x.startsWith("sure ")) return true;
  if (x.startsWith("ok ")) return true;
  if (x.startsWith("okay ")) return true;

  return false;
}

async function getExistingProposalId(attemptId: number): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from("proposals")
        .select("id")
        .eq("attempt_id", attemptId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) return null;
    if (!data || data.length === 0) return null;
    return data[0].id ?? null;
}

function toolError(toolCallId: string, code: string, message_to_say: string, next_action: string, extra?: any) {
    return {
        toolCallId,
        result: JSON.stringify({
            status: "ERROR",
            code,
            message_to_say,
            next_action,
            ...(extra ? extra : {}),
        }),
    };
}

async function handleOne(toolCallId: string, args: any): Promise<VapiToolResultEnvelope> {
    const attemptId = toInt(args?.attempt_id ?? args?.attemptId);
    const providerId = normText(args?.provider_id ?? args?.providerId);
    const userSelection = normText(args?.user_selection ?? args?.selection ?? args?.selected ?? "");

    if (!attemptId || !providerId || !userSelection) {
        return toolError(
            toolCallId,
            "MISSING_REQUIRED_FIELDS",
            "There was a system issue. I will call back shortly.",
            "END_CALL"
        );
    }

    // Idempotency: if proposal already exists for this attempt, return it.
    const existing = await getExistingProposalId(attemptId);
    if (existing) {
        return {
            toolCallId,
            result: JSON.stringify({
                status: "OK",
                proposal_id: existing,
                attempt_id: attemptId,
                provider_id: providerId,
                next_action: "SAY_TO_OFFICE",
                message_to_say: "One moment while I confirm that time.",
            }),
        };
    }

    // Load candidate slots for attempt
    const { data: slots, error: slotsErr } = await supabaseAdmin
        .from("candidate_slots")
        .select("attempt_id, slot_index, start_at, end_at, spoken_start, spoken_end, payload")
        .eq("attempt_id", attemptId)
        .order("slot_index", { ascending: true });

    if (slotsErr) {
        return toolError(
            toolCallId,
            "CANDIDATE_SLOTS_QUERY_FAILED",
            "There was a system issue. I will call back shortly.",
            "END_CALL"
        );
    }

    if (!slots || slots.length === 0) {
        return toolError(
            toolCallId,
            "NO_CANDIDATE_SLOTS",
            "I don’t have any available times to offer right now. I can call back shortly.",
            "END_CALL"
        );
    }

    const selLower = lowerTrim(userSelection);
    const zeroIdx = ordinalToZeroIndex(userSelection);

    let chosen: any | null = null;

    if (zeroIdx !== null) {
        chosen = (slots as any[]).find((s) => toInt(s.slot_index) === zeroIdx) ?? null;
        if (!chosen) {
            return toolError(
                toolCallId,
                "INVALID_ORDINAL_SELECTION",
                "That option isn’t available. Please choose one of the offered times.",
                "ASK_USER_TO_CHOOSE_SLOT"
            );
        }
    } else {
        const matches = (slots as any[]).filter((s) => lowerTrim(s.spoken_start) === selLower);
        if (matches.length === 0) {
            return toolError(
                toolCallId,
                "NO_TIME_MATCH",
                "That time doesn’t match the options I offered. Please choose one of the offered times.",
                "ASK_USER_TO_CHOOSE_SLOT",
                {
                    debug: {
                        user_selection_raw: userSelection,
                        user_selection_lower: selLower,
                        ordinal_index: zeroIdx,
                        spoken_options: slots.map((s) => s.spoken_start),
                    },
                }
            );
        }
        if (matches.length > 1) {
            return toolError(
                toolCallId,
                "AMBIGUOUS_TIME_MATCH",
                "That selection matches more than one option. Please say first, second, or third.",
                "ASK_USER_TO_CHOOSE_SLOT"
            );
        }
        chosen = matches[0];
    }

    const payload = {
        source: "candidate_slot_selection",
        provider_id: providerId,
        user_selection: userSelection,
        slot_index: chosen.slot_index,
        spoken_start: chosen.spoken_start,
        spoken_end: chosen.spoken_end,
        start_at: chosen.start_at,
        end_at: chosen.end_at,
        candidate_payload: chosen.payload ?? {},
    };

    const { data: proposal, error: propErr } = await supabaseAdmin
        .from("proposals")
        .insert({
            attempt_id: attemptId,
            tool_call_id: toolCallId,
            office_offer_raw_text: `CANDIDATE_SLOT_SELECTION:${userSelection}`,
            normalized_start: chosen.start_at,
            normalized_end: chosen.end_at,
            conflict: false,
            message_to_say: `How about ${chosen.spoken_start}?`,
            next_action: "SAY_TO_OFFICE",
            status: "PROPOSED",
            payload,
        })
        .select("id")
        .single();

    // Race-safe: if unique constraint hit, re-select
    if (propErr) {
        const code = (propErr as any)?.code;
        if (code === "23505") {
            const raced = await getExistingProposalId(attemptId);
            if (raced) {
                return {
                    toolCallId,
                    result: JSON.stringify({
                        status: "OK",
                        proposal_id: raced,
                        attempt_id: attemptId,
                        provider_id: providerId,
                        next_action: "SAY_TO_OFFICE",
                        message_to_say: "One moment while I confirm that time.",
                    }),
                };
            }
        }

        return toolError(
            toolCallId,
            "PROPOSAL_INSERT_FAILED",
            "There was a system issue. I will call back shortly.",
            "END_CALL",
            { debug: { message: propErr.message, code: (propErr as any)?.code } }
        );
    }

    return {
        toolCallId,
        result: JSON.stringify({
            status: "OK",
            proposal_id: proposal.id,
            attempt_id: attemptId,
            provider_id: providerId,
            selected: {
                slot_index: chosen.slot_index,
                start_at: chosen.start_at,
                end_at: chosen.end_at,
                spoken_start: chosen.spoken_start,
                spoken_end: chosen.spoken_end,
            },
            message_to_say: `How about ${chosen.spoken_start}?`,
            next_action: "SAY_TO_OFFICE",
        }),
    };
}

export async function POST(req: Request) {
    const body = (await req.json().catch(() => ({}))) as VapiToolCallsBody;

    // 1) Vapi tool-calls envelope
    if (body?.message?.type === "tool-calls" && Array.isArray(body.message.toolCalls)) {
        const results: VapiToolResultEnvelope[] = [];

        for (const tc of body.message.toolCalls) {
            const toolCallId = String(tc?.id ?? "").trim() || "missing_toolCallId";
            const fnName = String(tc?.function?.name ?? "").trim();
            if (fnName !== "select_candidate_slot") continue;

            const args = safeParseArgs(tc?.function?.arguments);
            results.push(await handleOne(toolCallId, args));
        }

        if (results.length === 0) {
            return jsonToolResults([
                toolError(
                    "no_matching_tool",
                    "NO_MATCHING_TOOL_CALL",
                    "There was a system issue. I will call back shortly.",
                    "END_CALL"
                ),
            ]);
        }

        return jsonToolResults(results);
    }

    // 2) Flat JSON body fallback (curl / legacy)
    const toolCallId = String(body?.toolCallId || body?.tool_call_id || body?.id || "local_call").trim();
    return jsonToolResults([await handleOne(toolCallId, body as any)]);
}