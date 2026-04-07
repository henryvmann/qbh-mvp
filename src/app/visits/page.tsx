"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import HandleItButton from "../../components/qbh/HandleItButton";

/* ---------- Types ---------- */

type UpcomingVisit = {
  eventId: string;
  providerName: string;
  startAt: string;
  endAt: string;
  timezone: string | null;
};

type PastVisit = {
  id: string;
  providerId: string;
  providerName: string;
  visitDate: string | null;
  amountCents: number | null;
  source: string | null;
};

type FollowUp = {
  providerId: string;
  providerName: string;
};

type BookingAttempt = {
  id: string;
  providerName: string;
  status: string;
  createdAt: string;
  callSummary: string | null;
};

type ProviderSummary = {
  providerId: string;
  providerName: string;
  totalVisits: number;
  lastVisitDate: string | null;
  averageCost: number | null;
  monthsSinceLastVisit: number | null;
};

type MonthlySpend = {
  month: string;
  totalCents: number;
  visitCount: number;
};

/* ---------- Helpers ---------- */

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
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

function formatDollars(cents: number | null): string {
  if (cents == null) return "--";
  return `$${(cents / 100).toFixed(0)}`;
}

function formatDollarsFull(cents: number | null): string {
  if (cents == null) return "--";
  return `$${(cents / 100).toFixed(2)}`;
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[parseInt(m, 10) - 1] + " " + y.slice(2);
}

function statusColor(status: string): string {
  switch (status) {
    case "BOOKED_CONFIRMED":
      return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
    case "CALLING":
    case "IN_PROGRESS":
    case "PROPOSED":
    case "WAITING_APPROVAL":
      return "bg-blue-500/15 text-blue-400 ring-blue-500/30";
    case "FAILED":
      return "bg-red-500/15 text-red-400 ring-red-500/30";
    case "CREATED":
    default:
      return "bg-white/8 text-[#8A9BAE] ring-white/10";
  }
}

function monthsSinceColor(months: number | null): string {
  if (months == null) return "text-[#8A9BAE]";
  if (months < 6) return "text-emerald-400";
  if (months <= 12) return "text-amber-400";
  return "text-red-400";
}

/* ---------- Spending Chart ---------- */

