"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function ConnectPage() {
  const router = useRouter();

  const [discovering, setDiscovering] = useState(false);
  const [step, setStep] = useState(0); // 0..3

  const progress = useMemo(() => {
    if (!discovering) return 0;
    const map = [15, 45, 70, 95];
    return map[Math.max(0, Math.min(3, step))];
  }, [discovering, step]);

  function startDiscovery() {
    if (discovering) return;
    setDiscovering(true);
    setStep(0);
  }

  useEffect(() => {
    if (!discovering) return;

    const t1 = setTimeout(() => setStep(1), 650);
    const t2 = setTimeout(() => setStep(2), 1350);
    const t3 = setTimeout(() => setStep(3), 2150);
    const t4 = setTimeout(() => router.push("/dashboard"), 3050);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [discovering, router]);

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
      <div className="mx-auto max-w-4xl px-6 pt-10 pb-16">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            href="/start"
            className="text-sm text-neutral-700 underline underline-offset-4"
          >
            Back
          </Link>

          <div className="text-xs text-neutral-500">Step 2 of 3</div>
        </header>

        {/* Title */}
        <section className="mt-12">
          <h1
            className="text-4xl sm:text-5xl tracking-tight"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Connect your accounts
          </h1>

          <p className="mt-4 max-w-xl text-neutral-700 text-lg">
            Quarterback can discover providers and portals automatically. This
            works like Plaid for healthcare accounts.
          </p>

          {/* Connect Card */}
          <div className="mt-10 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-900">
                  Health portals
                </div>
                <div className="text-sm text-neutral-600 mt-1">
                  MyChart, hospital portals, specialists, and insurance.
                </div>
              </div>

              <div className="text-xs text-neutral-500">Demo</div>
            </div>

            <div className="mt-6">
              {!discovering ? (
                <button
                  onClick={startDiscovery}
                  className="w-full rounded-2xl bg-[#8B9D83] px-6 py-3 text-white shadow-sm hover:brightness-95 active:brightness-90 transition"
                >
                  Connect accounts
                </button>
              ) : (
                <div className="rounded-2xl bg-[#F9F7F2] p-5 ring-1 ring-black/5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-neutral-900">
                        Discovering providers
                      </div>
                      <div className="mt-1 text-sm text-neutral-600">
                        One moment while we locate your portals and recent
                        activity.
                      </div>
                    </div>

                    <div
                      className="h-5 w-5 rounded-full border-2 border-black/10 border-t-black/40 animate-spin"
                      aria-hidden
                    />
                  </div>

                  <div className="mt-4 h-2 w-full rounded-full bg-black/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#8B9D83] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <StepChip label="MyChart" done={step >= 1} />
                    <StepChip label="Insurance Portal" done={step >= 2} />
                    <StepChip label="Radiology Center" done={step >= 3} />
                  </div>

                  <div className="mt-4 text-xs text-neutral-500">
                    We’ll bring you to your dashboard automatically.
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 text-xs text-neutral-500 text-center">
              Secure connection • Read-only discovery
            </div>
          </div>

          {/* Skip */}
          <div className="mt-10 flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              You can skip this during the demo.
            </div>

            <Link
              href="/dashboard"
              className="rounded-2xl bg-[#8B9D83] px-6 py-3 text-white shadow-sm hover:brightness-95 active:brightness-90 transition"
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
        aria-hidden
      />
      <span>{label}</span>
      {done ? <span className="text-neutral-400">✓</span> : null}
    </div>
  );
}