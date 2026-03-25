"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  ProviderDashboardSnapshot,
  BookingHistoryEvent,
  SystemActionItem,
} from "../../app/lib/QBH/types";

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

function getHistoryLabel(event: BookingHistoryEvent): string {
  if (event.event_type === "rescheduled") {
    return "Rescheduled";
  }

  if (event.event_type === "cancelled") {
    return "Cancelled";
  }

  if (event.event_type === "failed") {
    return "Attempt failed";
  }

  return "Booked";
}

function getHistoryDescription(event: BookingHistoryEvent): string {
  if (event.event_type === "failed") {
    return "QBH tried to schedule this appointment, but the attempt did not complete.";
  }

  if (event.event_type === "cancelled") {
    return "This appointment was cancelled.";
  }

  if (event.appointment_start) {
    return formatEventDateTime(event.appointment_start, event.timezone);
  }

  return "No appointment time available.";
}

function getHistoryBadgeClassName(event: BookingHistoryEvent): string {
  if (event.event_type === "rescheduled") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  if (event.event_type === "cancelled") {
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }

  if (event.event_type === "failed") {
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  }

  return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
}

function getActionLabel(action: SystemActionItem | null): string {
  if (!action) return "No active action";

  if (action.type === "REVIEW_BROKEN_STATE") {
    return "Needs review";
  }

  if (action.type === "RESCHEDULE_APPOINTMENT") {
    if (action.status === "COMPLETED") return "Rescheduled";
    if (action.status === "IN_PROGRESS") return "Adjusting";
    if (action.status === "PENDING") return "Needs adjustment";
    if (action.status === "BLOCKED") return "Adjustment blocked";
    return "Reschedule";
  }

  if (action.status === "COMPLETED") return "Booked";
  if (action.status === "IN_PROGRESS") return "In progress";
  if (action.status === "PENDING") return "Needs booking";
  if (action.status === "BLOCKED") return "Blocked";

  return "No active action";
}

function getActionBadgeClassName(action: SystemActionItem | null): string {
  if (!action) {
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }

  if (action.type === "REVIEW_BROKEN_STATE" || action.status === "BLOCKED") {
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  }

  if (action.status === "COMPLETED") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (action.status === "PENDING") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  if (action.status === "IN_PROGRESS") {
    return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function getState(snapshot: ProviderDashboardSnapshot) {
  const bs = snapshot.booking_state;
  const actions = snapshot.system_actions;
  const currentAction = actions.current;
  const nextAction = actions.next;

  if (actions.integrity.hasMultipleFutureConfirmedEvents) {
    return {
      key: "broken" as const,
      label: "Needs review",
      badgeClassName: "bg-red-50 text-red-700 ring-1 ring-red-200",
      description:
        "QBH found multiple future confirmed appointments for this provider. This state needs backend review before normal actions continue.",
    };
  }

  if (bs?.status === "BOOKED") {
    return {
      key: "upcoming" as const,
      label: "Upcoming",
      badgeClassName: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
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
      description:
        nextAction?.status === "PENDING"
          ? "No upcoming appointment is on the calendar yet."
          : "This provider may need a follow-up.",
    };
  }

  if (currentAction?.status === "BLOCKED") {
    return {
      key: "blocked" as const,
      label: "Blocked",
      badgeClassName: "bg-red-50 text-red-700 ring-1 ring-red-200",
      description:
        currentAction.blockingReason === "CALENDAR_CONFLICT_AT_CONFIRM"
          ? "QBH hit a calendar conflict while trying to confirm this appointment."
          : "QBH cannot continue this action until the blocking issue is resolved.",
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
  const history = snapshot.history ?? [];
  const actions = snapshot.system_actions;
  const currentAction = actions.current;
  const nextAction = actions.next;
  const currentActionLabel = getActionLabel(currentAction);
  const currentActionBadgeClassName = getActionBadgeClassName(currentAction);

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

  const showHandleButton =
    state.key === "follow-up" ||
    (state.key === "blocked" &&
      nextAction?.type === "BOOK_APPOINTMENT" &&
      nextAction.userInputRequired);

  const showAdjustButton =
    state.key === "upcoming" &&
    (bs?.displayTime || bs?.appointmentStart) &&
    !actions.integrity.hasMultipleFutureConfirmedEvents;

  const showAttemptId =
    (state.key === "in-progress" || state.key === "blocked") &&
    snapshot.latestAttempt;

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

      {currentAction ? (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-900">
                Current system action
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {currentActionLabel}
                {currentAction.status === "BLOCKED"
  ? currentAction.userInputRequired
    ? " — QBH is blocked and needs user input to continue."
    : " — QBH is blocked and cannot proceed automatically."
  : currentAction.userInputRequired
    ? " — waiting on a user-driven next step."
    : currentAction.requiredBy === "SYSTEM"
      ? " — QBH is handling this in the backend."
      : ""}
              </div>

              {currentAction.blockingReason ? (
                <div className="mt-1 text-xs text-slate-500">
                  Reason: {currentAction.blockingReason}
                </div>
              ) : null}
            </div>

            <div
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${currentActionBadgeClassName}`}
            >
              {currentActionLabel}
            </div>
          </div>
        </div>
      ) : null}

      {nextAction ? (
        <div className="mt-4 rounded-xl bg-[#FCFBF8] px-4 py-3 ring-1 ring-[#DDD6C8]">
          <div className="text-sm font-medium text-slate-900">Next action</div>
          <div className="mt-1 text-sm text-slate-600">
            {getActionLabel(nextAction)}
            {nextAction.userInputRequired
              ? " — this requires a user-triggered step."
              : ""}
          </div>
        </div>
      ) : null}

      {actions.integrity.hasMultipleFutureConfirmedEvents ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          QBH detected {actions.integrity.futureConfirmedEventCount} future
          confirmed appointments for this provider. This violates the current
          scheduling invariant and should be reviewed before additional actions
          are taken.
        </div>
      ) : null}

      {snapshot.latestNote?.summary ? (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {snapshot.latestNote.summary}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {showHandleButton ? (
          <button
            onClick={handleIt}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-[#8B9D83] px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Starting..." : "Handle it"}
          </button>
        ) : null}

        {showAttemptId ? (
          <div className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700">
            Attempt #{snapshot.latestAttempt.id}
          </div>
        ) : null}

        {showAdjustButton ? (
          <>
            <div className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700">
              {bs.displayTime ||
                formatEventDateTime(bs.appointmentStart!, bs.timezone)}
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

      {history.length > 0 ? (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="text-sm font-medium text-slate-900">History</div>

          <div className="mt-3 space-y-3">
            {history.map((event) => (
              <div
                key={event.id}
                className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {getHistoryLabel(event)}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      {getHistoryDescription(event)}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Recorded{" "}
                      {formatEventDateTime(event.occurred_at, event.timezone)}
                    </div>
                  </div>

                  <div
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getHistoryBadgeClassName(
                      event
                    )}`}
                  >
                    {getHistoryLabel(event)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
              onClick={() =>
                startCall(state.key === "upcoming" ? "ADJUST" : "BOOK")
              }
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