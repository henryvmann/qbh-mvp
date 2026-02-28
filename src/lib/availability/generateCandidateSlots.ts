// src/lib/availability/generateCandidateSlots.ts

export type CandidateSlot = { start: string; end: string };

type Options = {
  timezoneOffsetMinutes: number; // e.g. -300 for America/New_York (EST/EDT not handled yet)
  businessStartHour: number;     // local hour, e.g. 9
  businessEndHour: number;       // local hour, e.g. 17 (end boundary)
  slotMinutes: number;           // 30
  count: number;                 // 3
};

function toIsoWithOffset(d: Date, offsetMinutes: number): string {
  // Convert UTC ms -> local wall time by applying offset, then format with offset suffix.
  const localMs = d.getTime() + offsetMinutes * 60_000;
  const local = new Date(localMs);

  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = local.getUTCFullYear();
  const mm = pad(local.getUTCMonth() + 1);
  const dd = pad(local.getUTCDate());
  const hh = pad(local.getUTCHours());
  const mi = pad(local.getUTCMinutes());
  const ss = pad(local.getUTCSeconds());

  const sign = offsetMinutes <= 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const offH = pad(Math.floor(abs / 60));
  const offM = pad(abs % 60);

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${offH}:${offM}`;
}

function isWeekendLocal(dUtc: Date, offsetMinutes: number): boolean {
  const localMs = dUtc.getTime() + offsetMinutes * 60_000;
  const local = new Date(localMs);
  const day = local.getUTCDay(); // 0 Sun .. 6 Sat (in local wall time because we shifted)
  return day === 0 || day === 6;
}

function setLocalTime(
  dUtc: Date,
  offsetMinutes: number,
  hour: number,
  minute: number
): Date {
  // Interpret dUtc as UTC instant; convert to local wall date, set hh:mm, then convert back to UTC instant.
  const localMs = dUtc.getTime() + offsetMinutes * 60_000;
  const local = new Date(localMs);

  const yyyy = local.getUTCFullYear();
  const mm = local.getUTCMonth();
  const dd = local.getUTCDate();

  const localWall = new Date(Date.UTC(yyyy, mm, dd, hour, minute, 0, 0));
  const backToUtcMs = localWall.getTime() - offsetMinutes * 60_000;
  return new Date(backToUtcMs);
}

export function generateCandidateSlots(nowUtc: Date, opts: Options): CandidateSlot[] {
  const {
    timezoneOffsetMinutes,
    businessStartHour,
    businessEndHour,
    slotMinutes,
    count,
  } = opts;

  // Deterministic rounding: start from next slot boundary (e.g. next :00 or :30)
  const rounded = new Date(nowUtc.getTime());
  rounded.setUTCSeconds(0, 0);

  const minutes = rounded.getUTCMinutes();
  const remainder = minutes % slotMinutes;
  if (remainder !== 0) {
    rounded.setUTCMinutes(minutes + (slotMinutes - remainder));
  }

  const slots: CandidateSlot[] = [];
  let cursor = new Date(rounded.getTime());

  while (slots.length < count) {
    // Skip weekends (local)
    if (isWeekendLocal(cursor, timezoneOffsetMinutes)) {
      // Move to next day at business start
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
      cursor = setLocalTime(cursor, timezoneOffsetMinutes, businessStartHour, 0);
      continue;
    }

    const dayStart = setLocalTime(cursor, timezoneOffsetMinutes, businessStartHour, 0);
    const dayEnd = setLocalTime(cursor, timezoneOffsetMinutes, businessEndHour, 0);

    // If cursor before business hours, clamp to start
    if (cursor < dayStart) cursor = new Date(dayStart.getTime());

    // If cursor is at/after end boundary, move to next day business start
    if (cursor >= dayEnd) {
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
      cursor = setLocalTime(cursor, timezoneOffsetMinutes, businessStartHour, 0);
      continue;
    }

    const end = new Date(cursor.getTime() + slotMinutes * 60_000);

    // Ensure slot fits within business hours end boundary
    if (end <= dayEnd) {
      slots.push({
        start: toIsoWithOffset(cursor, timezoneOffsetMinutes),
        end: toIsoWithOffset(end, timezoneOffsetMinutes),
      });
    }

    cursor = new Date(cursor.getTime() + slotMinutes * 60_000);
  }

  return slots;
}