// src/lib/QBH/format.ts

/**
 * Display-only formatting helpers.
 * Goal: avoid “3/9” style dates and keep consistent, readable UI.
 * No booking logic here.
 */

export function formatMonthDay(iso: string, tz?: string): string {
  const d = safeDate(iso);
  // e.g. "March 9"
  return d.toLocaleDateString("en-US", {
    timeZone: tz,
    month: "long",
    day: "numeric",
  });
}

export function formatMonthDayYear(iso: string, tz?: string): string {
  const d = safeDate(iso);
  // e.g. "March 9, 2026"
  return d.toLocaleDateString("en-US", {
    timeZone: tz,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string, tz?: string): string {
  const d = safeDate(iso);
  // e.g. "1:00 PM"
  return d.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string, tz?: string): string {
  // e.g. "March 9 at 1:00 PM"
  return `${formatMonthDay(iso, tz)} at ${formatTime(iso, tz)}`;
}

export function formatDateRange(
  startIso: string,
  endIso: string,
  tz?: string
): string {
  // e.g. "March 9 at 1:00 PM – 1:30 PM"
  return `${formatMonthDay(startIso, tz)} at ${formatTime(
    startIso,
    tz
  )} – ${formatTime(endIso, tz)}`;
}

/**
 * Internal: ensure we always have a valid Date object.
 * If iso is empty/invalid, we return an "Invalid Date" Date
 * but callers can still render safely with fallbacks if desired.
 */
function safeDate(iso: string): Date {
  const s = String(iso ?? "").trim();
  return new Date(s);
}