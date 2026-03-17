// src/lib/QBH/format.ts

/**
 * Display-only formatting helpers.
 * Goal: avoid “3/9” style dates and keep consistent, readable UI.
 * No booking logic here.
 */

const QBH_FALLBACK_TIMEZONE = "America/New_York";

function resolvedTimezone(tz?: string): string {
  const s = String(tz ?? "").trim();
  return s || QBH_FALLBACK_TIMEZONE;
}

export function formatMonthDay(iso: string, tz?: string): string {
  const d = safeDate(iso);

  return d.toLocaleDateString("en-US", {
    timeZone: resolvedTimezone(tz),
    month: "long",
    day: "numeric",
  });
}

export function formatMonthDayYear(iso: string, tz?: string): string {
  const d = safeDate(iso);

  return d.toLocaleDateString("en-US", {
    timeZone: resolvedTimezone(tz),
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string, tz?: string): string {
  const d = safeDate(iso);

  return d.toLocaleTimeString("en-US", {
    timeZone: resolvedTimezone(tz),
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string, tz?: string): string {
  return `${formatMonthDay(iso, tz)} at ${formatTime(iso, tz)}`;
}

export function formatDateRange(
  startIso: string,
  endIso: string,
  tz?: string
): string {
  return `${formatMonthDay(startIso, tz)} at ${formatTime(
    startIso,
    tz
  )} – ${formatTime(endIso, tz)}`;
}

/**
 * Internal: ensure we always have a valid Date object.
 */
function safeDate(iso: string): Date {
  const s = String(iso ?? "").trim();
  return new Date(s);
}