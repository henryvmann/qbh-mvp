"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import TopNav from "../../components/qbh/TopNav";

function CalendarConnectPageInner() {
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingOutlook, setSubmittingOutlook] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);

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

  // Check connection status from dashboard data
  useEffect(() => {
    apiFetch("/api/dashboard/data")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.ok) {
          setGoogleConnected(!!json.hasGoogleCalendarConnection);
          // Outlook connection: the dashboard API currently bundles both into
          // hasGoogleCalendarConnection. We keep a separate state so the UI
          // can be updated when the API is extended.
          // For now, if the flag is true we also check the provider query param
          // after a successful callback redirect.
        }
      })
      .catch(() => {});
  }, []);

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
      <TopNav />
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

        <section className="mt-10">
          <h1 className="text-3xl font-light tracking-tight">
            Connect Your Calendar
          </h1>
          <p className="mt-2 text-base text-[#7A7F8A]">
            Kate checks your calendar before booking so appointments never conflict.
          </p>

          {/* Visual — what happens */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl bg-white border border-[#EBEDF0] p-4">
              <div className="text-2xl mb-2">1</div>
              <div className="text-xs font-medium text-[#1A1D2E]">Connect</div>
              <div className="text-[10px] text-[#7A7F8A] mt-1">One click to link your calendar</div>
            </div>
            <div className="rounded-xl bg-white border border-[#EBEDF0] p-4">
              <div className="text-2xl mb-2">2</div>
              <div className="text-xs font-medium text-[#1A1D2E]">Kate Checks</div>
              <div className="text-[10px] text-[#7A7F8A] mt-1">She reads your free/busy times</div>
            </div>
            <div className="rounded-xl bg-white border border-[#EBEDF0] p-4">
              <div className="text-2xl mb-2">3</div>
              <div className="text-xs font-medium text-[#1A1D2E]">No Conflicts</div>
              <div className="text-[10px] text-[#7A7F8A] mt-1">Appointments booked around your schedule</div>
            </div>
          </div>

          <div className="mt-3 text-center text-[10px] text-[#B0B4BC]">
            Read-only access &middot; Your data stays private
          </div>

          {/* Calendar buttons */}
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-6">
              <div className="text-sm font-medium text-[#1A1D2E] mb-3">Google Calendar</div>
              {googleConnected ? (
                <div className="w-full rounded-2xl px-6 py-3 text-center font-medium bg-green-50 text-green-700 ring-1 ring-green-200">
                  Connected &#10003;
                </div>
              ) : (
                <button
                  onClick={startGoogleCalendarConnect}
                  disabled={!userId || submitting || submittingOutlook}
                  className="w-full rounded-2xl px-6 py-3 text-white font-medium shadow-sm transition hover:brightness-95 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)", boxShadow: "0 8px 24px rgba(92,107,92,0.35)" }}
                >
                  {submitting ? "Redirecting..." : "Connect Google Calendar"}
                </button>
              )}
            </div>

            <div className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-6">
              <div className="text-sm font-medium text-[#1A1D2E] mb-3">Outlook Calendar</div>
              {outlookConnected ? (
                <div className="w-full rounded-2xl px-6 py-3 text-center font-medium bg-green-50 text-green-700 ring-1 ring-green-200">
                  Connected &#10003;
                </div>
              ) : (
                <button
                  onClick={startOutlookCalendarConnect}
                  disabled={!userId || submitting || submittingOutlook}
                  className="w-full rounded-2xl px-6 py-3 text-white font-medium shadow-sm transition hover:brightness-95 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)", boxShadow: "0 8px 24px rgba(92,107,92,0.35)" }}
                >
                  {submittingOutlook ? "Redirecting..." : "Connect Outlook Calendar"}
                </button>
              )}
            </div>
          </div>

          {/* Return button — prominent */}
          <Link
            href="/dashboard"
            className="mt-6 block w-full rounded-2xl border border-[#EBEDF0] bg-white px-6 py-3 text-center text-sm font-medium text-[#7A7F8A] shadow-sm transition hover:bg-[#F0F2F5]"
          >
            Return To Dashboard
          </Link>

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