function SpendingChart({ data }: { data: MonthlySpend[] }) {
  if (data.length === 0) return null;

  // Show last 12 months max
  const sliced = data.slice(-12);
  const maxAmount = Math.max(...sliced.map((d) => d.totalCents), 1);
  const chartHeight = 200;
  const barPadding = 4;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${sliced.length * 60 + 20} ${chartHeight + 50}`}
        className="w-full min-w-[300px]"
        style={{ maxWidth: sliced.length * 60 + 20 }}
      >
        {sliced.map((d, i) => {
          const barHeight = Math.max((d.totalCents / maxAmount) * chartHeight, 4);
          const x = i * 60 + 10 + barPadding;
          const barWidth = 60 - barPadding * 2;
          const y = chartHeight - barHeight;

          return (
            <g key={d.month}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={6}
                fill="#7BA59A"
                opacity={0.85}
              />
              {/* Amount label */}
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                fill="#F0F2F5"
                fontSize="11"
                fontWeight="600"
              >
                {formatDollars(d.totalCents)}
              </text>
              {/* Month label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 18}
                textAnchor="middle"
                fill="#8A9BAE"
                fontSize="10"
              >
                {monthLabel(d.month)}
              </text>
              {/* Visit count */}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 34}
                textAnchor="middle"
                fill="#4D6480"
                fontSize="9"
              >
                {d.visitCount} visit{d.visitCount !== 1 ? "s" : ""}
              </text>
            </g>
          );
        })}
        {/* Baseline */}
        <line
          x1="10"
          y1={chartHeight}
          x2={sliced.length * 60 + 10}
          y2={chartHeight}
          stroke="#8A9BAE"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

/* ---------- Main Component ---------- */

function VisitsInner() {
  const router = useRouter();

  const [upcoming, setUpcoming] = useState<UpcomingVisit[]>([]);
  const [past, setPast] = useState<PastVisit[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [bookingAttempts, setBookingAttempts] = useState<BookingAttempt[]>([]);
  const [providerSummaries, setProviderSummaries] = useState<ProviderSummary[]>([]);
  const [monthlySpending, setMonthlySpending] = useState<MonthlySpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [pastVisibleCount, setPastVisibleCount] = useState(20);

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
          setBookingAttempts(json.bookingAttempts ?? []);
          setProviderSummaries(json.providerSummaries ?? []);
          setMonthlySpending(json.monthlySpending ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <main className="min-h-screen bg-[#1E2228]" />;
  }

  // Compute total visits this year
  const currentYear = new Date().getFullYear().toString();
  const visitsThisYear = past.filter(
    (v) => v.visitDate && v.visitDate.startsWith(currentYear)
  ).length;

  // Group past visits by month for display
  const pastByMonth = new Map<string, PastVisit[]>();
  for (const v of past) {
    const key = v.visitDate ? v.visitDate.slice(0, 7) : "unknown";
    const arr = pastByMonth.get(key);
    if (arr) arr.push(v);
    else pastByMonth.set(key, [v]);
  }
  const pastMonthKeys = Array.from(pastByMonth.keys()).sort((a, b) =>
    b.localeCompare(a)
  );

  // Visible past visits
  const allPastFlat = pastMonthKeys.flatMap((k) => pastByMonth.get(k) ?? []);
  const visiblePast = allPastFlat.slice(0, pastVisibleCount);
  const hasMorePast = allPastFlat.length > pastVisibleCount;

  // Build month groups for visible items
  const visibleByMonth = new Map<string, PastVisit[]>();
  for (const v of visiblePast) {
    const key = v.visitDate ? v.visitDate.slice(0, 7) : "unknown";
    const arr = visibleByMonth.get(key);
    if (arr) arr.push(v);
    else visibleByMonth.set(key, [v]);
  }
  const visibleMonthKeys = Array.from(visibleByMonth.keys()).sort((a, b) =>
    b.localeCompare(a)
  );

  // Overdue providers (> 6 months since last visit)
  const overdueProviders = providerSummaries.filter(
    (p) => p.monthsSinceLastVisit != null && p.monthsSinceLastVisit >= 6
  );

  return (
    <main className="min-h-screen bg-[#1E2228] text-[#F0F2F5]">
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/5 text-[#8A9BAE] transition hover:bg-[#162030]"
              aria-label="Back to dashboard"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 12L6 8L10 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <div>
              <h1 className="font-serif text-2xl tracking-tight text-[#F0F2F5] sm:text-3xl">
                Visits
              </h1>
              <p className="mt-1 text-sm text-[#8A9BAE]">
                {visitsThisYear > 0
                  ? `${visitsThisYear} visit${visitsThisYear !== 1 ? "s" : ""} this year`
                  : "Your complete healthcare visit history"}
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Upcoming Appointments */}
        <section className="mt-8">
          <h2 className="font-serif text-xl text-[#F0F2F5]">
            Upcoming Appointments
          </h2>
          <p className="mt-1 text-sm text-[#8A9BAE]">
            {upcoming.length > 0
              ? `${upcoming.length} confirmed appointment${upcoming.length !== 1 ? "s" : ""}`
              : "No upcoming appointments"}
          </p>

          {upcoming.length > 0 ? (
            <div className="mt-4 space-y-3">
              {upcoming.map((visit) => (
                <div
                  key={visit.eventId}
                  className="flex flex-col gap-2 rounded-2xl border-l-[3px] border-l-[#7BA59A] bg-white/5 p-5 ring-1 ring-white/[0.08] backdrop-blur md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-semibold text-[#F0F2F5]">
                      {visit.providerName}
                    </div>
                    <div className="mt-1 text-sm text-[#8A9BAE]">
                      {formatDate(visit.startAt)} at {formatTime(visit.startAt)}
                    </div>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-full bg-[#7BA59A]/15 px-3 py-1 text-xs font-semibold text-[#7BA59A] ring-1 ring-[#7BA59A]/30">
                    Confirmed
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/[0.08] backdrop-blur">
              <p className="text-sm text-[#8A9BAE]">
                No upcoming appointments.{" "}
                <Link href="/dashboard" className="text-[#7BA59A] hover:underline">
                  Let Kate book one from your dashboard.
                </Link>
              </p>
            </div>
          )}
        </section>

        {/* Section 2: Needs Attention */}
        {(overdueProviders.length > 0 || followUps.length > 0) && (
          <section className="mt-10">
            <h2 className="font-serif text-xl text-[#F0F2F5]">
              Needs Attention
            </h2>
            <p className="mt-1 text-sm text-[#8A9BAE]">
              Providers you may be overdue with
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {overdueProviders.map((p) => (
                <div
                  key={p.providerId}
                  className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/[0.08] backdrop-blur"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-[#F0F2F5]">
                      {p.providerName}
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30">
                      Overdue
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#8A9BAE]">
                    Last visit {p.monthsSinceLastVisit} month{p.monthsSinceLastVisit !== 1 ? "s" : ""} ago
                    {p.totalVisits > 1 && ` (${p.totalVisits} total visits)`}
                  </p>
                  <HandleItButton
                    providerId={p.providerId}
                    providerName={p.providerName}
                    label="Let Kate book it"
                  />
                </div>
              ))}
              {followUps
                .filter(
                  (fu) => !overdueProviders.some((o) => o.providerId === fu.providerId)
                )
                .map((fu) => (
                  <div
                    key={fu.providerId}
                    className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/[0.08] backdrop-blur"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold text-[#F0F2F5]">
                        {fu.providerName}
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30">
                        Follow-up needed
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#8A9BAE]">
                      Kate can continue outreach to get this booked.
                    </p>
                    <HandleItButton
                      providerId={fu.providerId}
                      providerName={fu.providerName}
                      label="Let Kate book it"
                    />
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Section 3: Monthly Spending Chart */}
        <section className="mt-10">
          <h2 className="font-serif text-xl text-[#F0F2F5]">
            Monthly Spending
          </h2>
          <p className="mt-1 text-sm text-[#8A9BAE]">
            Healthcare spending trend by month
          </p>

          <div className="mt-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/[0.08] backdrop-blur">
            {monthlySpending.length > 0 ? (
              <SpendingChart data={monthlySpending} />
            ) : (
              <p className="text-sm text-[#8A9BAE]">
                No spending data yet. Connect your bank to discover your healthcare
                providers and track spending.
              </p>
            )}
          </div>
        </section>

        {/* Section 4: Provider Visit History */}
        <section className="mt-10">
          <h2 className="font-serif text-xl text-[#F0F2F5]">
            Provider Visit History
          </h2>
          <p className="mt-1 text-sm text-[#8A9BAE]">
            {providerSummaries.length > 0
              ? `${providerSummaries.length} provider${providerSummaries.length !== 1 ? "s" : ""} tracked`
              : "No providers tracked yet"}
          </p>

          {providerSummaries.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {providerSummaries.map((p) => (
                <div
                  key={p.providerId}
                  className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/[0.08] backdrop-blur"
                >
                  <div className="font-semibold text-[#F0F2F5]">
                    {p.providerName}
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#8A9BAE]">Total visits</span>
                      <span className="font-medium text-[#F0F2F5]">
                        {p.totalVisits}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8A9BAE]">Last visit</span>
                      <span className="font-medium text-[#F0F2F5]">
                        {formatShortDate(p.lastVisitDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8A9BAE]">Avg cost</span>
                      <span className="font-medium text-[#F0F2F5]">
                        {p.averageCost != null ? formatDollarsFull(p.averageCost) : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8A9BAE]">Months since last</span>
                      <span
                        className={`font-semibold ${monthsSinceColor(p.monthsSinceLastVisit)}`}
                      >
                        {p.monthsSinceLastVisit != null
                          ? p.monthsSinceLastVisit
                          : "--"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/[0.08] backdrop-blur">
              <p className="text-sm text-[#8A9BAE]">
                No visit history.{" "}
                <Link href="/dashboard" className="text-[#7BA59A] hover:underline">
                  Connect your bank to discover your healthcare providers.
                </Link>
              </p>
            </div>
          )}
        </section>

        {/* Section 5: Recent Booking Attempts */}
        <section className="mt-10">
          <h2 className="font-serif text-xl text-[#F0F2F5]">
            Recent Booking Attempts
          </h2>
          <p className="mt-1 text-sm text-[#8A9BAE]">
            What Kate has been doing on your behalf
          </p>

          {bookingAttempts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {bookingAttempts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/[0.08] backdrop-blur"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-[#F0F2F5]">
                        {a.providerName}
                      </div>
                      <div className="mt-1 text-xs text-[#8A9BAE]">
                        {formatDate(a.createdAt)}
                      </div>
                    </div>
                    <span
                      className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusColor(a.status)}`}
                    >
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {a.callSummary && (
                    <div className="mt-3 rounded-xl bg-[#162030] p-3 text-xs leading-relaxed text-[#8A9BAE]">
                      &ldquo;{a.callSummary}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/[0.08] backdrop-blur">
              <p className="text-sm text-[#8A9BAE]">
                No booking attempts yet. Once you let Kate book, activity shows
                here.
              </p>
            </div>
          )}
        </section>

        {/* Section 6: All Past Visits */}
        <section className="mt-10">
          <h2 className="font-serif text-xl text-[#F0F2F5]">
            All Past Visits
          </h2>
          <p className="mt-1 text-sm text-[#8A9BAE]">
            {past.length > 0
              ? `${past.length} visit${past.length !== 1 ? "s" : ""} from your financial data`
              : "Chronological visit history"}
          </p>

          {past.length > 0 ? (
            <div className="mt-4 space-y-6">
              {visibleMonthKeys.map((monthKey) => {
                const monthVisits = visibleByMonth.get(monthKey) ?? [];
                const label =
                  monthKey === "unknown"
                    ? "Unknown Date"
                    : new Date(monthKey + "-01").toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      });

                return (
                  <div key={monthKey}>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#4D6480]">
                      {label}
                    </h3>
                    <div className="space-y-2">
                      {monthVisits.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/[0.08] backdrop-blur"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[#F0F2F5]">
                              {v.providerName}
                            </div>
                            <div className="text-xs text-[#8A9BAE]">
                              {formatShortDate(v.visitDate)}
                            </div>
                          </div>
                          {v.amountCents != null && (
                            <span className="ml-4 shrink-0 text-sm font-semibold text-[#F0F2F5]">
                              {formatDollarsFull(v.amountCents)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {hasMorePast && (
                <button
                  type="button"
                  onClick={() => setPastVisibleCount((c) => c + 20)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/5 py-3 text-sm font-medium text-[#8A9BAE] transition hover:bg-[#162030]"
                >
                  Load more ({allPastFlat.length - pastVisibleCount} remaining)
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/[0.08] backdrop-blur">
              <p className="text-sm text-[#8A9BAE]">
                No visit history.{" "}
                <Link href="/dashboard" className="text-[#7BA59A] hover:underline">
                  Connect your bank to discover your healthcare providers.
                </Link>
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function VisitsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#1E2228]" />}>
      <VisitsInner />
    </Suspense>
  );
}
