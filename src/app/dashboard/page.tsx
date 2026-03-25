// src/app/dashboard/page.tsx

import Link from "next/link";

import ProviderCard from "../../components/qbh/ProviderCard";
import DailyBrief from "../../components/qbh/DailyBrief";
import DashboardAnalyzer from "../../components/qbh/DashboardAnalyzer";
import DashboardHandleAllButton from "../../components/qbh/DashboardHandleAllButton";
import {
  getDashboardProvidersForUser,
  getDashboardDiscoverySummaryForUser,
  getGoogleCalendarConnectionForUser,
} from "../../lib/qbh/queries/dashboard";

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams?: Promise<SearchParams> };

type DashboardStat = {
  label: string;
  value: string;
};

type DashboardSnapshot = Awaited<
  ReturnType<typeof getDashboardProvidersForUser>
>[number];

function firstString(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

function hasConfirmedBooking(snapshot: DashboardSnapshot): boolean {
  return snapshot.booking_state.status === "BOOKED";
}

function hasActiveBookingState(snapshot: DashboardSnapshot): boolean {
  return snapshot.booking_state.status === "IN_PROGRESS";
}

function hasBrokenSchedulingState(snapshot: DashboardSnapshot): boolean {
  return snapshot.system_actions.integrity.hasMultipleFutureConfirmedEvents;
}

function isHandleAllEligible(snapshot: DashboardSnapshot): boolean {
  if (hasBrokenSchedulingState(snapshot)) {
    return false;
  }

  return (
    snapshot.followUpNeeded &&
    snapshot.system_actions.next?.type === "BOOK_APPOINTMENT" &&
    snapshot.system_actions.next?.status === "PENDING"
  );
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

function CalendarConnectionBanner(props: {
  userId: string;
  isConnected: boolean;
}) {
  const href = `/calendar-connect?user_id=${encodeURIComponent(props.userId)}`;

  if (props.isConnected) {
    return (
      <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900">
              Google Calendar connected
            </div>
            <div className="mt-1 text-sm text-slate-600">
              QBH can use your real availability to protect your schedule before
              booking starts.
            </div>
          </div>

          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Manage calendar
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl bg-[#FCFBF8] p-5 shadow-sm ring-1 ring-[#DDD6C8]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-slate-900">
            Connect Google Calendar for better booking
          </div>
          <div className="mt-1 text-sm text-slate-600">
            QBH works better with your real availability, but you can still
            continue without connecting it right now.
          </div>
        </div>

        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-xl bg-[#8B9D83] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
        >
          Connect calendar
        </Link>
      </div>
    </section>
  );
}

function IntegrityBanner(props: { brokenCount: number }) {
  if (props.brokenCount <= 0) return null;

  return (
    <section className="mt-8 rounded-2xl bg-red-50 p-5 shadow-sm ring-1 ring-red-200">
      <div className="text-sm font-medium text-red-900">
        Scheduling integrity issue detected
      </div>
      <div className="mt-1 text-sm text-red-700">
        QBH found {props.brokenCount} provider
        {props.brokenCount === 1 ? "" : "s"} with multiple future confirmed
        appointments. Those cards are being held out of normal booking actions
        until reviewed.
      </div>
    </section>
  );
}

function ProviderGroupSection(props: {
  title: string;
  userId: string;
  hasGoogleCalendarConnection: boolean;
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
            hasGoogleCalendarConnection={props.hasGoogleCalendarConnection}
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

  const [snapshots, discoverySummary, hasGoogleCalendarConnection] =
    await Promise.all([
      getDashboardProvidersForUser(userId),
      getDashboardDiscoverySummaryForUser(userId),
      getGoogleCalendarConnectionForUser(userId),
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
    .filter((s) => isHandleAllEligible(s))
    .map((s) => ({
      providerId: s.provider.id,
      providerName: s.provider.name,
    }));

  const followUps = snapshots.filter((s) => s.followUpNeeded).length;
  const upcoming = snapshots.filter((s) => hasConfirmedBooking(s)).length;
  const inProgress = snapshots.filter((s) => hasActiveBookingState(s)).length;
  const broken = snapshots.filter((s) => hasBrokenSchedulingState(s)).length;

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

            <CalendarConnectionBanner
              userId={userId}
              isConnected={hasGoogleCalendarConnection}
            />

            <IntegrityBanner brokenCount={broken} />

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
                  hasGoogleCalendarConnection={hasGoogleCalendarConnection}
                />
              </div>
            </section>

            <div id="provider-cards" className="mt-8 space-y-10">
              <ProviderGroupSection
                title="Doctors"
                userId={userId}
                hasGoogleCalendarConnection={hasGoogleCalendarConnection}
                snapshots={doctors}
              />

              <ProviderGroupSection
                title="Labs"
                userId={userId}
                hasGoogleCalendarConnection={hasGoogleCalendarConnection}
                snapshots={labs}
              />

              <ProviderGroupSection
                title="Pharmacies"
                userId={userId}
                hasGoogleCalendarConnection={hasGoogleCalendarConnection}
                snapshots={pharmacies}
              />
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}