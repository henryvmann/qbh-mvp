"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardAnalyzerProps = {
  userId: string;
  enabled?: boolean;
};

type DiscoveryResponse = {
  ok?: boolean;
  error?: string;
};

export default function DashboardAnalyzer({
  userId,
  enabled = false,
}: DashboardAnalyzerProps) {
  const router = useRouter();

  const [status, setStatus] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const hasRunRef = useRef(false);

  useEffect(() => {
    async function run() {
      if (!enabled) return;
      if (!userId) return;
      if (hasRunRef.current) return;

      hasRunRef.current = true;
      setStatus("running");
      setError(null);

      try {
        const response = await fetch("/api/discovery/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            app_user_id: userId,
          }),
        });

        const data = (await response.json().catch(() => ({}))) as DiscoveryResponse;

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Failed to run discovery.");
        }

        setStatus("success");

        router.replace(`/dashboard?user_id=${encodeURIComponent(userId)}`);
        router.refresh();
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Failed to run discovery."
        );
      }
    }

    void run();
  }, [enabled, router, userId]);

  if (!enabled) return null;

  return (
    <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="text-sm font-medium text-slate-900">
        {status === "running" && "Analyzing your healthcare spending"}
        {status === "success" && "Analysis complete"}
        {status === "error" && "Analysis failed"}
        {status === "idle" && "Preparing analysis"}
      </div>

      <div className="mt-2 text-sm text-slate-600">
        {status === "running" &&
          "QBH is reviewing transactions, identifying providers, and preparing your dashboard."}
        {status === "success" &&
          "Your dashboard is being refreshed with the latest provider state."}
        {status === "error" &&
          "Something went wrong while analyzing your data."}
        {status === "idle" && "Getting ready..."}
      </div>

      {status === "running" ? (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#8B9D83]" />
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}
    </section>
  );
}