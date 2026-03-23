import { getAvailabilityContext } from ".";

export type BusyBlock = {
  start: string;
  end: string;
};

export type AvailabilityCheckResult = {
  isAvailable: boolean;
  conflictingBlocks: BusyBlock[];
};

function toBusyBlocksFromConflicts(
  blockingBlockIds: string[],
  blocks: Array<{
    id: string;
    start_at: string;
    end_at: string;
  }>
): BusyBlock[] {
  const blockingIds = new Set(blockingBlockIds);

  return blocks
    .filter((block) => blockingIds.has(block.id))
    .map((block) => ({
      start: block.start_at,
      end: block.end_at,
    }));
}

/**
 * Compatibility wrapper.
 *
 * Canonical scheduling logic now lives in:
 *   src/lib/availability/index.ts
 *
 * This adapter preserves the old function contract for any remaining callers,
 * but delegates the actual overlap decision to the canonical availability service.
 */
export async function getSlotAvailability(
  slotStart: string,
  slotEnd: string,
  busyBlocks: BusyBlock[]
): Promise<AvailabilityCheckResult> {
  const context = await getAvailabilityContext(
    {
      app_user_id: "compatibility-wrapper",
      window_start: slotStart,
      window_end: slotEnd,
      timezone: "America/New_York",
      include_sources: [],
      proposed_slot: {
        start_at: slotStart,
        end_at: slotEnd,
        timezone: "America/New_York",
      },
    },
    [
      {
        kind: "GOOGLE_CALENDAR",
        async getBlocks() {
          return (busyBlocks || []).map((block, index) => ({
            id: `compat_busy_block_${index}`,
            kind: "BUSY" as const,
            source: "GOOGLE_CALENDAR" as const,
            start_at: block.start,
            end_at: block.end,
            timezone: "America/New_York",
            confidence: "HIGH" as const,
            title: null,
            provider_id: null,
            integration_id: null,
            metadata: {
              compatibility_wrapper: true,
            },
          }));
        },
      },
    ]
  );

  const blockingBlockIds = context.decision?.blocking_block_ids ?? [];

  return {
    isAvailable: context.decision?.status === "AVAILABLE",
    conflictingBlocks: toBusyBlocksFromConflicts(
      blockingBlockIds,
      context.blocks
    ),
  };
}

export async function isTimeSlotAvailable(
  slotStart: string,
  slotEnd: string,
  busyBlocks: BusyBlock[]
): Promise<boolean> {
  const result = await getSlotAvailability(slotStart, slotEnd, busyBlocks);
  return result.isAvailable;
}