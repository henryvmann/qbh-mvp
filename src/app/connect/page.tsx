"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function ConnectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const userId = (searchParams.get("user_id") || "").trim();

  const dashboardHref = userId
    ? `/dashboard?user_id=${encodeURIComponent(userId)}`
    : "/dashboard";

  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);

  const progress = useMemo(() => {
    if (!running) return 0;
    const map = [15, 45, 70, 95];
    return map[Math.max(0, Math.min(3, step))];
  }, [running, step]);

  async function runDiscovery() {
  if (running) return;

  setRunning(true);
  setStep(0);

  const t1 = setTimeout(() => setStep(1), 600);
  const t2 = setTimeout(() => setStep(2), 1400);
  const t3 = setTimeout(() => setStep(3), 2200);

  try {
    const response = await fetch("/api/discovery/run", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Discovery failed.");
    }

    setStep(3);
    setTimeout(() => router.push(dashboardHref), 600);
  } catch (error) {
    console.error("Discovery run failed:", error);
    setRunning(false);
    setStep(0);
    alert(error instanceof Error ? error.message : "Discovery failed.");
  } finally {
    clearTimeout(t1);
    clearTimeout(t2);
    clearTimeout(t3);
  }
}

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
      <div className="mx-auto max-w-4xl px-6 pt-10 pb-16">
        <header className="flex items-center justify-between">
          <Link
            href="/start"
            className="text-sm text-neutral-700 underline underline-offset-4"
          >
            Back
          </Link>

          <div className="text-xs text-neutral-500">Step 2 of 3</div>
        </header>

        <section className="mt-12">
          <h1
            className="text-4xl tracking-tight sm:text-5xl"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Analyze your healthcare spending
          </h1>

          <p className="mt-4 max-w-xl text-lg text-neutral-700">
            Quarterback analyzes the last 12 months of healthcare charges to
            identify providers, pharmacies, labs, and likely follow-up needs.
          </p>

          <div className="mt-10 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div>
              <div className="text-sm font-medium text-neutral-900">
                Healthcare spending analysis
              </div>
              <div className="mt-1 text-sm text-neutral-600">
                Credit card charges are used to identify providers and
                determine whether appointments or follow-ups are likely due.
              </div>
            </div>

            <div className="mt-6">
              {!running ? (
                <button
                  onClick={runDiscovery}
                  className="w-full rounded-2xl bg-[#8B9D83] px-6 py-3 text-white shadow-sm transition hover:brightness-95 active:brightness-90"
                >
                  Analyze healthcare spending
                </button>
              ) : (
                <div className="rounded-2xl bg-[#F9F7F2] p-5 ring-1 ring-black/5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-neutral-900">
                        Analyzing healthcare spending
                      </div>
                      <div className="mt-1 text-sm text-neutral-600">
                        Scanning the last 12 months of healthcare charges to
                        identify providers and follow-up needs.
                      </div>
                    </div>

                    <div
                      className="h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-black/40"
                      aria-hidden
                    />
                  </div>

                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/5">
                    <div
                      className="h-full rounded-full bg-[#8B9D83] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <StepChip label="Providers" done={step >= 1} />
                    <StepChip label="Pharmacies" done={step >= 2} />
                    <StepChip label="Labs & imaging" done={step >= 3} />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 text-center text-xs text-neutral-500">
              Secure analysis • No credentials required
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              You can skip this during the demo.
            </div>

            <Link
              href={dashboardHref}
              className="rounded-2xl bg-[#8B9D83] px-6 py-3 text-white shadow-sm transition hover:brightness-95 active:brightness-90"
            >
              Continue to dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function StepChip({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1",
        done
          ? "bg-white text-neutral-900 ring-black/10"
          : "bg-white/50 text-neutral-500 ring-black/5",
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 rounded-full",
          done ? "bg-[#8B9D83]" : "bg-black/15",
        ].join(" ")}
      />
      <span>{label}</span>
      {done ? <span className="text-neutral-400">✓</span> : null}
    </div>
  );
}