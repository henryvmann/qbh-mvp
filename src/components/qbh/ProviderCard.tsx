"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProviderDashboardSnapshot } from "../../app/lib/QBH/types";

type ProviderCardProps = {
  snapshot: ProviderDashboardSnapshot;
  userId: string;
  hasGoogleCalendarConnection?: boolean;
};

type StartCallMode = "BOOK" | "ADJUST";

function formatEventDateTime(iso: string, timezone?: string | null): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: timezone || "America/New_York",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getState(snapshot: ProviderDashboardSnapshot) {
  const bs = snapshot.booking_state;

  if (bs?.status === "BOOKED") {
    return {
      key: "upcoming" as const,
      label: "Upcoming",
      badgeClassName:
        "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
      description: bs.displayTime
        ? `Confirmed for ${bs.displayTime}.`
        : bs.appointmentStart
        ? `Confirmed for ${formatEventDateTime(
            bs.appointmentStart,
            bs.timezone
          )}.`
        : "Appointment confirmed.",
    };
  }

  if (bs?.status === "FOLLOW_UP") {
    return {
      key: "follow-up" as const,
      label: "Follow-up",
      badgeClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
      description: "No upcoming appointment is on the calendar yet.",
    };
  }

  return {
    key: "in-progress" as const,
    label: "In Progress",
    badgeClassName: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    description: "QBH is already working on this provider.",
  };
}

export default function ProviderCard({
  snapshot,
  userId,
  hasGoogleCalendarConnection = false,
}: ProviderCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);

  const provider = snapshot.provider;
  const state = useMemo(() => getState(snapshot), [snapshot]);
  const bs = snapshot.booking_state;

  const calendarConnectHref = `/calendar-connect?user_id=${encodeURIComponent(
    userId
  )}`;

  async function startCall(mode: StartCallMode) {
    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch("/api/vapi/start-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: userId,
          provider_id: provider.id,
          provider_name: provider.name,
          mode,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to start booking call.");
      }

      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start booking call."
      );
    } finally {
      setIsSubmitting(false);
      setShowCalendarPrompt(false);
    }
  }

  async function handleIt() {
    if (!hasGoogleCalendarConnection) {
      setShowCalendarPrompt(true);
      return;
    }

    await startCall("BOOK");
  }

  async function handleAdjust() {
    if (!hasGoogleCalendarConnection) {
      setShowCalendarPrompt(true);
      return;
    }

    await startCall("ADJUST");
  }

  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {provider.name}
          </h3>

          <div className="mt-1 text-sm text-slate-600">
            {provider.specialty || "Provider"}
          </div>
        </div>

        <div
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${state.badgeClassName}`}
        >
          {state.label}
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-600">{state.description}</p>

      {snapshot.latestNote?.summary ? (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {snapshot.latestNote.summary}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {state.key === "follow-up" ? (
          <button
            onClick={handleIt}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-[#8B9D83] px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Starting..." : "Handle it"}
          </button>
        ) : null}

        {state.key === "in-progress" && snapshot.latestAttempt ? (
          <div className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700">
            Attempt #{snapshot.latestAttempt.id}
          </div>
        ) : null}

        {state.key === "upcoming" &&
        (bs?.displayTime || bs?.appointmentStart) ? (
          <>
            <div className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700">
              {bs.displayTime ||
                formatEventDateTime(bs.appointmentStart, bs.timezone)}
            </div>

            <button
              onClick={handleAdjust}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Starting..." : "Adjust"}
            </button>
          </>
        ) : null}
      </div>

      {showCalendarPrompt ? (
        <div className="mt-4 rounded-2xl bg-[#FCFBF8] p-4 ring-1 ring-[#DDD6C8]">
          <div className="text-sm font-medium text-slate-900">
            Connect Google Calendar for a better booking experience
          </div>

          <div className="mt-1 text-sm text-slate-600">
            QBH can avoid conflicts and use your real availability before it
            places booking calls. You can also skip this for now and continue.
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={calendarConnectHref}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Connect Google Calendar
            </Link>

            <button
              onClick={() => startCall(state.key === "upcoming" ? "ADJUST" : "BOOK")}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl bg-[#8B9D83] px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Starting..."
                : state.key === "upcoming"
                ? "Skip and adjust anyway"
                : "Skip and handle it anyway"}
            </button>

            <button
              onClick={() => setShowCalendarPrompt(false)}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}
    </article>
  );
}