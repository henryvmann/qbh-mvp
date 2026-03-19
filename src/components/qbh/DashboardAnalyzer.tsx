"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  userId: string;
  enabled: boolean;
};

type DiscoveryResponse = {
  ok?: boolean;
  pending?: boolean;
  error?: string;
  message?: string;
};

export default function DashboardAnalyzer({ userId, enabled }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!userId) return;
    if (startedRef.current) return;

    startedRef.current = true;

    const labels = [
      "Pulling recent transactions",
      "Finding healthcare providers",
      "Organizing your care history",
    ];

    let cancelled = false;
    let stepTimer: number | null = null;
    let pollTimer: number | null = null;

    const advanceSteps = () => {
      let index = 0;
      stepTimer = window.setInterval(() => {
        index += 1;
        if (index >= labels.length) {
          if (stepTimer) window.clearInterval(stepTimer);
          return;
        }
        if (!cancelled) setStep(index);
      }, 1400);
    };

    const runDiscovery = async () => {
      try {
        const res = await fetch("/api/discovery/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
          }),
        });

        const data: DiscoveryResponse = await res
          .json()
          .catch(() => ({ ok: false, error: "Invalid discovery response" }));

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Failed to run discovery.");
        }

        if (data.pending) {
          pollTimer = window.setTimeout(runDiscovery, 3000);
          return;
        }

        router.replace(`/dashboard?user_id=${encodeURIComponent(userId)}`);
        router.refresh();
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error ? err.message : "Failed to analyze account."
        );
      }
    };

    advanceSteps();
    runDiscovery();

    return () => {
      cancelled = true;
      if (stepTimer) window.clearInterval(stepTimer);
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [enabled, router, userId]);

  if (!enabled) return null;

  const analysisMessages = [
    "Pulling recent transactions",
    "Finding healthcare providers",
    "Organizing your care history",
  ];

  return (
    <section className="mt-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#8B9D83]">
        Quarterback AI
      </div>

      <h2 className="mt-3 font-serif text-3xl tracking-tight text-slate-900">
        Analyzing your healthcare spending
      </h2>

      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        We’re securely reviewing your recent transactions, identifying
        providers, and preparing your care dashboard.
      </p>

      <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#8B9D83]" />
      </div>

      <div className="mt-6 space-y-3">
        {analysisMessages.map((message, index) => {
          const active = index <= step;

          return (
            <div
              key={message}
              className={[
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                active
                  ? "bg-[#F3F7F1] text-slate-900"
                  : "bg-slate-50 text-slate-400",
              ].join(" ")}
            >
              <div
                className={[
                  "h-2.5 w-2.5 rounded-full",
                  active ? "bg-[#8B9D83]" : "bg-slate-300",
                ].join(" ")}
              />
              <span>{message}</span>
            </div>
          );
        })}
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : (
        <div className="mt-6 text-sm text-slate-500">
          This usually takes a few seconds.
        </div>
      )}
    </section>
  );
}