"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { T } from "../brand";
import InlineKatePanel from "./InlineKatePanel";

function SnoozeChip({
  label,
  onClick,
  disabled,
}: {
  label: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: "white",
        color: T.lightText,
        border: `1px solid ${T.lightBorder}`,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        boxShadow: "0 1px 2px rgba(7,24,50,0.04)",
      }}
    >
      {label}
    </button>
  );
}

type Snapshot = {
  provider: { id: string; name: string };
  followUpNeeded?: boolean;
  booking_state?: { status?: string };
  lastVisitLabel?: string | null;
};

type PausedMap = Record<string, { until: string; kind: string }>;

type Props = {
  snapshots: Snapshot[];
  pausedProviders: PausedMap;
  introducedIds?: string[];
  onChange: () => void;
};

// Surfaces a soft Kate-styled card when one or more providers have been
// waiting on a follow-up. Two same-weight actions (Book / Talk to Kate)
// instead of one oversized primary, and snooze chips redesigned as
// clearly tappable controls rather than text links. "Tell me what would
// help" now opens an inline Kate panel right inside this card so the
// user stays on the dashboard.
export default function StuckPrompt({ snapshots, pausedProviders, introducedIds, onChange }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [katePanelOpen, setKatePanelOpen] = useState(false);

  // Stuck = follow-up needed AND not booked AND not paused AND not just
  // introduced via the walkthrough. The walkthrough is the one nudge a
  // provider gets — if the user tapped "skip for now" there, we don't
  // immediately re-prompt with the same provider in stuck framing.
  const stuck = useMemo(() => {
    const now = Date.now();
    const introducedSet = new Set(introducedIds || []);
    return snapshots.filter((s) => {
      if (!s.followUpNeeded) return false;
      const status = s.booking_state?.status;
      if (status === "BOOKED" || status === "IN_PROGRESS") return false;
      const paused = pausedProviders[s.provider.id];
      if (paused && Date.parse(paused.until) > now) return false;
      if (introducedSet.has(s.provider.id)) return false;
      return true;
    });
  }, [snapshots, pausedProviders, introducedIds]);

  if (stuck.length === 0) return null;

  // Surface the most-stuck one (first in list — dashboard order).
  // Mention "+ N others" without naming them so the card stays calm.
  const lead = stuck[0];
  const others = stuck.length - 1;

  async function pause(kind: "not_today" | "few_days" | "until_done" | "forever") {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.all(
        stuck.map((s) =>
          apiFetch("/api/providers/pause", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider_id: s.provider.id, kind }),
          })
        )
      );
      onChange();
    } finally {
      setBusy(false);
    }
  }

  function bookNow() {
    router.push(`/providers/${lead.provider.id}?action=book`);
  }

  return (
    <div
      style={{
        background: "rgba(22,119,255,0.06)",
        border: `1px solid rgba(22,119,255,0.18)`,
        borderRadius: 16,
        padding: 16,
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          aria-hidden
          style={{
            width: 4,
            alignSelf: "stretch",
            background: T.electric,
            borderRadius: 999,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: T.lightText, lineHeight: 1.45 }}>
            <strong>{lead.provider.name}</strong> has been on your list for a bit
            {others > 0 ? ` (and ${others} other${others > 1 ? "s" : ""})` : ""}. Anything getting in the way?
          </div>

          {/* Two-up action row: same weight on both so neither dominates
              visually. The earlier full-width primary + secondary stack
              made Book feel like the only "real" choice. */}
          {!katePanelOpen && (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={bookNow}
                disabled={busy}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: T.electric,
                  color: T.white,
                  border: "none",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Book it now
              </button>
              <button
                type="button"
                onClick={() => setKatePanelOpen(true)}
                disabled={busy}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "white",
                  color: T.lightText,
                  border: `1px solid ${T.lightBorder}`,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Tell me what would help
              </button>
            </div>
          )}

          {/* Inline Kate panel — replaces the action row while open so the
              user gets full focus on the conversation. Closing returns to
              the action row. */}
          {katePanelOpen && (
            <InlineKatePanel
              provider={lead.provider}
              recencyHint={lead.lastVisitLabel || null}
              onClose={() => setKatePanelOpen(false)}
            />
          )}

          {/* Snooze options. Collapsed to two cadences: "Not now"
              (24h pause) and "Don't remind me" (forever). The earlier
              four-chip set asked the user to reason about cadence
              gradations they don't actually care about. */}
          {!katePanelOpen && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.lightMuted, marginRight: 2 }}>or</span>
              <SnoozeChip label="Not now" onClick={() => pause("not_today")} disabled={busy} />
              <SnoozeChip label="Don&rsquo;t remind me" onClick={() => pause("forever")} disabled={busy} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
