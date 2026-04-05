import { googleCalendarAvailabilitySource } from "./sources/google-calendar";
import { outlookCalendarAvailabilitySource } from "./sources/outlook-calendar";
import type {
  AvailabilityBlock,
  AvailabilityContext,
  AvailabilityDecision,
  AvailabilityDecisionReasonCode,
  AvailabilityServiceInput,
  AvailabilitySourceAdapter,
  AvailabilitySourceSummary,
} from "./types";

function normalizeTimezone(input: AvailabilityServiceInput): string {
  return (input.timezone || "America/New_York").trim();
}

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function sortBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  return [...blocks].sort((a, b) => {
    const startDiff = toMs(a.start_at) - toMs(b.start_at);

    if (startDiff !== 0) {
      return startDiff;
    }

    return toMs(a.end_at) - toMs(b.end_at);
  });
}

function dedupeBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  const seen = new Set<string>();
  const result: AvailabilityBlock[] = [];

  for (const block of blocks) {
    const key = [
      block.source,
      block.kind,
      block.start_at,
      block.end_at,
      block.integration_id || "",
      block.provider_id || "",
      block.title || "",
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(block);
  }

  return result;
}

function normalizeBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  return sortBlocks(dedupeBlocks(blocks));
}

function getDefaultAdapters(): AvailabilitySourceAdapter[] {
  return [googleCalendarAvailabilitySource, outlookCalendarAvailabilitySource];
}

function mapConflictReason(
  source: AvailabilityBlock["source"]
): AvailabilityDecisionReasonCode {
  switch (source) {
    case "GOOGLE_CALENDAR":
    case "OUTLOOK_CALENDAR":
      return "CALENDAR_CONFLICT";
    case "PORTAL_APPOINTMENT":
      return "PORTAL_CONFLICT";
    case "OFFICE_CONSTRAINT":
      return "OFFICE_BLOCKED";
    case "BOOKING_RULE":
      return "OUTSIDE_BOOKING_RULES";
    default:
      return "CALENDAR_CONFLICT";
  }
}

function evaluateProposedSlot(
  input: AvailabilityServiceInput,
  blocks: AvailabilityBlock[]
): AvailabilityDecision | null {
  const slot = input.proposed_slot;

  if (!slot) {
    return null;
  }

  const start = toMs(slot.start_at);
  const end = toMs(slot.end_at);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return {
      status: "INVALID",
      reason_code: "INVALID_RANGE",
      blocking_block_ids: [],
      notes: ["Invalid proposed time range"],
    };
  }

  const windowStart = toMs(input.window_start);
  const windowEnd = toMs(input.window_end);

  if (
    !Number.isFinite(windowStart) ||
    !Number.isFinite(windowEnd) ||
    windowEnd <= windowStart
  ) {
    return {
      status: "INVALID",
      reason_code: "INVALID_RANGE",
      blocking_block_ids: [],
      notes: ["Invalid availability window"],
    };
  }

  if (start < windowStart || end > windowEnd) {
    return {
      status: "OUTSIDE_WINDOW",
      reason_code: "OUTSIDE_BOOKING_RULES",
      blocking_block_ids: [],
      notes: ["Proposed slot is outside requested availability window"],
    };
  }

  const blockingBlocks = blocks.filter((block) => {
    if (block.kind !== "BUSY" && block.kind !== "UNAVAILABLE") {
      return false;
    }

    return overlaps(start, end, toMs(block.start_at), toMs(block.end_at));
  });

  if (blockingBlocks.length === 0) {
    return {
      status: "AVAILABLE",
      reason_code: "OK",
      blocking_block_ids: [],
      notes: [],
    };
  }

  const primaryBlock = blockingBlocks[0];

  return {
    status: "CONFLICT",
    reason_code: mapConflictReason(primaryBlock.source),
    blocking_block_ids: blockingBlocks.map((block) => block.id),
    notes: [`Conflicts with ${primaryBlock.source}`],
  };
}

export async function getAvailabilityContext(
  input: AvailabilityServiceInput,
  adapters?: AvailabilitySourceAdapter[]
): Promise<AvailabilityContext> {
  const timezone = normalizeTimezone(input);
  const activeAdapters =
    adapters && adapters.length > 0 ? adapters : getDefaultAdapters();

  const sourceSummaries: AvailabilitySourceSummary[] = [];
  const collectedBlocks: AvailabilityBlock[] = [];

  for (const adapter of activeAdapters) {
    try {
      const blocks = await adapter.getBlocks({
        ...input,
        timezone,
      });

      collectedBlocks.push(...blocks);

      sourceSummaries.push({
        source: adapter.kind,
        ok: true,
        block_count: blocks.length,
        warning: null,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown availability source error";

      sourceSummaries.push({
        source: adapter.kind,
        ok: false,
        block_count: 0,
        warning: message,
      });
    }
  }

  const normalizedBlocks = normalizeBlocks(collectedBlocks);
  const decision = evaluateProposedSlot(input, normalizedBlocks);

  return {
    app_user_id: input.app_user_id,
    timezone,
    window_start: input.window_start,
    window_end: input.window_end,
    blocks: normalizedBlocks,
    source_summaries: sourceSummaries,
    decision,
  };
}