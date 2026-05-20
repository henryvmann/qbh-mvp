"use client";

/**
 * Tiny footer with Terms + Privacy links. Required by counsel
 * (Comment #0 on the Terms of Use) — "include a link to these terms
 * and your privacy policy in the footer on every page of your
 * website." Lives inside BrandShell + login + onboarding so the
 * coverage is universal.
 *
 * Keep it small. On authed pages the bottom-nav already eats vertical
 * space; this footer renders ABOVE the bottom nav as muted text.
 */

import Link from "next/link";
import { T, type BrandMode, brandTheme } from "./index";

// Cookiebot exposes a renew() helper that reopens its consent
// banner so the user can change tracking preferences. The script is
// loaded globally in src/app/layout.js — by the time the footer is
// interactive, window.Cookiebot is defined.
function openCookieSettings() {
  const cb = (window as unknown as { Cookiebot?: { renew?: () => void } }).Cookiebot;
  if (cb && typeof cb.renew === "function") {
    cb.renew();
  } else {
    // Fallback if Cookiebot didn't load (ad-blocker, etc.)
    window.location.href = "/privacy";
  }
}

export default function LegalFooter({
  mode = "light",
  withBottomPad = false,
}: {
  mode?: BrandMode;
  /** Add bottom padding to clear the BottomNav. Set true when used inside BrandShell. */
  withBottomPad?: boolean;
}) {
  const t = brandTheme(mode);
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        width: "100%",
        padding: withBottomPad ? "20px 22px 96px" : "20px 22px 24px",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: 14,
        fontSize: 11.5,
        color: t.muted,
        borderTop: `1px solid ${t.border}`,
        marginTop: 32,
      }}
    >
      <span>© {year} Quarterback Health</span>
      <span aria-hidden style={{ opacity: 0.6 }}>·</span>
      <Link href="/privacy" style={{ color: t.muted, textDecoration: "none" }}>
        Privacy
      </Link>
      <span aria-hidden style={{ opacity: 0.6 }}>·</span>
      <Link href="/terms" style={{ color: t.muted, textDecoration: "none" }}>
        Terms
      </Link>
      <span aria-hidden style={{ opacity: 0.6 }}>·</span>
      <button
        type="button"
        onClick={openCookieSettings}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          font: "inherit",
          color: t.muted,
          cursor: "pointer",
        }}
      >
        Cookie settings
      </button>
    </footer>
  );
}

// Re-export T for ergonomic imports.
export { T };
