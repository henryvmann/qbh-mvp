// src/app/dashboard/page.tsx

import Link from "next/link";

import ProviderCard from "../../components/qbh/ProviderCard";
import DailyBrief from "../../components/qbh/DailyBrief";
import DashboardAnalyzer from "../../components/qbh/DashboardAnalyzer";
import DashboardHandleAllButton from "../../components/qbh/DashboardHandleAllButton";
import {
  getDashboardProvidersForUser,
  getDashboardDiscoverySummaryForUser,
} from "../../lib/qbh/queries/dashboard";

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams?: Promise<SearchParams> };

type DashboardStat = {
  label: string;
  value: string;
};

function firstString(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

function classifyProvider(name: string): "doctor" | "lab" | "pharmacy" {
  const n = name.toLowerCase();

  if (
    n.includes("quest") ||
    n.includes("labcorp") ||
    n.includes("diagnostic") ||
    n.includes("lab") ||
    n.includes("imaging") ||
    n.includes("radiology") ||
    n.includes("testing")
  ) {
    return "lab";
  }

  if (
    n.includes("cvs") ||
    n.includes("walgreens") ||
    n.includes("rite aid") ||
    n.includes("pharmacy")
  ) {
    return "pharmacy";
  }

  return "doctor";
}

function TopNav() {
  const items = [
    { label: "Goals", href: "/goals" },
    { label: "Visits", href: "/visits" },
    { label: "Timeline", href: "/timeline" },
    { label: "Medications", href: "/medications" },
    { label: "Caregivers", href: "/caregivers" },
  ];

  return (
    <nav className="mt-5 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}

function ProviderGroupSection(props: {
  title: string;
  userId: string;
  snapshots: Awaited<ReturnType<typeof getDashboardProvidersForUser>>;
}) {
  if (props.snapshots.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        {props.title}
      </h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {props.snapshots.map((s) => (
          <ProviderCard
            key={s.provider.id}
            snapshot={s}
            userId={props.userId}
          />
        ))}
      </div>
    </section>
  );
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const userIdFromQuery = firstString(sp.user_id);
  const userIdFromEnv = (process.env.QBH_DEMO_USER_ID || "").trim();
  const userId = (userIdFromQuery || userIdFromEnv || "").trim();
  const isAnalyzing = firstString(sp.analyzing) === "1";

  const [snapshots, discoverySummary] = await Promise.all([
    getDashboardProvidersForUser(userId),
    getDashboardDiscoverySummaryForUser(userId),
  ]);

  const doctors = snapshots.filter(
    (s) => classifyProvider(s.provider.name) === "doctor"
  );
  const labs = snapshots.filter(
    (s) => classifyProvider(s.provider.name) === "lab"
  );
  const pharmacies = snapshots.filter(
    (s) => classifyProvider(s.provider.name) === "pharmacy"
  );

  const actionableProviders = snapshots
    .filter((s) => !s.futureConfirmedEvent)
    .map((s) => ({
      providerId: s.provider.id,
      providerName: s.provider.name,
    }));

  const followUps = snapshots.filter((s) => s.followUpNeeded).length;
  const upcoming = snapshots.filter((s) =>
    Boolean(s.futureConfirmedEvent)
  ).length;
  const inProgress = snapshots.filter(
    (s) => !s.futureConfirmedEvent && !s.followUpNeeded
  ).length;

  const stats: DashboardStat[] = [
    {
      label: "Providers",
      value: String(snapshots.length),
    },
    {
      label: "Charges",
      value: String(discoverySummary.chargesAnalyzed),
    },
    {
      label: "Upcoming",
      value: String(upcoming),
    },
    {
      label: "Follow-ups",
      value: String(followUps),
    },
  ];

  const showAnalyzer = Boolean(userId) && isAnalyzing;

  return (
    <main className="min-h-screen bg-[#F5F1E8] px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <header>
          <h1 className="font-serif text-4xl tracking-tight text-slate-900">
            Quarterback
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Your care, organized.
          </p>
        </header>

        <DashboardAnalyzer userId={userId} enabled={showAnalyzer} />

        {!showAnalyzer ? (
          <>
            <DailyBrief upcoming={upcoming} followUps={followUps} name="Henry" />

            <TopNav />

            <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {stats.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                />
              ))}
            </section>

            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-serif text-2xl tracking-tight text-slate-900">
                    Providers
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Discovered from your healthcare spending and tracked here.
                  </p>
                </div>

                <DashboardHandleAllButton
                  userId={userId}
                  providers={actionableProviders}
                />
              </div>
            </section>

            <div id="provider-cards" className="mt-8 space-y-10">
              <ProviderGroupSection
                title="Doctors"
                userId={userId}
                snapshots={doctors}
              />

              <ProviderGroupSection
                title="Labs"
                userId={userId}
                snapshots={labs}
              />

              <ProviderGroupSection
                title="Pharmacies"
                userId={userId}
                snapshots={pharmacies}
              />
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}