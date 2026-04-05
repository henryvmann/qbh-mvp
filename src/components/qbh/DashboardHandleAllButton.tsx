"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type ActionableProvider = {
  providerId: string;
  providerName: string;
};

type DashboardHandleAllButtonProps = {
  userId: string;
  providers: ActionableProvider[];
  hasGoogleCalendarConnection?: boolean;
};

export default function DashboardHandleAllButton({
  userId,
  providers,
  hasGoogleCalendarConnection = false,
}: DashboardHandleAllButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);

  const actionableProviders = useMemo(() => {
    return providers.filter(
      (provider) => provider.providerId?.trim() && provider.providerName?.trim()
    );
  }, [providers]);

  const calendarConnectHref = `/calendar-connect?user_id=${encodeURIComponent(
    userId
  )}`;

  async function startHandleAll() {
    try {
      setIsSubmitting(true);
      setError(null);

      for (const provider of actionableProviders) {
        const response = await apiFetch("/api/vapi/start-call", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            app_user_id: userId,
            provider_id: provider.providerId,
            provider_name: provider.providerName,
            mode: "BOOK",
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.error ||
              `Failed to start booking for ${provider.providerName}.`
          );
        }
      }

      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start Handle All."
      );
    } finally {
      setIsSubmitting(false);
      setShowCalendarPrompt(false);
    }
  }

  async function handleAll() {
    if (actionableProviders.length === 0 || isSubmitting) return;

    if (!hasGoogleCalendarConnection) {
      setShowCalendarPrompt(true);
      return;
    }

    await startHandleAll();
  }

  const disabled = isSubmitting || actionableProviders.length === 0;

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        onClick={handleAll}
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-xl bg-[#7BA59A] px-4 py-2 text-sm font-medium text-[#1E2228] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "Starting booking..."
          : actionableProviders.length === 0
            ? "Nothing to handle"
            : "Handle all"}
      </button>

      {showCalendarPrompt ? (
        <div className="max-w-xl rounded-2xl bg-[#162030] p-4 ring-1 ring-white/8">
          <div className="text-sm font-medium text-[#F0F2F5]">
            Connect Google Calendar for a better booking experience
          </div>

          <div className="mt-1 text-sm text-[#8A9BAE]">
            QBH can avoid conflicts and use your real availability before it
            places booking calls. You can skip this for now and continue
            anyway.
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={calendarConnectHref}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-[#8A9BAE] hover:bg-[#1E2D45]"
            >
              Connect Google Calendar
            </Link>

            <button
              onClick={startHandleAll}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl bg-[#7BA59A] px-4 py-2 text-sm font-medium text-[#1E2228] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Starting booking..."
                : "Skip and handle all anyway"}
            </button>

            <button
              onClick={() => setShowCalendarPrompt(false)}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-[#4D6480] hover:bg-[#162030]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
          {error}
        </div>
      ) : null}
    </div>
  );
}
