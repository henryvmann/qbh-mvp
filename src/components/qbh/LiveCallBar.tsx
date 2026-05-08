"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type Attempt = {
  id: number;
  provider_id: string | null;
  provider_name: string | null;
  status: string | null;
  last_event: string | null;
  created_at: string;
  updated_at: string;
  age_ms: number;
  terminal_visibility_remaining_ms: number;
  outcome_type: string | null;
  failure_class: string | null;
  call_summary: string | null;
  reason_summary: string | null;
};

const DISMISSED_KEY = "qbh_dismissed_call_attempt_id";

// Site-wide bar that surfaces the state of Kate's most recent call.
//   In-progress: blue bar with pulsing dot, "Kate is calling X..."
//   Success:     green bar, "Kate booked X for [date]" — dismissable
//   Failure:     amber bar, brief reason (office closed, no answer, etc.)
//
// Polls /api/calls/active every 5s when something might be live;
// every 30s otherwise. Uses localStorage to remember which terminal
// attempt the user already saw + dismissed.
export default function LiveCallBar() {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  // Prime dismissed-id from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(DISMISSED_KEY);
    if (v) {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) setDismissedId(n);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await apiFetch("/api/calls/active");
        if (cancelled) return;
        if (res.status === 401) return; // not signed in
        const data = await res.json().catch(() => ({}));
        if (data?.ok) {
          setAttempt(data.attempt || null);
        }
      } catch {
        /* swallow */
      }
      if (cancelled) return;
      // Active calls: poll fast. Otherwise slow.
      const inProgress = isInProgress(attempt);
      timer = setTimeout(tick, inProgress ? 5000 : 30000);
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!attempt) return null;

  const inProgress = isInProgress(attempt);
  const isTerminal = !inProgress;

  // Hide if this terminal attempt was dismissed, or if it's older than
  // the visibility window.
  if (isTerminal && dismissedId === attempt.id) return null;
  if (isTerminal && attempt.terminal_visibility_remaining_ms <= 0) return null;

  const tone = inProgress
    ? { bg: "#1677FF", text: "#FFFFFF", accent: "#FFFFFF" }
    : isSuccess(attempt)
    ? { bg: "#27C46B", text: "#FFFFFF", accent: "#FFFFFF" }
    : { bg: "#E08A1F", text: "#FFFFFF", accent: "#FFFFFF" };

  const message = renderMessage(attempt);

  function dismiss() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DISMISSED_KEY, String(attempt!.id));
    setDismissedId(attempt!.id);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 200,
        background: tone.bg,
        color: tone.text,
        fontSize: 13,
        fontWeight: 500,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 2px 8px rgba(7,24,50,0.10)",
      }}
    >
      {inProgress && <PulsingDot />}
      <div style={{ flex: 1, lineHeight: 1.4 }}>{message}</div>
      {isTerminal && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: tone.accent,
            fontSize: 18,
            lineHeight: 1,
            padding: "2px 6px",
            cursor: "pointer",
            opacity: 0.85,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function PulsingDot() {
  return (
    <>
      <style>{`
        @keyframes qbh-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#FFFFFF",
          animation: "qbh-pulse 1.2s ease-in-out infinite",
          flexShrink: 0,
        }}
      />
    </>
  );
}

function isInProgress(a: Attempt | null): boolean {
  if (!a) return false;
  const status = (a.status || "").toUpperCase();
  if (status === "BOOKED_CONFIRMED" || status === "FAILED" || status === "COMPLETED") return false;
  // Anything not terminal AND created within last 5 min is treated as
  // potentially live. Older un-terminated rows are stale and ignored.
  return a.age_ms < 5 * 60 * 1000;
}

function isSuccess(a: Attempt): boolean {
  const status = (a.status || "").toUpperCase();
  return status === "BOOKED_CONFIRMED" || a.outcome_type === "BOOKED";
}

function renderMessage(a: Attempt): React.ReactNode {
  const provider = a.provider_name || "the office";
  if (isInProgress(a)) {
    return <>Kate is on a call with <strong>{provider}</strong>…</>;
  }
  if (isSuccess(a)) {
    if (a.call_summary) return <>{a.call_summary}</>;
    return <>Kate booked an appointment with <strong>{provider}</strong>.</>;
  }
  // Failure / non-success terminal.
  if (a.reason_summary) {
    return <><strong>{provider}:</strong> {a.reason_summary}</>;
  }
  if (a.failure_class) {
    const friendly = humanizeFailure(a.failure_class);
    return <><strong>{provider}:</strong> {friendly}</>;
  }
  if (a.call_summary) return <>{a.call_summary}</>;
  return <>Kate&rsquo;s call to <strong>{provider}</strong> didn&rsquo;t complete. We&rsquo;ll try again.</>;
}

function humanizeFailure(cls: string): string {
  switch (cls) {
    case "OFFICE_CLOSED": return "The office was closed when Kate called. We'll try again next business hours.";
    case "NO_ANSWER": return "No one picked up. Kate will try again.";
    case "BUSY": return "The line was busy. Kate will try again.";
    case "WRONG_NUMBER": return "Number didn't reach the office. Worth checking the contact info.";
    case "NEW_PATIENT_NOT_ACCEPTED": return "They aren't accepting new patients right now.";
    case "INSURANCE_NOT_ACCEPTED": return "They don't take that insurance.";
    case "REQUIRES_REFERRAL": return "They need a referral before booking.";
    default: return "Kate's call ran into something. Tap to see details.";
  }
}
