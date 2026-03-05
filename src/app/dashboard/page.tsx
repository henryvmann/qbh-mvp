// src/app/dashboard/page.tsx

import Link from "next/link";

import ProviderCard from "../../components/qbh/ProviderCard";
import DailyBrief from "../../components/qbh/DailyBrief";
import { getDashboardProvidersForUser } from "../../lib/QBH/queries/dashboard";

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams?: Promise<SearchParams> };

function firstString(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

function SectionHeader(props: {
  title: string;
  href: string;
  cta: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl tracking-tight text-slate-900">
          {props.title}
        </h2>

        <Link
          href={props.href}
          className="text-sm font-medium text-[#8B9D83] hover:underline"
        >
          {props.cta} →
        </Link>
      </div>

      {props.subtitle ? (
        <p className="text-sm text-slate-600">{props.subtitle}</p>
      ) : null}
    </div>
  );
}

function TopNav() {
  const items = [
    { label: "Goals", href: "/goals" },
    { label: "Timeline", href: "/timeline" },
    { label: "Visits", href: "/visits" },
    { label: "Medications", href: "/medications" },
    { label: "Caregivers", href: "/caregivers" },
  ];

  return (
    <nav className="mt-5 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-xl bg-[#F7FAF6] px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          Explore
        </span>

        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const userIdFromQuery = firstString(sp.user_id);
  const userIdFromEnv = (process.env.QBH_DEMO_USER_ID || "").trim();
  const userId = (userIdFromQuery || userIdFromEnv || "").trim();

  const snapshots = await getDashboardProvidersForUser(userId);

  const followUps = snapshots.filter((s) => s.followUpNeeded).length;
  const upcoming = snapshots.filter((s) => Boolean(s.futureConfirmedEvent)).length;

  return (
    <main className="min-h-screen bg-[#F5F1E8] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-serif text-4xl tracking-tight text-slate-900">
              Health Dashboard
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Your health command center — scheduling, status, and next steps.
            </p>
          </div>

          {/* Full-width Daily Brief */}
          <DailyBrief upcoming={upcoming} followUps={followUps} name="Henry" />

          {/* Top navigation strip */}
          <TopNav />
        </div>

        {/* Snapshot Sections (shell UI only) */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Goals */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <SectionHeader
              title="Goals"
              href="/goals"
              cta="View all"
              subtitle="Set priorities across preventive care, ongoing care, and household health."
            />

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-900">
                  Preventive care
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Physicals, screenings, annual check-ins.
                </div>
              </div>

              <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-900">
                  Ongoing care
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Chronic plans tied to meds, labs, follow-ups.
                </div>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <SectionHeader
              title="Timeline"
              href="/timeline"
              cta="View timeline"
              subtitle="A longitudinal record of visits, tests, and key changes over time."
            />

            <div className="mt-5 rounded-2xl bg-[#FBFBF9] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Coming soon
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Timeline will aggregate events from visits, medications, and
                follow-ups into a single scrollable history.
              </p>
            </div>
          </section>
        </div>

        {/* Providers (existing, real data) */}
        <div className="mt-8">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl tracking-tight text-slate-900">
                Providers
              </h2>

              <span className="text-sm font-medium text-slate-600">
                {snapshots.length} connected
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-600">
              Provider cards and booking status are derived from Supabase.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {snapshots.map((s) => (
              <ProviderCard key={s.provider.id} snapshot={s} />
            ))}
          </div>
        </div>

        {/* Other sections as links (shell-only) */}
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Link
            href="/visits"
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <div className="font-serif text-xl text-slate-900">Visits</div>
            <div className="mt-2 text-sm text-slate-600">
              Upcoming and past appointments, summaries, and follow-ups.
            </div>
          </Link>

          <Link
            href="/medications"
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <div className="font-serif text-xl text-slate-900">Medications</div>
            <div className="mt-2 text-sm text-slate-600">
              Medication list, changes over time, and refill context.
            </div>
          </Link>

          <Link
            href="/caregivers"
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <div className="font-serif text-xl text-slate-900">Caregivers</div>
            <div className="mt-2 text-sm text-slate-600">
              Shared care workflows and permissions (future).
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}