"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { T } from "../brand";

type LastVisitCategory =
  | "just_visited"
  | "on_track"
  | "coming_due"
  | "overdue"
  | "needs_scheduling";

type Snapshot = {
  provider: { id: string; name: string; provider_type?: string | null };
  lastVisitDate?: string | null;
  lastVisitCategory?: LastVisitCategory | null;
  lastVisitLabel?: string | null;
  booking_state?: { status?: string };
};

type Props = {
  snapshots: Snapshot[];
  introducedIds: string[];
  onChange: () => void;
};

// Friendly time-ago helper that gives "3 weeks", "4 months", "2 years"
// based on the same date math the dashboard uses for lastVisitLabel.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!then) return "a while";
  const days = Math.max(0, Math.round((Date.now() - then) / 86400000));
  if (days < 14) return days <= 1 ? "yesterday" : `${days} days`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  const months = Math.round(days / 30);
  if (months < 18) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"}`;
}

function buildPrompt(snap: Snapshot) {
  const name = snap.provider.name;
  const cat = snap.lastVisitCategory || "needs_scheduling";
  const ago = snap.lastVisitDate ? timeAgo(snap.lastVisitDate) : null;
  const isPharmacy = (snap.provider.provider_type || "").toLowerCase() === "pharmacy";

  // Pharmacies don't get booked the same way doctors do — frame them
  // as stored on file, with Kate available to call about refills.
  if (isPharmacy) {
    return {
      headline: `${name}`,
      body: `I've saved this as your pharmacy. I can call them about refills or transfers whenever you need.`,
      tone: "pharmacy" as const,
    };
  }

  // "yesterday" is already a relative phrase — don't append "ago" to it.
  // Other durations (e.g. "3 days") need the suffix to read naturally.
  const seenPhrase = ago === "yesterday" ? "yesterday" : ago ? `${ago} ago` : null;

  if (cat === "needs_scheduling" || !seenPhrase) {
    return {
      headline: `${name}`,
      body: `I don't see a recent visit on file. Want me to set something up?`,
      tone: "action" as const,
    };
  }
  if (cat === "just_visited" || cat === "on_track") {
    return {
      headline: `${name}`,
      body: `You saw them ${seenPhrase} — you're probably good for now. Let me know if you want to book anyway.`,
      tone: "ok" as const,
    };
  }
  if (cat === "coming_due") {
    return {
      headline: `${name}`,
      body: `It's been ${ago} since you saw them — probably time for another visit.`,
      tone: "action" as const,
    };
  }
  return {
    headline: `${name}`,
    body: `It's been ${ago} since you saw them — let's get you in.`,
    tone: "action" as const,
  };
}

// Surfaces, one at a time, every provider the user hasn't been introduced
// to yet — Plaid-discovered, calendar-imported, NPI-added, manually added.
// Each card shows a date-aware framing and two actions. Tapping either
// marks the provider introduced and advances. Once the list is empty the
// component renders nothing and the dashboard returns to its normal state.
export default function NewProviderWalkthrough({ snapshots, introducedIds, onChange }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());

  const queue = useMemo(() => {
    const introducedSet = new Set(introducedIds);
    return snapshots.filter((s) => {
      if (!s.provider?.id || !s.provider?.name) return false;
      if (introducedSet.has(s.provider.id)) return false;
      if (localDone.has(s.provider.id)) return false;
      const status = s.booking_state?.status;
      if (status === "IN_PROGRESS") return false;
      return true;
    });
  }, [snapshots, introducedIds, localDone]);

  if (queue.length === 0) return null;

  const current = queue[0];
  const total = queue.length;
  const prompt = buildPrompt(current);

  async function markIntroduced(providerId: string) {
    const merged = Array.from(new Set([...introducedIds, providerId, ...Array.from(localDone)]));
    await apiFetch("/api/patient-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: { introduced_provider_ids: merged } }),
    });
  }

  async function handleAction(action: "book" | "skip") {
    if (busy) return;
    setBusy(true);
    try {
      const id = current.provider.id;
      setLocalDone((s) => new Set(s).add(id));
      await markIntroduced(id);
      if (action === "book") {
        router.push(`/providers/${id}?action=book`);
        return;
      }
      onChange();
    } finally {
      setBusy(false);
    }
  }

  // Pharmacies don't have a booking action — single "Got it" continues
  // the walkthrough. Doctors get the action/ok button pair based on
  // whether a visit's likely overdue.
  const isPharmacy = prompt.tone === "pharmacy";
  const primaryLabel = isPharmacy ? "Got it" : prompt.tone === "action" ? "Book it now" : "Got it";
  const secondaryLabel = isPharmacy ? null : prompt.tone === "action" ? "Skip for now" : "Actually, book";
  const primaryAction = isPharmacy ? "skip" : prompt.tone === "action" ? "book" : "skip";
  const secondaryAction = isPharmacy ? null : prompt.tone === "action" ? "skip" : "book";

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.lightMuted }}>
          Quick intro to your care team
        </div>
        <div style={{ fontSize: 11, color: T.lightMuted }}>
          {total > 1 ? `${total} left` : "Last one"}
        </div>
      </div>

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
          <div style={{ fontSize: 14, fontWeight: 700, color: T.lightText, marginBottom: 4 }}>
            {prompt.headline}
          </div>
          <div style={{ fontSize: 13, color: T.lightText, lineHeight: 1.45 }}>{prompt.body}</div>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: secondaryLabel ? "1fr 1fr" : "1fr",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => handleAction(primaryAction)}
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
              }}
            >
              {primaryLabel}
            </button>
            {secondaryLabel && secondaryAction && (
              <button
                type="button"
                onClick={() => handleAction(secondaryAction)}
                disabled={busy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "white",
                  color: T.lightText,
                  border: `1px solid ${T.lightBorder}`,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
