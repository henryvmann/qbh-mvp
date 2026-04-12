"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import TopNav from "../../components/qbh/TopNav";
import HandleItButton from "../../components/qbh/HandleItButton";

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
    return <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />;
  }

  return (
    <main className="min-h-screen text-[#1A1D2E]" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
      <TopNav />
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
        <div className="mb-2">
          <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E]">
            Visits
          </h1>
          <p className="mt-1 text-sm text-[#7A7F8A]">
            Upcoming appointments and past visits
          </p>
        </div>

        {/* Upcoming visits */}
        <section className="mt-8 rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-[#1A1D2E]">
                Upcoming visits
              </h2>
              <p className="mt-2 text-sm text-[#7A7F8A]">
                Confirmed appointments from the QBH booking system.
              </p>
            </div>
            <span className="text-sm font-medium text-[#7A7F8A]">
              {upcoming.length} upcoming
            </span>
          </div>

          {upcoming.length > 0 ? (
            <div className="mt-6 space-y-4">
              {upcoming.map((visit) => (
                <div
                  key={visit.id}
                  className="flex flex-col gap-2 rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0] md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-semibold text-[#1A1D2E]">
                      {visit.provider_name}
                    </div>
                    <div className="mt-1 text-sm text-[#7A7F8A]">
                      {formatDate(visit.start_at)} at{" "}
                      {formatTime(visit.start_at)}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-[#5C6B5C]/15 px-3 py-1 text-xs font-semibold text-[#5C6B5C] ring-1 ring-[#5C6B5C]/30">
                    {visit.status ?? "Confirmed"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]">
              <div className="font-semibold text-[#1A1D2E]">
                No confirmed upcoming appointments yet
              </div>
              <p className="mt-2 text-sm text-[#7A7F8A]">
                As QBH books care through the live scheduling loop, upcoming
                visits will appear here automatically.
              </p>
            </div>
          )}
        </section>

        {/* Follow-ups and Past visits side by side */}
        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Follow-ups */}
          <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#1A1D2E]">
                  Follow-ups to schedule
                </h2>
                <p className="mt-2 text-sm text-[#7A7F8A]">
                  Providers currently needing another scheduling push.
                </p>
              </div>
              <span className="text-sm font-medium text-[#7A7F8A]">
                {followUps.length} open
              </span>
            </div>

            {followUps.length > 0 ? (
              <div className="mt-6 space-y-4">
                {followUps.map((fu) => (
                  <div
                    key={fu.provider_id}
                    className="rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-semibold text-[#1A1D2E]">
                        {fu.provider_name}
                      </div>
                      <span className="rounded-full bg-[#F0B8B0]/30 px-3 py-1 text-xs font-semibold text-[#C03020] ring-1 ring-[#F0B8B0]">
                        Needs booking
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#7A7F8A]">
                      Kate can call and schedule this for you.
                    </p>
                    <HandleItButton
                      providerId={fu.provider_id}
                      providerName={fu.provider_name}
                      label="Book with Kate"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]">
                <div className="font-semibold text-[#1A1D2E]">
                  No open follow-ups right now
                </div>
                <p className="mt-2 text-sm text-[#7A7F8A]">
                  Current providers are either booked already or not yet marked
                  for another scheduling attempt.
                </p>
              </div>
            )}
          </div>

          {/* Past visits */}
          <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#1A1D2E]">
                  Past visits
                </h2>
                <p className="mt-2 text-sm text-[#7A7F8A]">
                  Visits found from your financial data analysis.
                </p>
              </div>
              <span className="text-sm font-medium text-[#7A7F8A]">
                {past.length} visits
              </span>
            </div>

            {past.length > 0 ? (
              <div className="mt-6 space-y-4">
                {past.map((visit) => (
                  <div
                    key={visit.id}
                    className="rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-semibold text-[#B0B4BC]">
                        {formatDate(visit.visit_date)}
                      </div>
                      <span className="rounded-full bg-[#F0F2F5] px-3 py-1 text-xs font-semibold text-[#7A7F8A] ring-1 ring-[#EBEDF0]">
                        Completed
                      </span>
                    </div>
                    <div className="mt-2 font-semibold text-[#1A1D2E]">
                      {visit.provider_name}
                    </div>
                    {visit.amount_cents != null && (
                      <p className="mt-1 text-sm text-[#7A7F8A]">
                        {formatAmount(visit.amount_cents)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]">
                <div className="font-semibold text-[#1A1D2E]">
                  No past visits found yet
                </div>
                <p className="mt-2 text-sm text-[#7A7F8A]">
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
    <Suspense fallback={<main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />}>
      <VisitsInner />
    </Suspense>
  );
}
