"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";
import { apiFetch } from "../../lib/api";
import type {
  ProviderDashboardSnapshot,
  BookingHistoryEvent,
  SystemActionItem,
} from "../../app/lib/QBH/types";
import AppointmentPrep from "./AppointmentPrep";

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
    return "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30";
  }

  if (event.event_type === "cancelled") {
    return "bg-[#F0F2F5] text-[#7A7F8A] ring-1 ring-[#EBEDF0]";
  }

  if (event.event_type === "failed") {
    return "bg-red-50 text-red-600 ring-1 ring-red-200";
  }

  return "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30";
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
    return "bg-[#F0F2F5] text-[#7A7F8A] ring-1 ring-[#EBEDF0]";
  }

  if (action.type === "REVIEW_BROKEN_STATE" || action.status === "BLOCKED") {
    return "bg-red-50 text-red-600 ring-1 ring-red-200";
  }

  if (action.status === "COMPLETED") {
    return "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30";
  }

  if (action.status === "PENDING") {
    return "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30";
  }

  if (action.status === "IN_PROGRESS") {
    return "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30";
  }

  return "bg-[#F0F2F5] text-[#7A7F8A] ring-1 ring-[#EBEDF0]";
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
      badgeClassName: "bg-red-50 text-red-600 ring-1 ring-red-200",
      description:
        "QBH found multiple future confirmed appointments for this provider. This state needs backend review before normal actions continue.",
    };
  }

  if (currentAction?.status === "BLOCKED") {
    return {
      key: "blocked" as const,
      label: "Blocked",
      badgeClassName: "bg-red-50 text-red-600 ring-1 ring-red-200",
      description:
        currentAction.blockingReason === "CALENDAR_CONFLICT_AT_CONFIRM"
          ? "QBH hit a calendar conflict while trying to confirm this appointment."
          : "QBH cannot continue this action until the blocking issue is resolved.",
    };
  }

  if (bs?.status === "BOOKED") {
    return {
      key: "upcoming" as const,
      label: "Upcoming",
      badgeClassName: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
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
      badgeClassName: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30",
      description:
        nextAction?.status === "PENDING"
          ? "No upcoming appointment is on the calendar yet."
          : "This provider may need a follow-up.",
    };
  }

  return {
    key: "in-progress" as const,
    label: "In Progress",
    badgeClassName: "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30",
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

      const response = await apiFetch("/api/vapi/start-call", {
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

  const isSystemOwnedRetry =
    nextAction?.status === "PENDING" &&
    nextAction.requiredBy === "SYSTEM" &&
    !nextAction.userInputRequired;

  const isPharmacy = provider.provider_type === "pharmacy";

  const showHandleButton =
    !isPharmacy &&
    !isSystemOwnedRetry &&
    (state.key === "follow-up" ||
      (state.key === "blocked" &&
        nextAction?.type === "BOOK_APPOINTMENT" &&
        nextAction.userInputRequired));

  const showAdjustButton =
    !isPharmacy &&
    state.key === "upcoming" &&
    (bs?.displayTime || bs?.appointmentStart) &&
    !actions.integrity.hasMultipleFutureConfirmedEvents;

  const showAttemptId =
    (state.key === "in-progress" || state.key === "blocked") &&
    snapshot.latestAttempt;

  // Provider detail editing
  const [showDetails, setShowDetails] = useState(false);
  const [editDoctorName, setEditDoctorName] = useState(provider.doctor_name || "");
  const [editSpecialty, setEditSpecialty] = useState(provider.specialty || "");
  const [editNotes, setEditNotes] = useState(provider.notes || "");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);

  const saveDetails = useCallback(async () => {
    setSavingDetails(true);
    try {
      await apiFetch("/api/providers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: provider.id,
          doctor_name: editDoctorName.trim() || null,
          specialty: editSpecialty.trim() || null,
          notes: editNotes.trim() || null,
        }),
      });
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 2000);
    } catch {
      // Silently fail
    } finally {
      setSavingDetails(false);
    }
  }, [provider.id, editDoctorName, editSpecialty, editNotes]);

  const detailInputClass =
    "w-full rounded-lg bg-[#F0F2F5] px-3 py-2 text-sm text-[#1A1D2E] border border-[#EBEDF0] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]";

  return (
    <article className="rounded-2xl bg-white p-5 border border-[#EBEDF0] shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#1A1D2E]">
            {provider.name}
          </h3>

          <div className="mt-1 text-sm text-[#7A7F8A]">
            {isPharmacy
              ? "Pharmacy"
              : provider.doctor_name
                ? `Dr. ${provider.doctor_name}${provider.specialty ? ` · ${provider.specialty}` : ""}`
                : provider.specialty || "Provider"}
          </div>
          {!isPharmacy && !provider.phone && (
            <div className="mt-1 text-xs text-amber-600">
              No phone number — add one in Details to enable booking
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#7A7F8A] hover:bg-[#F0F2F5] transition"
          >
            {showDetails ? "Close" : "Details"}
          </button>
          <div
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${state.badgeClassName}`}
          >
            {state.label}
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 rounded-xl bg-[#F0F2F5] p-4 border border-[#EBEDF0]">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#7A7F8A]">
            Provider details
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            <div>
              <label className="mb-1 block text-xs text-[#7A7F8A]">Doctor&apos;s name</label>
              <input
                type="text"
                value={editDoctorName}
                onChange={(e) => setEditDoctorName(e.target.value)}
                placeholder="e.g. Dr. Sarah Chen"
                className={detailInputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#7A7F8A]">Specialty</label>
              <input
                type="text"
                value={editSpecialty}
                onChange={(e) => setEditSpecialty(e.target.value)}
                placeholder="e.g. Psychiatry, Dermatology"
                className={detailInputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#7A7F8A]">Notes</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="e.g. Prefers morning appointments"
                className={detailInputClass}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={saveDetails}
              disabled={savingDetails}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
            >
              {savingDetails ? "Saving..." : detailsSaved ? "Saved!" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-[#7A7F8A] hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="mt-4 text-sm text-[#7A7F8A]">{state.description}</p>

      {/* Appointment prep — show for non-pharmacy providers */}
      {!isPharmacy && (
        <AppointmentPrep
          providerId={provider.id}
          providerName={provider.name}
        />
      )}

      {currentAction ? (
        <div className="mt-4 rounded-xl bg-[#F0F2F5] px-4 py-3 ring-1 ring-[#EBEDF0]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#1A1D2E]">
                Current system action
              </div>
              <div className="mt-1 text-sm text-[#7A7F8A]">
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
                <div className="mt-1 text-xs text-[#B0B4BC]">
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
        <div className="mt-4 rounded-xl bg-[#F0F2F5] px-4 py-3 ring-1 ring-[#EBEDF0]">
          <div className="text-sm font-medium text-[#1A1D2E]">Next action</div>
          <div className="mt-1 text-sm text-[#7A7F8A]">
            {getActionLabel(nextAction)}
            {nextAction.userInputRequired
              ? " — this requires a user-triggered step."
              : nextAction.requiredBy === "SYSTEM"
                ? " — QBH will handle this automatically."
                : ""}
          </div>
        </div>
      ) : null}

      {actions.integrity.hasMultipleFutureConfirmedEvents ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          QBH detected {actions.integrity.futureConfirmedEventCount} future
          confirmed appointments for this provider. This violates the current
          scheduling invariant and should be reviewed before additional actions
          are taken.
        </div>
      ) : null}

      {snapshot.latestNote?.summary && state.key !== "upcoming" ? (
        <div className="mt-4 rounded-xl bg-[#F0F2F5] px-4 py-3 space-y-2">
          <div className="text-sm text-[#1A1D2E]">{snapshot.latestNote.summary}</div>
          {snapshot.latestNote.follow_up_notes && (
            <div className="text-xs text-[#7A7F8A]">
              <span className="font-semibold">Follow-up:</span> {snapshot.latestNote.follow_up_notes}
            </div>
          )}
          {snapshot.latestNote.office_instructions && (
            <div className="text-xs text-[#7A7F8A]">
              <span className="font-semibold">Office notes:</span> {snapshot.latestNote.office_instructions}
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {showHandleButton ? (
          <button
            onClick={handleIt}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
          >
            {isSubmitting ? "Starting..." : "Handle it"}
          </button>
        ) : null}

        {showAttemptId ? (
          <div className="inline-flex items-center rounded-xl border border-[#EBEDF0] px-4 py-2 text-sm text-[#7A7F8A]">
            Attempt #{snapshot.latestAttempt.id}
          </div>
        ) : null}

        {showAdjustButton ? (
          <>
            <div className="inline-flex items-center rounded-xl border border-[#EBEDF0] px-4 py-2 text-sm text-[#7A7F8A]">
              {bs.displayTime ||
                formatEventDateTime(bs.appointmentStart!, bs.timezone)}
            </div>

            <button
              onClick={handleAdjust}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
            >
              {isSubmitting ? "Starting..." : "Adjust"}
            </button>
          </>
        ) : null}
      </div>

      {history.length > 0 ? (
        <div className="mt-5 rounded-2xl bg-[#F0F2F5] p-4 ring-1 ring-[#EBEDF0]">
          <div className="text-sm font-medium text-[#1A1D2E]">History</div>

          <div className="mt-3 space-y-3">
            {history.map((event, index) => (
              <div
                key={event.id}
                className="rounded-xl bg-white shadow-sm px-4 py-3 ring-1 ring-[#EBEDF0]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#1A1D2E]">
                      {getHistoryLabel(event)}
                    </div>

                    <div className="mt-1 text-sm text-[#7A7F8A]">
                      {event.event_type === "failed" &&
                      index === 0 &&
                      snapshot.latestNote?.summary
                        ? snapshot.latestNote.summary
                        : getHistoryDescription(event)}
                    </div>

                    <div className="mt-1 text-xs text-[#B0B4BC]">
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
        <div className="mt-4 rounded-2xl bg-[#F0F2F5] p-4 ring-1 ring-[#EBEDF0]">
          <div className="text-sm font-medium text-[#1A1D2E]">
            Connect Google Calendar for a better booking experience
          </div>

          <div className="mt-1 text-sm text-[#7A7F8A]">
            QBH can avoid conflicts and use your real availability before it
            places booking calls. You can also skip this for now and continue.
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={calendarConnectHref}
              className="inline-flex items-center justify-center rounded-xl border border-[#EBEDF0] px-4 py-2 text-sm font-medium text-[#7A7F8A] hover:bg-[#F0F2F5]"
            >
              Connect Google Calendar
            </Link>

            <button
              onClick={() =>
                startCall(state.key === "upcoming" ? "ADJUST" : "BOOK")
              }
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
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
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-[#7A7F8A] hover:bg-[#F0F2F5]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}
    </article>
  );
}
