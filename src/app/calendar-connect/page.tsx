"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type BusyBlock = {
  start: string;
  end: string;
};

type SlotCheckResult = {
  slotStart: string;
  slotEnd: string;
  isAvailable: boolean;
  conflictingBlocks: BusyBlock[];
} | null;

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildDefaultSlotValues() {
  const now = new Date();
  const rounded = new Date(now);
  rounded.setMinutes(0, 0, 0);
  rounded.setHours(rounded.getHours() + 1);

  const end = new Date(rounded);
  end.setMinutes(end.getMinutes() + 30);

  return {
    start: toLocalDateTimeInputValue(rounded),
    end: toLocalDateTimeInputValue(end),
  };
}

function CalendarConnectPageInner() {
  const searchParams = useSearchParams();

  const defaultSlot = useMemo(() => buildDefaultSlotValues(), []);
  const [userId, setUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [testingBusy, setTestingBusy] = useState(false);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slotStart, setSlotStart] = useState(defaultSlot.start);
  const [slotEnd, setSlotEnd] = useState(defaultSlot.end);

  const [busyResult, setBusyResult] = useState<{
    timeMin: string;
    timeMax: string;
    busy: BusyBlock[];
  } | null>(null);

  const [slotCheckResult, setSlotCheckResult] = useState<SlotCheckResult>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fromQuery = (searchParams.get("user_id") || "").trim();

    if (fromQuery) {
      window.localStorage.setItem("qbh_user_id", fromQuery);
      window.sessionStorage.setItem("qbh_user_id", fromQuery);
      setUserId(fromQuery);
      return;
    }

    const sessionUserId = window.sessionStorage.getItem("qbh_user_id") || "";
    const localUserId = window.localStorage.getItem("qbh_user_id") || "";
    const resolvedUserId = sessionUserId || localUserId;

    if (resolvedUserId) {
      setUserId(resolvedUserId);
      return;
    }

    setError("Missing user_id");
  }, [searchParams]);

  useEffect(() => {
    const calendarError = (searchParams.get("calendar_error") || "").trim();

    if (calendarError) {
      setError(calendarError);
    }
  }, [searchParams]);

  async function startGoogleCalendarConnect() {
    try {
      if (!userId) {
        throw new Error("Missing user_id");
      }

      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/google-calendar/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok || !data?.authorize_url) {
        throw new Error(
          data?.error || "Failed to start Google Calendar connection."
        );
      }

      window.location.href = data.authorize_url;
    } catch (err) {
      console.log("Google Calendar connect failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start Google Calendar connection."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function testFreeBusy() {
    try {
      if (!userId) {
        throw new Error("Missing user_id");
      }

      setTestingBusy(true);
      setError(null);
      setBusyResult(null);

      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      const response = await fetch("/api/google-calendar/freebusy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: userId,
          time_min: timeMin,
          time_max: timeMax,
          time_zone: "America/New_York",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to fetch free/busy.");
      }

      setBusyResult({
        timeMin: data.time_min,
        timeMax: data.time_max,
        busy: Array.isArray(data.busy) ? data.busy : [],
      });
    } catch (err) {
      console.log("Google Calendar free/busy test failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch free/busy."
      );
    } finally {
      setTestingBusy(false);
    }
  }

  async function checkSpecificSlot() {
    try {
      if (!userId) {
        throw new Error("Missing user_id");
      }

      if (!slotStart || !slotEnd) {
        throw new Error("Missing slot start or end");
      }

      const slotStartIso = new Date(slotStart).toISOString();
      const slotEndIso = new Date(slotEnd).toISOString();

      setCheckingSlot(true);
      setError(null);
      setSlotCheckResult(null);

      const response = await fetch("/api/google-calendar/check-slot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_user_id: userId,
          slot_start: slotStartIso,
          slot_end: slotEndIso,
          time_zone: "America/New_York",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to check slot.");
      }

      setSlotCheckResult({
        slotStart: data.slot_start,
        slotEnd: data.slot_end,
        isAvailable: Boolean(data.is_available),
        conflictingBlocks: Array.isArray(data.conflicting_blocks)
          ? data.conflicting_blocks
          : [],
      });
    } catch (err) {
      console.log("Google Calendar slot check failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to check slot."
      );
    } finally {
      setCheckingSlot(false);
    }
  }

  const dashboardHref = userId
    ? `/dashboard?user_id=${encodeURIComponent(userId)}`
    : "/dashboard";

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <header className="flex items-center justify-between">
          <Link
            href={dashboardHref}
            className="text-sm text-neutral-700 underline underline-offset-4"
          >
            Back
          </Link>

          <div className="text-xs text-neutral-500">Calendar</div>
        </header>

        <section className="mt-12">
          <h1
            className="text-4xl tracking-tight sm:text-5xl"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Connect Google Calendar
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-neutral-700">
            Connect your calendar so Quarterback can avoid conflicts, understand
            your real availability, and schedule safely on your behalf.
          </p>

          <div className="mt-10 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="text-sm font-medium text-neutral-900">
                  Why this matters
                </div>

                <div className="mt-4 space-y-4 text-sm text-neutral-600">
                  <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                    QBH uses your calendar to avoid proposing or confirming
                    appointment times that conflict with your day.
                  </div>

                  <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                    Access is read-only. QBH reads calendar availability so it
                    can protect your schedule before booking starts.
                  </div>

                  <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                    You can connect this now or come back later. QBH works best
                    when it has real availability context.
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-[#FCFBF8] p-6">
                <div>
                  <div className="text-sm font-medium text-neutral-900">
                    Google Calendar
                  </div>
                  <div className="mt-2 text-sm text-neutral-600">
                    Read-only calendar access for conflict-aware scheduling.
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <button
                    onClick={startGoogleCalendarConnect}
                    disabled={!userId || submitting}
                    className="w-full rounded-2xl bg-[#8B9D83] px-6 py-3 text-white shadow-sm transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? "Redirecting to Google..."
                      : "Connect Google Calendar"}
                  </button>

                  <button
                    onClick={testFreeBusy}
                    disabled={!userId || testingBusy}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-6 py-3 text-neutral-900 shadow-sm transition hover:bg-neutral-50 active:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {testingBusy
                      ? "Checking availability..."
                      : "Test calendar availability"}
                  </button>

                  <Link
                    href={dashboardHref}
                    className="block text-center text-sm text-neutral-600 underline underline-offset-4"
                  >
                    Return to dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-medium text-neutral-900">
              Check a specific slot
            </div>

            <div className="mt-2 text-sm text-neutral-600">
              Test whether a proposed appointment time conflicts with your real
              calendar availability.
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-neutral-700">
                  Slot start
                </div>
                <input
                  type="datetime-local"
                  value={slotStart}
                  onChange={(e) => setSlotStart(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none ring-0"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-neutral-700">
                  Slot end
                </div>
                <input
                  type="datetime-local"
                  value={slotEnd}
                  onChange={(e) => setSlotEnd(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none ring-0"
                />
              </label>
            </div>

            <div className="mt-4">
              <button
                onClick={checkSpecificSlot}
                disabled={!userId || checkingSlot}
                className="rounded-2xl bg-[#8B9D83] px-6 py-3 text-white shadow-sm transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingSlot ? "Checking slot..." : "Check slot availability"}
              </button>
            </div>
          </div>

          {slotCheckResult ? (
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="text-sm font-medium text-neutral-900">
                Slot check result
              </div>

              <div className="mt-2 text-sm text-neutral-600">
                Slot: {slotCheckResult.slotStart} → {slotCheckResult.slotEnd}
              </div>

              <div
                className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                  slotCheckResult.isAvailable
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                }`}
              >
                {slotCheckResult.isAvailable
                  ? "This slot is available."
                  : "This slot conflicts with your calendar."}
              </div>

              {!slotCheckResult.isAvailable ? (
                <div className="mt-4 space-y-3">
                  {slotCheckResult.conflictingBlocks.map((block, index) => (
                    <div
                      key={`${block.start}-${block.end}-${index}`}
                      className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
                    >
                      {block.start} → {block.end}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {busyResult ? (
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="text-sm font-medium text-neutral-900">
                Availability test result
              </div>

              <div className="mt-2 text-sm text-neutral-600">
                Window: {busyResult.timeMin} → {busyResult.timeMax}
              </div>

              <div className="mt-4 text-sm text-neutral-900">
                Busy blocks found: {busyResult.busy.length}
              </div>

              <div className="mt-4 space-y-3">
                {busyResult.busy.length === 0 ? (
                  <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                    No busy blocks returned for this window.
                  </div>
                ) : (
                  busyResult.busy.map((block, index) => (
                    <div
                      key={`${block.start}-${block.end}-${index}`}
                      className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
                    >
                      {block.start} → {block.end}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function CalendarConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F1E8]" />}>
      <CalendarConnectPageInner />
    </Suspense>
  );
}