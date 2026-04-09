"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";

function CalendarConnectPageInner() {
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingOutlook, setSubmittingOutlook] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const response = await apiFetch("/api/google-calendar/connect", {
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

  async function startOutlookCalendarConnect() {
    try {
      if (!userId) {
        throw new Error("Missing user_id");
      }

      setSubmittingOutlook(true);
      setError(null);

      const response = await apiFetch("/api/outlook-calendar/connect", {
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
          data?.error || "Failed to start Outlook Calendar connection."
        );
      }

      window.location.href = data.authorize_url;
    } catch (err) {
      console.log("Outlook Calendar connect failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start Outlook Calendar connection."
      );
    } finally {
      setSubmittingOutlook(false);
    }
  }

  return (
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <header className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-sm text-[#7A7F8A] underline underline-offset-4"
          >
            Back
          </Link>

          <div className="text-xs text-[#B0B4BC]">Calendar</div>
        </header>

        <section className="mt-12">
          <h1 className="text-4xl tracking-tight sm:text-5xl">
            Connect Your Calendar
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-[#7A7F8A]">
            Connect your calendar so Quarterback can avoid conflicts, understand
            your real availability, and schedule safely on your behalf.
          </p>

          <div className="mt-10 rounded-2xl bg-white shadow-sm p-8 border border-[#EBEDF0]">
            <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="text-sm font-medium text-[#1A1D2E]">
                  Why this matters
                </div>

                <div className="mt-4 space-y-4 text-sm text-[#7A7F8A]">
                  <div className="rounded-2xl bg-[#F0F2F5] px-4 py-3">
                    QBH uses your calendar to avoid proposing or confirming
                    appointment times that conflict with your day.
                  </div>

                  <div className="rounded-2xl bg-[#F0F2F5] px-4 py-3">
                    Access is read-only. QBH reads calendar availability so it
                    can protect your schedule before booking starts.
                  </div>

                  <div className="rounded-2xl bg-[#F0F2F5] px-4 py-3">
                    You can connect this now or come back later. QBH works best
                    when it has real availability context.
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col justify-between rounded-2xl border border-[#EBEDF0] bg-[#F0F2F5] p-6">
                  <div>
                    <div className="text-sm font-medium text-[#1A1D2E]">
                      Google Calendar
                    </div>
                    <div className="mt-2 text-sm text-[#7A7F8A]">
                      Read-only calendar access for conflict-aware scheduling.
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={startGoogleCalendarConnect}
                      disabled={!userId || submitting || submittingOutlook}
                      className="w-full rounded-2xl px-6 py-3 text-white font-medium shadow-sm transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)", boxShadow: "0 8px 24px rgba(92,107,92,0.35)" }}
                    >
                      {submitting
                        ? "Redirecting to Google..."
                        : "Connect Google Calendar"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-[#EBEDF0] bg-[#F0F2F5] p-6">
                  <div>
                    <div className="text-sm font-medium text-[#1A1D2E]">
                      Outlook Calendar
                    </div>
                    <div className="mt-2 text-sm text-[#7A7F8A]">
                      Read-only calendar access for conflict-aware scheduling.
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={startOutlookCalendarConnect}
                      disabled={!userId || submitting || submittingOutlook}
                      className="w-full rounded-2xl px-6 py-3 text-white font-medium shadow-sm transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)", boxShadow: "0 8px 24px rgba(92,107,92,0.35)" }}
                    >
                      {submittingOutlook
                        ? "Redirecting to Microsoft..."
                        : "Connect Outlook Calendar"}
                    </button>
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  className="block text-center text-sm text-[#B0B4BC] underline underline-offset-4"
                >
                  Return to dashboard
                </Link>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
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
    <Suspense fallback={<div className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />}>
      <CalendarConnectPageInner />
    </Suspense>
  );
}
