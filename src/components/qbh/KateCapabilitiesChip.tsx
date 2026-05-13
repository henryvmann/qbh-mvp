"use client";

/**
 * Persistent "What can Kate do?" chip. Always available, never
 * required — tap to open a slide-in panel that lists Kate's
 * capabilities with concrete "Try it" links to the right surface.
 *
 * Sits beside other dashboard chrome so users who skipped or
 * dismissed the welcome card can still get the overview when
 * they want it.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { T } from "../brand";

type Capability = {
  title: string;
  body: string;
  href: string;
  cta: string;
};

const CAPABILITIES: Capability[] = [
  {
    title: "Book appointments by phone",
    body: "Kate calls offices, handles IVRs, and confirms times with the receptionist. You approve, she dials.",
    href: "/providers",
    cta: "See your providers",
  },
  {
    title: "Prep you for visits",
    body: "Before any appointment, Kate pulls together what to bring, recent notes, and questions worth asking.",
    href: "/visits",
    cta: "Check upcoming visits",
  },
  {
    title: "Track and explain coverage",
    body: "Upload an EOB and Kate breaks down what you owe and why. Soon she'll pull claims directly.",
    href: "/coverage",
    cta: "Open Coverage",
  },
  {
    title: "Organize records and labs",
    body: "Drop in any document — lab result, visit summary, prescription — and Kate summarizes and files it.",
    href: "/documents",
    cta: "Upload a document",
  },
  {
    title: "Call your pharmacy for refills",
    body: "Add your prescriptions and Kate handles refill calls, transfers, and pickup reminders.",
    href: "/medications",
    cta: "Manage medications",
  },
  {
    title: "Track what's open across your care",
    body: "Kate watches for overdue visits, missed follow-ups, and screenings due — and nudges you when it matters.",
    href: "/timeline",
    cta: "See your timeline",
  },
  {
    title: "Talk it out",
    body: "Anything on your mind — confusing bill, decision you're stuck on, what's next — just ask.",
    href: "/kate",
    cta: "Open chat",
  },
];

export default function KateCapabilitiesChip() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          background: "white",
          border: `1px solid ${T.lightBorder}`,
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          color: T.lightText,
          cursor: "pointer",
        }}
      >
        <Sparkles size={12} color={T.electric} />
        What can Kate do?
      </button>

      {open && mounted && createPortal(
        <>
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
          <aside
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(92vw, 420px)",
              background: T.lightBg,
              borderLeft: `1px solid ${T.lightBorder}`,
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 32px rgba(7,24,50,0.18)",
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
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: T.electric,
                  }}
                >
                  Kate&rsquo;s capabilities
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.lightText, marginTop: 2 }}>
                  What can Kate do?
                </div>
              </div>
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.lightMuted,
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>
              {CAPABILITIES.map((c) => (
                <div
                  key={c.title}
                  style={{
                    background: "white",
                    border: `1px solid ${T.lightBorder}`,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.lightText, marginBottom: 4 }}>
                    {c.title}
                  </div>
                  <p style={{ fontSize: 13, color: T.lightMuted, lineHeight: 1.5, margin: 0 }}>
                    {c.body}
                  </p>
                  <Link
                    href={c.href}
                    onClick={() => setOpen(false)}
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: T.electric,
                      textDecoration: "none",
                    }}
                  >
                    {c.cta} →
                  </Link>
                </div>
              ))}
            </div>
          </aside>
        </>,
        document.body
      )}
    </>
  );
}
