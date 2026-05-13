"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  retry_policy_hint: string | null;
  user_input_required: boolean;
  callback_requested: boolean;
  suggested_retry_after_iso: string | null;
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
  // Optimistic placeholder shown the instant the user taps Book it /
  // Have Kate book. Renders the in-progress bar immediately with the
  // provider name while the real attempt row makes its way through
  // start-call + the /api/calls/active poll. Cleared once the real
  // attempt arrives.
  const [optimisticProvider, setOptimisticProvider] = useState<string | null>(null);

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
          // Once we have a real attempt row, drop the optimistic one.
          if (data.attempt) setOptimisticProvider(null);
        }
      } catch {
        /* swallow */
      }
      if (cancelled) return;
      // Active calls: poll fast. Otherwise slow.
      const inProgress = isInProgress(attempt) || optimisticProvider !== null;
      timer = setTimeout(tick, inProgress ? 5000 : 30000);
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for HandleItButton's "call-initiated" event so the bar
  // appears the moment the user taps Book it. Force an immediate
  // refresh of /api/calls/active as well so the optimistic state
  // gets replaced by the real attempt as fast as possible.
  useEffect(() => {
    function onInitiated(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      const name = typeof detail.providerName === "string" && detail.providerName.trim()
        ? detail.providerName.trim()
        : "the office";
      setOptimisticProvider(name);
      apiFetch("/api/calls/active")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.ok && data.attempt) {
            setAttempt(data.attempt);
            setOptimisticProvider(null);
          }
        })
        .catch(() => {});
    }
    window.addEventListener("qbh:call-initiated", onInitiated);
    return () => window.removeEventListener("qbh:call-initiated", onInitiated);
  }, []);

  // Render the optimistic in-progress bar when no real attempt yet.
  if (!attempt && optimisticProvider) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 200,
          background: "#1677FF",
          color: "#FFFFFF",
          fontSize: 13,
          fontWeight: 500,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 2px 8px rgba(7,24,50,0.10)",
        }}
      >
        <PulsingDot />
        <div style={{ flex: 1, lineHeight: 1.4 }}>
          Kate is starting a call with <strong>{optimisticProvider}</strong>…
        </div>
      </div>
    );
  }

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
  const nextStep = renderNextStep(attempt);

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
      <div style={{ flex: 1, lineHeight: 1.4, minWidth: 0 }}>
        <div>{message}</div>
        {nextStep && (
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.92, fontWeight: 400 }}>
            {nextStep}
          </div>
        )}
      </div>
      {/* Open-provider link on the right when this attempt is tied to a
          provider. Gives the user a one-tap path from the bar into the
          provider detail page — the prior "open this provider to see
          what" copy was instructive but not actionable. */}
      {attempt.provider_id && !inProgress && (
        <Link
          href={`/providers/${attempt.provider_id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(255,255,255,0.18)",
            color: tone.accent,
            border: "1px solid rgba(255,255,255,0.35)",
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 700,
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Open →
        </Link>
      )}
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

// Friendly "in 2 hours" / "tomorrow at 9 AM" string from an ISO time
// in the future. Returns null if the iso is missing or in the past.
function humanizeRetryAt(iso: string | null): string | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const delta = target - Date.now();
  if (delta <= 0) return null;
  const minutes = Math.round(delta / 60000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  // For longer waits, give a clock time so the user gets a real anchor.
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `at ${timeStr}`;
  const dayStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${dayStr} at ${timeStr}`;
}

// Translates retry_policy_hint + user_input_required into a friendly
// "what happens next" sentence so the user knows whether Kate is on
// it or whether they need to do something. Returns null when there's
// no useful next step to surface (e.g. on success).
function renderNextStep(a: Attempt): React.ReactNode | null {
  if (isInProgress(a)) return null;
  if (isSuccess(a)) return null;

  if (a.user_input_required) {
    return <>I need a bit more from you to keep going.</>;
  }

  // Concrete countdown when we have a real retry time.
  const provider = a.provider_name || "the office";
  const retryHuman = humanizeRetryAt(a.suggested_retry_after_iso);
  if (retryHuman) {
    return <>I&rsquo;ll call <strong>{provider}</strong> back {retryHuman}.</>;
  }

  const hint = (a.retry_policy_hint || "").toUpperCase();
  switch (hint) {
    case "RETRY_NEXT_BUSINESS_HOURS":
      return <>I&rsquo;ll call <strong>{provider}</strong> back during their next business hours.</>;
    case "RETRY_LATER":
      return <>I&rsquo;ll call <strong>{provider}</strong> back shortly.</>;
    case "RETRY_TOMORROW":
      return <>I&rsquo;ll call <strong>{provider}</strong> back tomorrow morning.</>;
    case "USER_INPUT_REQUIRED":
      return <>I need a bit more from you to keep going.</>;
    case "DO_NOT_RETRY":
      return <>I won&rsquo;t try this one again on my own — open the provider when you want to revisit it.</>;
    default: {
      // Failure with no explicit hint — fall back based on failure class.
      const fc = (a.failure_class || "").toUpperCase();
      if (fc === "OFFICE_CLOSED" || fc === "NO_ANSWER" || fc === "BUSY") {
        return <>I&rsquo;ll try again at the next business hours, no action needed.</>;
      }
      if (fc === "WRONG_NUMBER") {
        return <>Worth checking the contact info on this provider before we try again.</>;
      }
      if (fc === "NEW_PATIENT_NOT_ACCEPTED" || fc === "INSURANCE_NOT_ACCEPTED" || fc === "REQUIRES_REFERRAL") {
        return <>This one needs a decision from you before I try again.</>;
      }
      return null;
    }
  }
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
