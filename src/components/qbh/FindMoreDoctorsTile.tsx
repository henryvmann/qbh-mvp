"use client";

/**
 * "Find my other doctors" — dashboard tile that pitches the
 * bank/calendar connect flows AFTER the user has landed on the
 * dashboard and seen their first manually-added doctor. F&F
 * feedback was that the bank ask in the middle of onboarding
 * landed before users saw any value. This tile is the new home
 * for that pitch: small, dismissible, framed as "I can find the
 * rest" rather than "I need access to your finances".
 *
 * Visibility rules:
 *   - hides when there is ANY provider sourced from plaid or
 *     calendar (the user is already pulling from a connected
 *     source — no upsell needed).
 *   - hides when user dismisses it (localStorage key).
 *   - hides while loading so it doesn't flash in/out.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { T } from "../brand";
import { Building2, Calendar, X } from "lucide-react";

const DISMISSED_KEY = "qbh_find_more_doctors_dismissed";

type Snapshot = {
  provider: { source?: string | null };
};

export default function FindMoreDoctorsTile() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [hasConnectedSource, setHasConnectedSource] = useState<boolean | null>(null);
  const [bankBusy, setBankBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  useEffect(() => {
    apiFetch("/api/dashboard/data")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.ok) return setHasConnectedSource(false);
        const has = Array.isArray(d.snapshots) && d.snapshots.some((s: Snapshot) =>
          s.provider?.source === "plaid" || s.provider?.source === "calendar"
        );
        setHasConnectedSource(has);
      })
      .catch(() => setHasConnectedSource(false));
  }, []);

  if (dismissed === null || hasConnectedSource === null) return null;
  if (dismissed || hasConnectedSource) return null;

  function handleDismiss() {
    try { window.localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
    setDismissed(true);
  }

  async function handleConnectBank() {
    if (bankBusy) return;
    setBankBusy(true);
    try {
      // Plaid Link is wired in the existing /account page. Send the
      // user there so they get the full security framing on first
      // bank connect.
      router.push("/account?connect=bank");
    } finally {
      setBankBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "relative",
        background: "linear-gradient(135deg, rgba(22,119,255,0.06), rgba(22,119,255,0.02))",
        border: `1px solid rgba(22,119,255,0.20)`,
        borderRadius: 16,
        padding: 16,
        marginBottom: 18,
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          background: "transparent",
          border: "none",
          color: T.lightMuted,
          cursor: "pointer",
          padding: 4,
          lineHeight: 0,
        }}
      >
        <X size={14} />
      </button>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.electric, marginBottom: 4 }}>
        Let me find the rest
      </div>
      <p style={{ fontSize: 13, color: T.lightText, lineHeight: 1.45, marginBottom: 12 }}>
        I can pull in your other doctors automatically. Connect a bank or calendar and I&rsquo;ll surface providers you&rsquo;ve paid or scheduled with.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          type="button"
          onClick={handleConnectBank}
          disabled={bankBusy}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "10px 12px",
            borderRadius: 10,
            background: T.electric,
            color: "white",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: bankBusy ? "default" : "pointer",
            opacity: bankBusy ? 0.7 : 1,
          }}
        >
          <Building2 size={14} />
          Connect bank
        </button>
        <button
          type="button"
          onClick={() => router.push("/calendar-connect")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "10px 12px",
            borderRadius: 10,
            background: "white",
            color: T.electric,
            border: `1px solid ${T.electric}`,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Calendar size={14} />
          Connect calendar
        </button>
      </div>

      <p style={{ fontSize: 10.5, color: T.lightMuted, marginTop: 10, textAlign: "center" }}>
        Read-only · encrypted · never stored, never sold
      </p>
    </div>
  );
}
