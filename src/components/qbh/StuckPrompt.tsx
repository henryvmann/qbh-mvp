"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { T } from "../brand";

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
        padding: "4px 10px",
        borderRadius: 999,
        background: "transparent",
        color: T.lightMuted,
        border: `1px solid ${T.lightBorder}`,
        fontSize: 11.5,
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
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
};

type PausedMap = Record<string, { until: string; kind: string }>;

type Props = {
  snapshots: Snapshot[];
  pausedProviders: PausedMap;
  introducedIds?: string[];
  onChange: () => void;
};

// Surfaces a soft Kate-styled card when one or more providers have been
// waiting on a follow-up and aren't currently paused. Four buttons that
// match the user's actual psychological states:
//   - Help me break it down (collaborative)
//   - Tell me what would help (open ended, user-led)
//   - Not today (24h pause)
//   - I've got it (30 day pause)
// No shame language, no urgency, no "overdue" framing.
export default function StuckPrompt({ snapshots, pausedProviders, introducedIds, onChange }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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
      // Pause every stuck provider so the prompt clears as a whole,
      // not just for one. The user can re-engage individually later.
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

  function openKate(prompt: "stuck" | "help") {
    // Navigate to Kate chat with context. Kate's system prompt knows
    // how to handle these prefill keys.
    const qs = new URLSearchParams();
    qs.set("prefill", prompt);
    qs.set("provider_id", lead.provider.id);
    qs.set("provider_name", lead.provider.name);
    router.push(`/kate?${qs.toString()}`);
  }

  function bookNow() {
    // Drop the user on the provider's detail page where the Handle It
    // button + timing/reason form already lives. ?action=book opens
    // the form on mount so it's one tap from "yes book it" to ringing.
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
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={bookNow}
              disabled={busy}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: T.electric,
                color: T.white,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Book it now
            </button>
            <button
              type="button"
              onClick={() => openKate("help")}
              disabled={busy}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: "white",
                color: T.lightText,
                border: `1px solid ${T.lightBorder}`,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Tell me what would help
            </button>
          </div>

          {/* Snooze options — quieter, secondary actions. The user picks
              the cadence that matches their state without primary visual
              weight. */}
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.lightMuted, marginRight: 4 }}>or</span>
            <SnoozeChip label="not today" onClick={() => pause("not_today")} disabled={busy} />
            <SnoozeChip label="remind me in a few days" onClick={() => pause("few_days")} disabled={busy} />
            <SnoozeChip label="I&rsquo;ve got it" onClick={() => pause("until_done")} disabled={busy} />
            <SnoozeChip label="don&rsquo;t remind me about this again" onClick={() => pause("forever")} disabled={busy} />
          </div>
        </div>
      </div>
    </div>
  );
}
