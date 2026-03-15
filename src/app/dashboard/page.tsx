// src/app/dashboard/page.tsx

import Link from "next/link";

import ProviderCard from "../../components/qbh/ProviderCard";
import DailyBrief from "../../components/qbh/DailyBrief";
import { getDashboardProvidersForUser } from "../../lib/qbh/queries/dashboard";

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams?: Promise<SearchParams> };

type DashboardStat = {
  label: string;
  value: string;
  helper: string;
};

type PreviewItem = {
  title: string;
  detail: string;
  meta?: string;
};

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
      <div className="flex items-center justify-between gap-4">
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
    { label: "Upcoming Care", href: "/visits" },
    { label: "Timeline", href: "/timeline" },
    { label: "Medications", href: "/medications" },
    { label: "Caregivers", href: "/caregivers" },
  ];

  return (
    <nav className="mt-5 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-xl bg-[#F7FAF6] px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          Health OS
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

function StatCard(props: DashboardStat) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="text-sm font-medium text-slate-600">{props.label}</div>
      <div className="mt-2 font-serif text-3xl tracking-tight text-slate-900">
        {props.value}
      </div>
      <div className="mt-2 text-sm text-slate-600">{props.helper}</div>
    </div>
  );
}

function PreviewList(props: { items: PreviewItem[] }) {
  return (
    <div className="mt-5 space-y-3">
      {props.items.map((item) => (
        <div
          key={`${item.title}-${item.detail}`}
          className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200"
        >
          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
          <div className="mt-1 text-sm text-slate-600">{item.detail}</div>
          {item.meta ? (
            <div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {item.meta}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FeaturePreviewCard(props: {
  title: string;
  href: string;
  cta: string;
  subtitle: string;
  badge?: string;
  items: PreviewItem[];
}) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl tracking-tight text-slate-900">
              {props.title}
            </h2>

            {props.badge ? (
              <span className="rounded-full bg-[#F7FAF6] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#6F8168] ring-1 ring-slate-200">
                {props.badge}
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-slate-600">{props.subtitle}</p>
        </div>

        <Link
          href={props.href}
          className="shrink-0 text-sm font-medium text-[#8B9D83] hover:underline"
        >
          {props.cta} →
        </Link>
      </div>

      <PreviewList items={props.items} />
    </section>
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
  const waitingOnOffice = snapshots.filter(
    (s) => !s.futureConfirmedEvent && !s.followUpNeeded
  ).length;

  const stats: DashboardStat[] = [
    {
      label: "Connected providers",
      value: String(snapshots.length),
      helper: "Live provider cards and booking state from the backend system of record.",
    },
    {
      label: "Upcoming bookings",
      value: String(upcoming),
      helper: "Confirmed appointments QBH has already lined up.",
    },
    {
      label: "Needs follow-up",
      value: String(followUps),
      helper: "Providers that likely need another outreach attempt.",
    },
    {
      label: "In progress",
      value: String(waitingOnOffice),
      helper: "Providers with active work but no confirmed visit yet.",
    },
  ];

  const goalsPreview: PreviewItem[] = [
    {
      title: "Stay ahead of preventive care",
      detail: "Annual physical, dermatology skin check, and routine labs tracked in one place.",
      meta: "Seeded demo data",
    },
    {
      title: "Keep follow-ups from slipping",
      detail: "Turn doctor recommendations into visible next steps with reminders and scheduling support.",
      meta: "Future Health OS",
    },
    {
      title: "Coordinate household care",
      detail: "Manage solo, couple, family, or caregiving workflows from one shared dashboard.",
      meta: "Future Health OS",
    },
  ];

  const upcomingCarePreview: PreviewItem[] = [
    {
      title: upcoming > 0 ? `${upcoming} confirmed appointment${upcoming === 1 ? "" : "s"}` : "No confirmed appointments yet",
      detail:
        upcoming > 0
          ? "Confirmed visits are already flowing from the live booking system into the dashboard."
          : "As QBH books care, upcoming visits will appear here automatically.",
      meta: "Live backend-aware summary",
    },
    {
      title: "Handle scheduling for me",
      detail: "QBH can call offices, confirm availability, and move from outreach to booking.",
      meta: "Working today",
    },
    {
      title: "Calendar-driven care coordination",
      detail: "Future state: use real calendar availability to auto-book into open slots and confirm afterward.",
      meta: "Roadmap",
    },
  ];

  const timelinePreview: PreviewItem[] = [
    {
      title: "Visit booked",
      detail: "A confirmed appointment becomes part of a longitudinal medical memory timeline.",
      meta: "Health Memory preview",
    },
    {
      title: "Medication change",
      detail: "Dose adjustments and refill events will appear alongside visits and care decisions.",
      meta: "Future platform",
    },
    {
      title: "Lab or diagnosis milestone",
      detail: "Important health events roll up into one clean history instead of getting lost across portals.",
      meta: "Future platform",
    },
  ];

  const insightsPreview: PreviewItem[] = [
    {
      title: "What needs attention now",
      detail: "AI will surface missed follow-ups, unresolved referrals, and likely next actions.",
      meta: "AI Insights preview",
    },
    {
      title: "Patterns across your care",
      detail: "QBH will connect financial, visit, medication, and memory data into practical suggestions.",
      meta: "Future platform",
    },
    {
      title: "Explainable recommendations",
      detail: "Each insight should tie back to actual appointments, records, or household context.",
      meta: "Product direction",
    },
  ];

  const medicationPreview: PreviewItem[] = [
    {
      title: "Unified medication list",
      detail: "Track active medications, changes over time, and refill context in one place.",
      meta: "Medications preview",
    },
    {
      title: "Tie meds to visits",
      detail: "Medication updates can connect directly to appointments, provider instructions, and symptoms.",
      meta: "Future platform",
    },
  ];

  const caregiverPreview: PreviewItem[] = [
    {
      title: "Shared household visibility",
      detail: "Support family or caregiving setups with clear permissions and role-based access.",
      meta: "Caregivers preview",
    },
    {
      title: "Delegated coordination",
      detail: "Let a spouse, parent, or caregiver help manage scheduling and follow-through without chaos.",
      meta: "Future platform",
    },
  ];

  return (
    <main className="min-h-screen bg-[#F5F1E8] px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4">
          <div>
<h1 className="font-serif text-4xl tracking-tight text-slate-900">
Quarterback Health
</h1>

<p className="mt-2 text-sm text-slate-600">
Your health command center — scheduling, memory, insights, and coordination.
</p>

            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              QBH today: real providers, real booking status, real scheduling
              orchestration. QBH tomorrow: a full Health OS for memory,
              intelligence, coordination, medications, and caregivers.
            </p>
          </div>

          <DailyBrief upcoming={upcoming} followUps={followUps} name="Henry" />

          <TopNav />
        </div>

        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              helper={stat.helper}
            />
          ))}
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <FeaturePreviewCard
              title="Goals"
              href="/goals"
              cta="View all"
              subtitle="Set priorities across preventive care, ongoing care, and household health."
              badge="Health OS"
              items={goalsPreview}
            />
          </div>

          <div className="xl:col-span-1">
            <FeaturePreviewCard
              title="Upcoming Care"
              href="/visits"
              cta="Open visits"
              subtitle="A combined view of what QBH has booked, what is in motion, and what comes next."
              badge="Today + future"
              items={upcomingCarePreview}
            />
          </div>
        </section>

        <section className="mt-8">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-serif text-2xl tracking-tight text-slate-900">
                  Providers
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  These providers are connected to QBH. Their booking status updates automatically as QBH schedules and confirms appointments.
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <a
                  href="#provider-cards"
                  className="inline-flex items-center rounded-2xl bg-[#8B9D83] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:brightness-95 active:brightness-90"
                >
                  Handle All
                </a>

                <div className="text-xs text-slate-500">
                  QBH can work through providers one by one based on priority.
                </div>

                <span className="text-sm font-medium text-slate-600">
                  {snapshots.length} connected
                </span>
              </div>
            </div>
          </div>

          <div
            id="provider-cards"
            className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2"
          >            {snapshots.map((s) => (
              <ProviderCard key={s.provider.id} snapshot={s} />
            ))}
          </div>
        </section>

{/* Future Platform Divider */}

<div className="mt-12 mb-4 flex items-center gap-3">
  <div className="h-px flex-1 bg-slate-200" />
  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
Live scheduling system
  </span>
  <div className="h-px flex-1 bg-slate-200" />
</div>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FeaturePreviewCard
            title="Timeline Preview"
            href="/timeline"
            cta="View timeline"
            subtitle="Health Memory turns visits, changes, and follow-ups into a longitudinal record."
            badge="Future layer"
            items={timelinePreview}
          />

          <FeaturePreviewCard
            title="AI Insights Preview"
            href="/timeline"
            cta="See platform vision"
            subtitle="A forward look at how QBH will turn health events into actionable guidance."
            badge="AI layer"
            items={insightsPreview}
          />
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FeaturePreviewCard
            title="Medications Preview"
            href="/medications"
            cta="Open medications"
            subtitle="Medication history, refill context, and future tie-ins to care plans."
            badge="Future layer"
            items={medicationPreview}
          />

          <FeaturePreviewCard
            title="Caregivers Preview"
            href="/caregivers"
            cta="Open caregivers"
            subtitle="A foundation for shared care workflows, family access, and delegated coordination."
            badge="Future layer"
            items={caregiverPreview}
          />
        </section>
      </div>
    </main>
  );
}