"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type UpcomingVisit = {
  id: string;
  provider_name: string;
  start_at: string;
  status: string;
};

type PastVisit = {
  id: string;
  provider_name: string;
  visit_date: string | null;
  amount_cents: number | null;
  source: string | null;
};

type FollowUp = {
  provider_id: string;
  provider_name: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAmount(cents: number | null): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

function VisitsInner() {
  const router = useRouter();

  const [upcoming, setUpcoming] = useState<UpcomingVisit[]>([]);
  const [past, setPast] = useState<PastVisit[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/visits/data")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) {
          setUpcoming(json.upcoming ?? []);
          setPast(json.past ?? []);
          setFollowUps(json.followUps ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <main className="min-h-screen bg-[#1A1D23]" />;
  }

  return (
    <main className="min-h-screen bg-[#1A1D23] text-[#F0F2F5]">
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-[#F0F2F5]">
              Visits
            </h1>
            <p className="mt-2 max-w-2xl text-base text-[#8A9BAE]">
              Upcoming appointments from QBH scheduling and past visits from
              your financial data.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/8 bg-white/5 px-4 py-2 text-sm font-medium text-[#8A9BAE] shadow-sm hover:bg-[#162030]"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Upcoming visits */}
        <section className="mt-8 rounded-2xl bg-white/5 p-6 ring-1 ring-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-[#F0F2F5]">
                Upcoming visits
              </h2>
              <p className="mt-2 text-sm text-[#8A9BAE]">
                Confirmed appointments from the QBH booking system.
              </p>
            </div>
            <span className="text-sm font-medium text-[#8A9BAE]">
              {upcoming.length} upcoming
            </span>
          </div>

          {upcoming.length > 0 ? (
            <div className="mt-6 space-y-4">
              {upcoming.map((visit) => (
                <div
                  key={visit.id}
                  className="flex flex-col gap-2 rounded-2xl bg-[#162030] p-5 ring-1 ring-[rgba(255,255,255,0.08)] md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-semibold text-[#F0F2F5]">
                      {visit.provider_name}
                    </div>
                    <div className="mt-1 text-sm text-[#8A9BAE]">
                      {formatDate(visit.start_at)} at{" "}
                      {formatTime(visit.start_at)}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-[#7BA59A]/15 px-3 py-1 text-xs font-semibold text-[#7BA59A] ring-1 ring-[#7BA59A]/30">
                    {visit.status ?? "Confirmed"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-[#162030] p-5 ring-1 ring-[rgba(255,255,255,0.08)]">
              <div className="font-semibold text-[#F0F2F5]">
                No confirmed upcoming appointments yet
              </div>
              <p className="mt-2 text-sm text-[#8A9BAE]">
                As QBH books care through the live scheduling loop, upcoming
                visits will appear here automatically.
              </p>
            </div>
          )}
        </section>

        {/* Follow-ups and Past visits side by side */}
        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Follow-ups */}
          <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#F0F2F5]">
                  Follow-ups to schedule
                </h2>
                <p className="mt-2 text-sm text-[#8A9BAE]">
                  Providers currently needing another scheduling push.
                </p>
              </div>
              <span className="text-sm font-medium text-[#8A9BAE]">
                {followUps.length} open
              </span>
            </div>

            {followUps.length > 0 ? (
              <div className="mt-6 space-y-4">
                {followUps.map((fu) => (
                  <div
                    key={fu.provider_id}
                    className="rounded-2xl bg-[#162030] p-5 ring-1 ring-[rgba(255,255,255,0.08)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-semibold text-[#F0F2F5]">
                        {fu.provider_name}
                      </div>
                      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30">
                        Follow-up needed
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#8A9BAE]">
                      QBH can continue outreach and move this provider toward a
                      confirmed appointment.
                    </p>
                    <Link
                      href="/dashboard"
                      className="mt-3 inline-block text-sm font-medium text-[#7BA59A] hover:underline"
                    >
                      View on dashboard
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-[#162030] p-5 ring-1 ring-[rgba(255,255,255,0.08)]">
                <div className="font-semibold text-[#F0F2F5]">
                  No open follow-ups right now
                </div>
                <p className="mt-2 text-sm text-[#8A9BAE]">
                  Current providers are either booked already or not yet marked
                  for another scheduling attempt.
                </p>
              </div>
            )}
          </div>

          {/* Past visits */}
          <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#F0F2F5]">
                  Past visits
                </h2>
                <p className="mt-2 text-sm text-[#8A9BAE]">
                  Visits found from your financial data analysis.
                </p>
              </div>
              <span className="text-sm font-medium text-[#8A9BAE]">
                {past.length} visits
              </span>
            </div>

            {past.length > 0 ? (
              <div className="mt-6 space-y-4">
                {past.map((visit) => (
                  <div
                    key={visit.id}
                    className="rounded-2xl bg-[#162030] p-5 ring-1 ring-[rgba(255,255,255,0.08)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-semibold text-[#4D6480]">
                        {formatDate(visit.visit_date)}
                      </div>
                      <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-[#8A9BAE] ring-1 ring-white/10">
                        Completed
                      </span>
                    </div>
                    <div className="mt-2 font-semibold text-[#F0F2F5]">
                      {visit.provider_name}
                    </div>
                    {visit.amount_cents != null && (
                      <p className="mt-1 text-sm text-[#8A9BAE]">
                        {formatAmount(visit.amount_cents)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-[#162030] p-5 ring-1 ring-[rgba(255,255,255,0.08)]">
                <div className="font-semibold text-[#F0F2F5]">
                  No past visits found yet
                </div>
                <p className="mt-2 text-sm text-[#8A9BAE]">
                  Past visits will appear once QBH analyzes your financial data.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function VisitsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#1A1D23]" />}>
      <VisitsInner />
    </Suspense>
  );
}
