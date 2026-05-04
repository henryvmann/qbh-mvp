"use client";

/**
 * TopNav — brand-aligned sticky header.
 *
 * Pages that import <TopNav /> directly (instead of wrapping in
 * PageShell) now get the same chrome as BrandShell: cream/glass
 * background, "Quarterback Health" Fraunces wordmark with two-tone
 * coloring, hamburger menu on the left containing all nav links plus
 * settings/account/logout, user avatar on the right.
 *
 * No more dark-navy bar. Old NAV_LINKS still surfaced via the
 * hamburger so users on these pages can still navigate.
 */

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";
import Wordmark from "../brand/Wordmark";
import { T } from "../brand";

const NAV_LINKS = [
  { label: "Home", href: "/dashboard" },
  { label: "Providers", href: "/providers" },
  { label: "Visits", href: "/visits" },
  { label: "Calendar", href: "/calendar-view" },
  { label: "Timeline", href: "/timeline" },
  { label: "Goals", href: "/goals" },
  { label: "Insights", href: "/analytics" },
];

const SECONDARY_LINKS = [
  { label: "Settings", href: "/settings" },
  { label: "Account", href: "/account" },
  { label: "Documents", href: "/documents" },
  { label: "Recordings", href: "/recordings" },
  { label: "Medications", href: "/medications" },
];

export default function TopNav() {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "rgba(250,248,244,0.85)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        borderBottom: `1px solid ${T.lightBorder}`,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "14px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* Hamburger + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "none",
              background: menuOpen ? T.lightBorder : "transparent",
              color: T.lightText,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 4h12M2 8h12M2 12h12" />
              </svg>
            )}
          </button>

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: "100%",
                marginTop: 8,
                width: 220,
                background: "rgba(255,255,255,0.97)",
                backdropFilter: "blur(20px) saturate(140%)",
                WebkitBackdropFilter: "blur(20px) saturate(140%)",
                border: `1px solid ${T.lightBorder}`,
                borderRadius: 14,
                boxShadow: "0 12px 32px rgba(7,24,50,0.14)",
                padding: "8px 0",
                zIndex: 50,
              }}
            >
              {NAV_LINKS.map((l) => {
                const active = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(l.href));
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: "block",
                      padding: "9px 16px",
                      fontSize: 14,
                      fontWeight: active ? 600 : 500,
                      color: active ? T.electric : T.lightText,
                      textDecoration: "none",
                    }}
                  >
                    {l.label}
                  </Link>
                );
              })}
              <div style={{ borderTop: `1px solid ${T.lightBorder}`, margin: "6px 0" }} />
              {SECONDARY_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "9px 16px",
                    fontSize: 13,
                    color: T.lightMuted,
                    textDecoration: "none",
                  }}
                >
                  {l.label}
                </Link>
              ))}
              <div style={{ borderTop: `1px solid ${T.lightBorder}`, margin: "6px 0" }} />
              <button
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                disabled={loggingOut}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: T.red,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  opacity: loggingOut ? 0.5 : 1,
                }}
              >
                {loggingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          )}

          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <Wordmark size={19} />
          </Link>
        </div>

        {/* User avatar — right side */}
        <Link
          href="/account"
          style={{
            display: "block",
            width: 36,
            height: 36,
            borderRadius: 18,
            overflow: "hidden",
            border: `1.5px solid ${T.lightBorder}`,
            flexShrink: 0,
          }}
        >
          <Image
            src="/kate-avatar.png"
            alt="Account"
            width={36}
            height={36}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Link>
      </div>
    </header>
  );
}
