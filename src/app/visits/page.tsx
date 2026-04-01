"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

import { formatDateRange } from "../../app/lib/QBH/format";

type DemoVisit = {
  date: string;
  title: string;
  provider: string;
  detail: string;
  tag: string;
};

type CalendarVisit = {
  providerName: string;
  eventId: string;
  startAt: string;
  endAt: string;
  timezone?: string | null;
};

type CalendarDay = {
  key: string;
  labelTop: string;
  labelBottom: string;
  visits: CalendarVisit[];
};

function startOfDayInTimezone(date: Date, timezone?: string | null): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone ?? undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "2000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return new Date(`${year}-${month}-${day}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildWeekDays(
  visits: CalendarVisit[],
  timezone?: string | null
): CalendarDay[] {
  const baseDate =
    visits.length > 0 ? new Date(visits[0].startAt) : new Date();
  const weekStart = startOfDayInTimezone(baseDate, timezone);

  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const key = formatDayKey(day);

    const dayVisits = visits.filter((visit) => {
      const visitDay = startOfDayInTimezone(
        new Date(visit.startAt),
        visit.timezone ?? timezone
      );
      return formatDayKey(visitDay) === key;
    });

    return {
      key,
      labelTop: day.toLocaleDateString("en-US", { weekday: "short" }),
      labelBottom: day.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      visits: dayVisits,
    };
  });
}

