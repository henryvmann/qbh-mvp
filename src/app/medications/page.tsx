"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type PharmacyVisit = {
  provider_name: string;
  visit_date: string | null;
  amount_cents: number | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatAmount(cents: number | null): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

export default function MedicationsPage() {
  const router = useRouter();
  const [pharmacyVisits, setPharmacyVisits] = useState<PharmacyVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/medications/data")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.ok) {
          setPharmacyVisits(data.pharmacyVisits ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main className="min-h-screen bg-[#1A1D23] text-[#F0F2F5]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-[#F0F2F5]">
              Medications
            </h1>
            <p className="mt-2 max-w-2xl text-base text-[#8A9BAE]">
              View your detected pharmacy visits and track medications as part of
              your care plan.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#8A9BAE] shadow-sm hover:bg-[#162030]"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Pharmacy Visits Section */}
        <section className="mt-8 rounded-2xl bg-white/5 p-6 ring-1 ring-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl text-[#F0F2F5]">
              Pharmacy visits
            </h2>
            <span className="rounded-full bg-[#7BA59A]/15 px-3 py-1 text-xs font-semibold text-[#7BA59A] ring-1 ring-[#7BA59A]/30">
              From bank data
            </span>
          </div>
          <p className="mt-2 text-sm text-[#8A9BAE]">
            Pharmacy transactions detected from your connected financial
            accounts.
          </p>

          {loading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-[#8A9BAE]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7BA59A] border-t-transparent" />
              Loading pharmacy visits...
            </div>
          ) : pharmacyVisits.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-[#162030] p-5 ring-1 ring-[rgba(255,255,255,0.08)]">
              <p className="text-sm text-[#8A9BAE]">
                No pharmacy visits detected yet. Once you connect a financial
                account, transactions at pharmacies like CVS, Walgreens, and
                Rite Aid will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {pharmacyVisits.map((visit, i) => (
                <div
                  key={`${visit.provider_name}-${visit.visit_date}-${i}`}
                  className="flex items-center justify-between rounded-2xl bg-[#162030] px-5 py-4 ring-1 ring-[rgba(255,255,255,0.08)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7BA59A]/15">
                      <svg
                        className="h-4 w-4 text-[#7BA59A]"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#F0F2F5]">
                        {visit.provider_name}
                      </div>
                      <div className="text-xs text-[#8A9BAE]">
                        {formatDate(visit.visit_date)}
                      </div>
                    </div>
                  </div>
                  {visit.amount_cents != null && (
                    <div className="text-sm font-medium text-[#F0F2F5]">
                      {formatAmount(visit.amount_cents)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Your Medications Section */}
        <section className="mt-8 rounded-2xl bg-white/5 p-6 ring-1 ring-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl text-[#F0F2F5]">
              Your medications
            </h2>
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-[#8A9BAE] ring-1 ring-white/10">
              Coming soon
            </span>
          </div>

          <div className="mt-4 rounded-2xl bg-[#162030] p-5 ring-1 ring-[rgba(255,255,255,0.08)]">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7BA59A]/15">
                <svg
                  className="h-4 w-4 text-[#7BA59A]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-[#F0F2F5] font-medium">
                  Track your medications here
                </p>
                <p className="mt-2 text-sm text-[#8A9BAE] leading-relaxed">
                  This feature is coming soon — we are working on connecting
                  with health portals to automatically detect your
                  prescriptions. In the meantime, pharmacy visits from your
                  financial data are shown above.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
