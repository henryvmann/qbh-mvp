"use client";

/**
 * Hamburger menu — slide-in drawer with every authed route in QBH.
 * Lives in the top-left of every PageShell page so secondary
 * surfaces (Providers, Visits, Caregivers, etc.) are reachable from
 * anywhere, not just the dashboard tiles. The bottom nav still owns
 * the 5 primary tabs (Home / Timeline / Documents / Kate / You).
 *
 * The reviewer specifically asked for this — said the hamburger
 * disappeared on /visits and she had to use browser back to escape.
 * Now it's pinned to the top app bar globally.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Plus, Minus } from "lucide-react";
import { T } from "../brand";

type Group = {
  label: string;
  items: { label: string; href: string; description?: string }[];
};

const NAV_GROUPS: Group[] = [
  {
    // Active healthcare surfaces — the things the user manages
    // directly. Order from most-used to least.
    label: "Care",
    items: [
      { label: "Providers", href: "/providers", description: "Your care team" },
      { label: "Visits", href: "/visits", description: "Upcoming & past" },
      { label: "Medications", href: "/medications", description: "Refills and prescriptions" },
      { label: "Portals", href: "/portals", description: "Connect medical records (preview)" },
      { label: "Coverage", href: "/coverage", description: "Insurance & claims (preview)" },
      { label: "Documents", href: "/documents", description: "Uploads, labs, EOBs" },
      { label: "Caregivers", href: "/caregivers", description: "People who help" },
    ],
  },
  {
    // Things Kate produces or the user observes — second tier.
    label: "Tracking",
    items: [
      { label: "Goals", href: "/goals", description: "Kate's read on your week + what to work on" },
      { label: "Notes", href: "/notes", description: "Visit notes and reminders" },
      { label: "Recordings", href: "/recordings", description: "Appointment recordings and summaries" },
    ],
  },
  {
    label: "You",
    items: [
      { label: "About me", href: "/intake", description: "Help Kate get to know you" },
      { label: "Account", href: "/account", description: "Profile and preferences" },
      { label: "Health Card", href: "/health-card" },
    ],
  },
];

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname() ?? "";
  // Collapsible sections — start all collapsed so the menu reads as a
  // calm short list of categories rather than a wall of links. The
  // active section auto-expands so the user can see where they are.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Portal target — wait for client-side mount before reading
  // document.body. SSR doesn't have a body to attach to.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // When the drawer opens, auto-expand whichever group contains the
  // current route. Leave the others collapsed so the user sees calm
  // category headers with a plus to drill into the rest.
  useEffect(() => {
    if (!open) return;
    const activeGroup = NAV_GROUPS.find((g) =>
      g.items.some((it) => pathname === it.href || pathname.startsWith(it.href + "/"))
    );
    if (activeGroup) setExpanded(new Set([activeGroup.label]));
    else setExpanded(new Set());
  }, [open, pathname]);

  // Lock body scroll while open. Without this the drawer slides
  // smoothly but the page scrolls behind it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "transparent",
          border: "none",
          color: T.lightText,
          cursor: "pointer",
        }}
      >
        <Menu size={22} />
      </button>

      {open && mounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(7,24,50,0.45)",
              zIndex: 99,
              backdropFilter: "blur(2px)",
            }}
          />

          {/* Drawer */}
          <aside
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: "min(86vw, 320px)",
              background: T.lightBg,
              borderRight: `1px solid ${T.lightBorder}`,
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              boxShadow: "8px 0 32px rgba(7,24,50,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 20px",
                borderBottom: `1px solid ${T.lightBorder}`,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: T.lightText, letterSpacing: 0.4 }}>
                Menu
              </span>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "transparent",
                  border: "none",
                  color: T.lightText,
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px 24px" }}>
              {NAV_GROUPS.map((group) => {
                const isOpen = expanded.has(group.label);
                const itemCount = group.items.length;
                return (
                  <div key={group.label} style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.label)) next.delete(group.label);
                          else next.add(group.label);
                          return next;
                        })
                      }
                      style={{
                        display: "flex",
                        width: "100%",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 10px",
                        background: "transparent",
                        border: "none",
                        borderRadius: 10,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: T.lightText,
                          letterSpacing: 0.2,
                        }}
                      >
                        {group.label}
                      </span>
                      <span
                        aria-hidden
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          background: "rgba(7,24,50,0.05)",
                          color: T.lightMuted,
                        }}
                      >
                        {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                      </span>
                      <span style={{ position: "absolute", left: -9999 }}>
                        {isOpen ? `Collapse ${group.label}` : `Expand ${group.label} (${itemCount} items)`}
                      </span>
                    </button>
                    {isOpen && (
                      <div style={{ paddingBottom: 4 }}>
                        {group.items.map((item) => {
                          const active = pathname === item.href || pathname.startsWith(item.href + "/");
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              style={{
                                display: "block",
                                padding: "10px 12px",
                                borderRadius: 10,
                                textDecoration: "none",
                                background: active ? "rgba(22,119,255,0.10)" : "transparent",
                                color: active ? T.electric : T.lightText,
                                marginBottom: 2,
                              }}
                            >
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                              {item.description && (
                                <div style={{ fontSize: 11, color: T.lightMuted, marginTop: 1 }}>
                                  {item.description}
                                </div>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </>,
        document.body
      )}
    </>
  );
}