function formatVisitTime(startAt: string, timezone?: string | null): string {
  return new Date(startAt).toLocaleTimeString("en-US", {
    timeZone: timezone ?? undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

function WeekCalendar(props: { visits: CalendarVisit[] }) {
  if (props.visits.length === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-[#162030] p-5 ring-1 ring-white/8">
        <div className="font-semibold text-[#EFF4FF]">
          No confirmed upcoming appointments yet
        </div>
        <p className="mt-2 text-sm text-[#6B85A8]">
          As QBH books care through the live scheduling loop, upcoming visits
          will appear here automatically.
        </p>
      </div>
    );
  }

  const timezone = props.visits[0]?.timezone;
  const days = buildWeekDays(props.visits, timezone);

  return (
    <div className="mt-6 space-y-6">
      <div className="overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-7 gap-3">
          {days.map((day) => (
            <div
              key={day.key}
              className="rounded-2xl bg-[#162030] p-4 ring-1 ring-white/8"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[#4D6480]">
                {day.labelTop}
              </div>
              <div className="mt-1 text-sm font-medium text-[#EFF4FF]">
                {day.labelBottom}
              </div>

              <div className="mt-4 min-h-[140px] space-y-2">
                {day.visits.length > 0 ? (
                  day.visits.map((visit) => (
                    <div
                      key={visit.eventId}
                      className="rounded-xl bg-[#5DE8C5]/15 p-3 ring-1 ring-[#5DE8C5]/30"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#5DE8C5]">
                        {formatVisitTime(visit.startAt, visit.timezone)}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#EFF4FF]">
                        {visit.providerName}
                      </div>
                      <div className="mt-1 text-xs text-[#6B85A8]">
                        Confirmed
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-[#3D526B]">
                    No appointments
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-[#162030] p-5 ring-1 ring-white/8">
        <div className="text-sm font-semibold text-[#EFF4FF]">
          Upcoming care agenda
        </div>

        <div className="mt-4 space-y-4">
          {props.visits.map((visit) => (
            <div
              key={`${visit.eventId}-agenda`}
              className="flex flex-col gap-2 rounded-2xl bg-[#0F1520] p-4 ring-1 ring-white/8 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-semibold text-[#EFF4FF]">
                  {visit.providerName}
                </div>
                <div className="mt-1 text-sm text-[#6B85A8]">
                  {formatDateRange(
                    visit.startAt,
                    visit.endAt,
                    visit.timezone ?? undefined
                  )}
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#5DE8C5]/15 px-3 py-1 text-xs font-semibold text-[#5DE8C5] ring-1 ring-[#5DE8C5]/30">
                Live booking
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const pastVisits: DemoVisit[] = [
  {
    date: "February 20",
    title: "Routine lab work completed",
    provider: "Quest Diagnostics",
    detail: "Blood panel completed and added to your health record timeline.",
    tag: "Completed",
  },
  {
    date: "January 14",
    title: "Annual dermatology visit",
    provider: "NYU Dermatology",
    detail: "Skin check completed with recommendation for future follow-up.",
    tag: "Completed",
  },
];

const visitSummaries: DemoVisit[] = [
  {
    date: "Preview",
    title: "Transcript-backed visit summaries",
    provider: "Future QBH capability",
    detail:
      "QBH will summarize what happened during each appointment and connect it to next steps.",
    tag: "Future",
  },
  {
    date: "Preview",
    title: "Automatic follow-up detection",
    provider: "Future QBH capability",
    detail:
      "Recommended labs, referrals, and check-ins can roll directly into scheduling workflows.",
    tag: "Future",
  },
];

function VisitsInner() {
  const router = useRouter();

  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/dashboard/data")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) setSnapshots(json.snapshots);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <main className="min-h-screen bg-[#080C14]" />;
  }

  const upcomingVisits: CalendarVisit[] = snapshots
    .filter((s) => Boolean(s.futureConfirmedEvent))
    .map((s) => ({
      providerName: s.provider.name,
      eventId: s.futureConfirmedEvent.id,
      startAt: s.futureConfirmedEvent.start_at,
      endAt: s.futureConfirmedEvent.end_at,
      timezone: s.futureConfirmedEvent.timezone ?? undefined,
    }))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const followUpNeeded = snapshots.filter((s) => s.followUpNeeded);

  return (
    <main className="min-h-screen bg-[#080C14] text-[#EFF4FF]">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-[#EFF4FF]">
              Visits
            </h1>
            <p className="mt-2 max-w-2xl text-base text-[#6B85A8]">
              Upcoming appointments are grounded in QBH's live scheduling system.
              Past visits and summaries below are a demo preview of how the full
              Visits layer will evolve.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-[#0F1520] px-4 py-2 text-sm font-medium text-[#6B85A8] shadow-sm hover:bg-[#162030]"
          >
            Back to Dashboard
          </Link>
        </div>

        <section className="mt-8 rounded-2xl bg-[#0F1520] p-6 ring-1 ring-white/8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-[#EFF4FF]">
                Calendar view
              </h2>
              <p className="mt-2 text-sm text-[#6B85A8]">
                Upcoming confirmed appointments from the live QBH booking system.
              </p>
            </div>
            <span className="text-sm font-medium text-[#6B85A8]">
              {upcomingVisits.length} upcoming
            </span>
          </div>
          <WeekCalendar visits={upcomingVisits} />
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-[#0F1520] p-6 ring-1 ring-white/8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#EFF4FF]">
                  Follow-ups to schedule
                </h2>
                <p className="mt-2 text-sm text-[#6B85A8]">
                  Providers currently needing another scheduling push.
                </p>
              </div>
              <span className="text-sm font-medium text-[#6B85A8]">
                {followUpNeeded.length} open
              </span>
            </div>

            {followUpNeeded.length > 0 ? (
              <div className="mt-6 space-y-4">
                {followUpNeeded.map((snapshot) => (
                  <div
                    key={snapshot.provider.id}
                    className="rounded-2xl bg-[#162030] p-5 ring-1 ring-white/8"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-semibold text-[#EFF4FF]">
                        {snapshot.provider.name}
                      </div>
                      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30">
                        Follow-up needed
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#6B85A8]">
                      QBH can continue outreach and move this provider toward a
                      confirmed appointment.
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-[#162030] p-5 ring-1 ring-white/8">
                <div className="font-semibold text-[#EFF4FF]">
                  No open follow-ups right now
                </div>
                <p className="mt-2 text-sm text-[#6B85A8]">
                  Current providers are either booked already or not yet marked
                  for another scheduling attempt.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[#0F1520] p-6 ring-1 ring-white/8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#EFF4FF]">
                  Past visits preview
                </h2>
                <p className="mt-2 text-sm text-[#6B85A8]">
                  Seeded demo data showing how completed visits can look over
                  time.
                </p>
              </div>
              <span className="rounded-full bg-[#5DE8C5]/15 px-3 py-1 text-xs font-semibold text-[#5DE8C5] ring-1 ring-[#5DE8C5]/30">
                Demo preview
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {pastVisits.map((visit) => (
                <div
                  key={`${visit.date}-${visit.title}`}
                  className="rounded-2xl bg-[#162030] p-5 ring-1 ring-white/8"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-[#4D6480]">
                      {visit.date}
                    </div>
                    <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-[#6B85A8] ring-1 ring-white/10">
                      {visit.tag}
                    </span>
                  </div>
                  <div className="mt-2 font-semibold text-[#EFF4FF]">
                    {visit.title}
                  </div>
                  <div className="mt-1 text-sm text-[#6B85A8]">
                    {visit.provider}
                  </div>
                  <p className="mt-3 text-sm text-[#6B85A8]">{visit.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-[#0F1520] p-6 ring-1 ring-white/8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-[#EFF4FF]">
                Visit summaries preview
              </h2>
              <p className="mt-2 text-sm text-[#6B85A8]">
                Future QBH layer connecting scheduling, transcripts, outcomes,
                and recommended next steps.
              </p>
            </div>
            <span className="rounded-full bg-[#5DE8C5]/15 px-3 py-1 text-xs font-semibold text-[#5DE8C5] ring-1 ring-[#5DE8C5]/30">
              Future layer
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {visitSummaries.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-[#162030] p-5 ring-1 ring-white/8"
              >
                <div className="font-semibold text-[#EFF4FF]">{item.title}</div>
                <div className="mt-1 text-sm text-[#6B85A8]">{item.provider}</div>
                <p className="mt-3 text-sm text-[#6B85A8]">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function VisitsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#080C14]" />}>
      <VisitsInner />
    </Suspense>
  );
}
