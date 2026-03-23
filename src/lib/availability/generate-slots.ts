import type { AvailabilityBlock, AvailabilityContext } from "./types";

export type GeneratedSlot = {
  start_at: string;
  end_at: string;
  timezone: string;
};

export type GenerateSlotsInput = {
  availability: AvailabilityContext;
  slot_minutes: number;
  max_results?: number;
  minimum_start_buffer_minutes?: number;
};

type TimeWindow = {
  startMs: number;
  endMs: number;
};

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function isBlockingBlock(block: AvailabilityBlock): boolean {
  return (
    block.kind === "BUSY" ||
    block.kind === "UNAVAILABLE" ||
    block.kind === "HOLD"
  );
}

function sortWindows(windows: TimeWindow[]): TimeWindow[] {
  return [...windows].sort((a, b) => {
    if (a.startMs !== b.startMs) {
      return a.startMs - b.startMs;
    }

    return a.endMs - b.endMs;
  });
}

function mergeWindows(windows: TimeWindow[]): TimeWindow[] {
  if (windows.length === 0) {
    return [];
  }

  const sorted = sortWindows(windows);
  const merged: TimeWindow[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function clipWindow(
  window: TimeWindow,
  rangeStartMs: number,
  rangeEndMs: number
): TimeWindow | null {
  const startMs = Math.max(window.startMs, rangeStartMs);
  const endMs = Math.min(window.endMs, rangeEndMs);

  if (endMs <= startMs) {
    return null;
  }

  return { startMs, endMs };
}

function buildBusyWindows(
  blocks: AvailabilityBlock[],
  rangeStartMs: number,
  rangeEndMs: number
): TimeWindow[] {
  const rawWindows: TimeWindow[] = [];

  for (const block of blocks) {
    if (!isBlockingBlock(block)) {
      continue;
    }

    const startMs = toMs(block.start_at);
    const endMs = toMs(block.end_at);

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      continue;
    }

    const clipped = clipWindow({ startMs, endMs }, rangeStartMs, rangeEndMs);

    if (clipped) {
      rawWindows.push(clipped);
    }
  }

  return mergeWindows(rawWindows);
}

function buildFreeWindows(
  rangeStartMs: number,
  rangeEndMs: number,
  busyWindows: TimeWindow[]
): TimeWindow[] {
  if (rangeEndMs <= rangeStartMs) {
    return [];
  }

  if (busyWindows.length === 0) {
    return [{ startMs: rangeStartMs, endMs: rangeEndMs }];
  }

  const freeWindows: TimeWindow[] = [];
  let cursor = rangeStartMs;

  for (const busy of busyWindows) {
    if (busy.startMs > cursor) {
      freeWindows.push({
        startMs: cursor,
        endMs: busy.startMs,
      });
    }

    cursor = Math.max(cursor, busy.endMs);
  }

  if (cursor < rangeEndMs) {
    freeWindows.push({
      startMs: cursor,
      endMs: rangeEndMs,
    });
  }

  return freeWindows;
}

function generateSlotsFromFreeWindows(params: {
  freeWindows: TimeWindow[];
  slotMs: number;
  maxResults: number;
  timezone: string;
}): GeneratedSlot[] {
  const { freeWindows, slotMs, maxResults, timezone } = params;
  const slots: GeneratedSlot[] = [];

  for (const window of freeWindows) {
    let startMs = window.startMs;

    while (startMs + slotMs <= window.endMs) {
      slots.push({
        start_at: toIso(startMs),
        end_at: toIso(startMs + slotMs),
        timezone,
      });

      if (slots.length >= maxResults) {
        return slots;
      }

      startMs += slotMs;
    }
  }

  return slots;
}

export function generateSlots(input: GenerateSlotsInput): GeneratedSlot[] {
  const {
    availability,
    slot_minutes,
    max_results = 3,
    minimum_start_buffer_minutes = 0,
  } = input;

  if (!Number.isFinite(slot_minutes) || slot_minutes <= 0) {
    throw new Error("slot_minutes must be a positive number");
  }

  if (!Number.isFinite(max_results) || max_results <= 0) {
    throw new Error("max_results must be a positive number");
  }

  if (
    !Number.isFinite(minimum_start_buffer_minutes) ||
    minimum_start_buffer_minutes < 0
  ) {
    throw new Error("minimum_start_buffer_minutes must be zero or greater");
  }

  const slotMs = slot_minutes * 60 * 1000;
  const bufferMs = minimum_start_buffer_minutes * 60 * 1000;

  const rangeStartMs = toMs(availability.window_start) + bufferMs;
  const rangeEndMs = toMs(availability.window_end);

  if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs)) {
    throw new Error("Invalid availability window");
  }

  if (rangeEndMs <= rangeStartMs) {
    return [];
  }

  const busyWindows = buildBusyWindows(
    availability.blocks,
    rangeStartMs,
    rangeEndMs
  );

  const freeWindows = buildFreeWindows(rangeStartMs, rangeEndMs, busyWindows);

  return generateSlotsFromFreeWindows({
    freeWindows,
    slotMs,
    maxResults: Math.floor(max_results),
    timezone: availability.timezone,
  });
}