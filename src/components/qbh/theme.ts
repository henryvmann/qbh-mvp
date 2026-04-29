/**
 * Greenhouse 3026 — shared design tokens
 *
 * All pages import from here. Changing these values
 * updates the entire app's visual language.
 */

export const theme = {
  // Background gradient
  bgGradient: "linear-gradient(180deg, #CDDBD6 0%, #DDD8D0 35%, #ECEAE6 100%)",
  bgSolid: "#ECEAE6",

  // Card surfaces
  glass: "rgba(255,255,255,0.55)",
  glassBorder: "rgba(255,255,255,0.7)",
  glassHover: "rgba(255,255,255,0.72)",
  cardShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",

  // Primary colors
  green: "#4A6B4A",
  greenLight: "#5C7B5C",
  teal: "#0FA5A5",
  gold: "#D4A44C",

  // Text
  textPrimary: "#1A2E1A",
  textSecondary: "#7A7F8A",
  textMuted: "#B0B4BC",

  // Status
  statusOverdue: "#E04030",
  statusOnTrack: "#4A6B4A",
  statusUpcoming: "#D4A44C",
  statusRecurring: "#7C3AED",

  // Grid overlay — softened for readability (Jenny called the original
  // teal/gold grid hard to read against the glass cards). Use a single
  // muted gray-green for both axes at low opacity so it reads as texture,
  // not pattern.
  gridOpacity: 0.025,
  gridTeal: "#9CA8A0",
  gridGold: "#9CA8A0",
  gridSize: "100px",
} as const;

/** CSS string for the greenhouse grid overlay */
export const gridOverlayCSS = `
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: ${theme.gridOpacity};
  background-image:
    linear-gradient(${theme.gridTeal} 1px, transparent 1px),
    linear-gradient(90deg, ${theme.gridGold} 1px, transparent 1px);
  background-size: ${theme.gridSize} ${theme.gridSize};
`;

/** Global CSS overrides for child components that use old-style classes */
export const globalCardOverrides = `
  .greenhouse .rounded-2xl.bg-white,
  .greenhouse .bg-white.shadow-sm,
  .greenhouse .bg-white.border,
  .greenhouse section.bg-white {
    background: ${theme.glass} !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border-color: ${theme.glassBorder} !important;
    box-shadow: ${theme.cardShadow} !important;
  }
  .greenhouse .bg-white {
    background: rgba(255,255,255,0.45) !important;
  }
  .greenhouse .bg-\\[\\#F4F5F7\\],
  .greenhouse .bg-\\[\\#F0F2F5\\] {
    background: rgba(255,255,255,0.3) !important;
  }
  .greenhouse .border-\\[\\#EBEDF0\\] {
    border-color: rgba(255,255,255,0.5) !important;
  }
  .greenhouse .shadow-sm {
    box-shadow: ${theme.cardShadow} !important;
  }
`;
