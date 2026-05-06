/**
 * Quarterback Health brand layer — shared tokens, fonts, and the
 * default bottom-nav config consumed by BrandShell.
 *
 * Anything page-level (BrandShell, GlassCard, IconTile, SectionLabel,
 * Wordmark) is exported from this folder so individual page files
 * import once and stay consistent.
 */

export const T = {
  navy: "#061225",
  navySurface: "#081A33",
  cardNavy: "#0B2545",
  electric: "#1677FF",
  royal: "#006BFF",
  glow: "#2E8CFF",
  green: "#27C46B",
  warn: "#E08A1F",
  red: "#E04030",
  lightBg: "#FAF8F4",
  white: "#FFFFFF",
  lightBorder: "#E5EAF2",
  lightText: "#071832",
  lightMuted: "#4F5F73",
  darkText: "#FFFFFF",
  darkMuted: "#C9D6EA",
};

export type BrandMode = "light" | "dark";

export function brandTheme(mode: BrandMode) {
  const dark = mode === "dark";
  return {
    bg: dark ? T.navy : T.lightBg,
    glassBg: dark ? "rgba(11,37,69,0.65)" : "rgba(255,255,255,0.85)",
    border: dark ? "rgba(46,140,255,0.14)" : T.lightBorder,
    text: dark ? T.darkText : T.lightText,
    muted: dark ? T.darkMuted : T.lightMuted,
    inputBg: dark ? "rgba(11,37,69,0.7)" : T.white,
    inputBorder: dark ? "rgba(201,214,234,0.18)" : T.lightBorder,
    shadow: dark
      ? "0 8px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(46,140,255,0.08)"
      : "0 4px 18px rgba(7,24,50,0.06)",
    tileBg: dark ? "rgba(46,140,255,0.18)" : "rgba(22,119,255,0.10)",
  };
}

export type NavKey = "home" | "timeline" | "documents" | "kate" | "you";

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
};

// Default 5-tab bottom nav. Pages can override per-screen but most
// authed surfaces just use this set.
//
// Documents replaced Insights in the bottom slot per the reviewer:
// medical records / labs / EOBs is a primary navigation surface, and
// the Insights tile (which routed to /goals) was a misnomer that
// will be replaced by a proper Insights view in a follow-up.
export const DEFAULT_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/dashboard" },
  { key: "timeline", label: "Timeline", href: "/timeline" },
  { key: "documents", label: "Documents", href: "/documents" },
  { key: "kate", label: "Kate", href: "/kate" },
  { key: "you", label: "You", href: "/account" },
];
