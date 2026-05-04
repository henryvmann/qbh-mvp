/**
 * Legacy theme tokens — now mapped to the v5 brand palette so any
 * remaining importers (onboarding, internal pages) automatically pick
 * up the brand without per-file edits. The shape of the export is
 * preserved for back-compat; values are realigned to brand tokens.
 *
 * For new code, prefer importing from `src/components/brand/` directly.
 */

export const theme = {
  // Background — solid cream (brand light bg).
  bgGradient: "#FAF8F4",
  bgSolid: "#FAF8F4",

  // Card surfaces — solid white over cream reads cleaner than the
  // legacy 55% glass-on-greenhouse pattern.
  glass: "#FFFFFF",
  glassBorder: "#E5EAF2",
  glassHover: "#FFFFFF",
  cardShadow: "0 4px 18px rgba(7,24,50,0.06)",

  // Primary colors — electric blue family.
  green: "#1677FF",       // legacy "primary" — now electric
  greenLight: "#2E8CFF",  // legacy "primary-light" — now glow
  teal: "#1677FF",
  gold: "#27C46B",        // legacy "secondary" — now brand green

  // Text
  textPrimary: "#071832",
  textSecondary: "#4F5F73",
  textMuted: "#4F5F73",

  // Status
  statusOverdue: "#E04030",
  statusOnTrack: "#27C46B",
  statusUpcoming: "#2E8CFF",
  statusRecurring: "#7C3AED",

  // Grid overlay — kept as no-op tokens so the legacy code path
  // doesn't crash. Old greenhouse grid is intentionally invisible.
  gridOpacity: 0,
  gridTeal: "transparent",
  gridGold: "transparent",
  gridSize: "100px",
} as const;

/** Legacy CSS string — retained for back-compat, returns no-op CSS. */
export const gridOverlayCSS = `position: fixed; inset: 0; pointer-events: none;`;

/** Legacy card-override CSS — retained as a near-empty string so
 *  PageShell's old `<style>{globalCardOverrides}</style>` injection
 *  doesn't break if any code path still references it. The current
 *  PageShell delegates to BrandShell and doesn't use this. */
export const globalCardOverrides = ``;
