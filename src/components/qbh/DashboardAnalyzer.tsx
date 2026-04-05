"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

type DashboardAnalyzerProps = {
  userId: string;
  enabled?: boolean;
};

type DiscoveryResponse = {
  ok?: boolean;
  pending?: boolean;
  error?: string;
};

const FACTS = [
  "Americans visit a doctor an average of 4 times per year — but many skip follow-ups that could catch issues early.",
  "1 in 5 medical bills contains an error. Keeping a clear picture of your care history helps you catch them.",
  "Preventive care visits are covered at 100% under most insurance plans — no copay required.",
  "The average person sees 18.7 different physicians over their lifetime.",
  "Missing a follow-up appointment increases the risk of hospital readmission by up to 25%.",
  "Only 1 in 3 patients leaves a doctor's appointment understanding their next steps.",
  "Coordinated care — where your providers communicate — leads to 20% better health outcomes.",
  "Healthcare is the #1 source of financial stress for American families.",
];

export default function DashboardAnalyzer({
  userId,
  enabled = false,
}: DashboardAnalyzerProps) {
  const router = useRouter();

  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [factIndex, setFactIndex] = useState(0);

  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      setFactIndex((i) => (i + 1) % FACTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    async function run() {
      if (!enabled) return;
      if (!userId) return;
      if (hasRunRef.current) return;

      hasRunRef.current = true;
      setStatus("running");
      setError(null);

      try {
        let data: DiscoveryResponse = {};

        for (let attempt = 0; attempt < 8; attempt++) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }

          const response = await apiFetch("/api/discovery/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app_user_id: userId }),
          });

          data = (await response.json().catch(() => ({}))) as DiscoveryResponse;

          if (!response.ok || !data?.ok) {
            throw new Error(data?.error || "Failed to run discovery.");
          }

          if (!data.pending) break;
        }

        setStatus("success");
        router.replace("/dashboard");
        router.refresh();
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to run discovery.");
      }
    }

    void run();
  }, [enabled, router, userId]);

  if (!enabled) return null;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#7BA59A]">
          Quarterback AI
        </div>

        <h2 className="mt-4 text-3xl tracking-tight text-[#F0F2F5]">
          {status === "error" ? "Something went wrong" : "Building your care picture"}
        </h2>

        {status !== "error" ? (
          <>
            <p className="mt-3 text-base text-[#8A9BAE]">
              Reviewing your transactions and identifying healthcare providers.
            </p>

            <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#7BA59A]" />
            </div>

            <div className="mt-8 rounded-2xl bg-white/5 p-6 ring-1 ring-white/8">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#7BA59A]">
                Did you know
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#9AB0CC] transition-all">
                {FACTS[factIndex]}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
              {error}
            </div>
            <button
              onClick={() => {
                hasRunRef.current = false;
                setStatus("idle");
                setError(null);
              }}
              className="mt-4 rounded-xl bg-[#7BA59A] px-5 py-2.5 text-sm font-medium text-[#1E2228] hover:brightness-95"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
