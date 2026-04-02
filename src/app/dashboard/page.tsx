"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

import ProviderCard from "../../components/qbh/ProviderCard";
import DailyBrief from "../../components/qbh/DailyBrief";
import DashboardAnalyzer from "../../components/qbh/DashboardAnalyzer";
import DashboardHandleAllButton from "../../components/qbh/DashboardHandleAllButton";

type DashboardStat = {
  label: string;
  value: string;
};

type DashboardData = {
  appUserId: string;
  snapshots: any[];
  discoverySummary: { chargesAnalyzed: number };
  hasGoogleCalendarConnection: boolean;
};

function hasConfirmedBooking(snapshot: any): boolean {
  return snapshot.booking_state.status === "BOOKED";
}

function hasActiveBookingState(snapshot: any): boolean {
  return snapshot.booking_state.status === "IN_PROGRESS";
}

function hasBrokenSchedulingState(snapshot: any): boolean {
  return snapshot.system_actions.integrity.hasMultipleFutureConfirmedEvents;
}

function isHandleAllEligible(snapshot: any): boolean {
  if (hasBrokenSchedulingState(snapshot)) return false;
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
    { label: "Account", href: "/account" },
  ];

  return (
    <nav className="mt-5 rounded-2xl bg-[#0F1520] px-3 py-2 ring-1 ring-white/8">
      <div className="flex flex-wrap items-center gap-2">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="rounded-xl px-3 py-2 text-sm font-medium text-[#6B85A8] hover:bg-[#162030] hover:text-[#EFF4FF]"
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
    <div className="rounded-2xl bg-[#0F1520] p-5 ring-1 ring-white/8">
      <div className="text-sm font-medium text-[#6B85A8]">{props.label}</div>
      <div className="mt-2 font-serif text-3xl tracking-tight text-[#EFF4FF]">
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
      <section className="mt-8 rounded-2xl bg-[#0F1520] p-5 ring-1 ring-white/8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-[#EFF4FF]">
              Google Calendar connected
            </div>
            <div className="mt-1 text-sm text-[#6B85A8]">
              QBH can use your real availability to protect your schedule before
              booking starts.
            </div>
          </div>
          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-[#6B85A8] hover:bg-[#162030] hover:text-[#EFF4FF]"
          >
            Manage calendar
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl bg-[#0F1520] p-5 ring-1 ring-white/8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-[#EFF4FF]">
            Connect Google Calendar for better booking
          </div>
          <div className="mt-1 text-sm text-[#6B85A8]">
            QBH works better with your real availability, but you can still
            continue without connecting it right now.
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-xl bg-[#5DE8C5] px-4 py-2 text-sm font-medium text-[#080C14] hover:brightness-95"
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
    <section className="mt-8 rounded-2xl bg-red-500/15 p-5 ring-1 ring-red-500/30">
      <div className="text-sm font-medium text-red-400">
        Scheduling integrity issue detected
      </div>
      <div className="mt-1 text-sm text-red-400/80">
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
  snapshots: any[];
}) {
  if (props.snapshots.length === 0) return null;
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-[#EFF4FF]">
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

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAnalyzing = searchParams.get("analyzing") === "1";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Support unauthenticated access via app_user_id query param (onboarding flow)
    const appUserId = searchParams.get("app_user_id") || window.localStorage.getItem("qbh_user_id") || "";
    const suffix = appUserId ? `?app_user_id=${encodeURIComponent(appUserId)}` : "";

    apiFetch(`/api/dashboard/data${suffix}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) setData(json);
      })
      .finally(() => setLoading(false));
  }, [router, searchParams]);

  if (loading) {
    return <main className="min-h-screen bg-[#080C14]" />;
  }

  if (!data) return null;

  const { appUserId, snapshots, discoverySummary, hasGoogleCalendarConnection } = data;

  const doctors = snapshots.filter((s) => classifyProvider(s.provider.name) === "doctor");
  const labs = snapshots.filter((s) => classifyProvider(s.provider.name) === "lab");
  const pharmacies = snapshots.filter((s) => classifyProvider(s.provider.name) === "pharmacy");

  const actionableProviders = snapshots
    .filter((s) => isHandleAllEligible(s))
    .map((s) => ({ providerId: s.provider.id, providerName: s.provider.name }));

  const followUps = snapshots.filter((s) => s.followUpNeeded).length;
  const upcoming = snapshots.filter((s) => hasConfirmedBooking(s)).length;
  const inProgress = snapshots.filter((s) => hasActiveBookingState(s)).length;
  const broken = snapshots.filter((s) => hasBrokenSchedulingState(s)).length;

  const stats: DashboardStat[] = [
    { label: "Providers", value: String(snapshots.length) },
    { label: "Charges", value: String(discoverySummary.chargesAnalyzed) },
    { label: "Upcoming", value: String(upcoming) },
    { label: "Follow-ups", value: String(followUps) },
  ];

  const showAnalyzer = Boolean(appUserId) && isAnalyzing;

  return (
    <main className="min-h-screen bg-[#080C14] px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <header>
          <h1 className="font-serif text-4xl tracking-tight text-[#EFF4FF]">
            Quarterback
          </h1>
          <p className="mt-2 text-sm text-[#6B85A8]">Your care, organized.</p>
        </header>

        <DashboardAnalyzer userId={appUserId} enabled={showAnalyzer} />

        {!showAnalyzer ? (
          <>
            <DailyBrief upcoming={upcoming} followUps={followUps} name="Henry" />

            <TopNav />

            <CalendarConnectionBanner
              userId={appUserId}
              isConnected={hasGoogleCalendarConnection}
            />

            <IntegrityBanner brokenCount={broken} />

            <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {stats.map((stat) => (
                <StatCard key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </section>

            <section className="mt-8 rounded-2xl bg-[#0F1520] p-6 ring-1 ring-white/8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-serif text-2xl tracking-tight text-[#EFF4FF]">
                    Providers
                  </h2>
                  <p className="mt-2 text-sm text-[#6B85A8]">
                    Discovered from your healthcare spending and tracked here.
                  </p>
                </div>
                <DashboardHandleAllButton
                  userId={appUserId}
                  providers={actionableProviders}
                  hasGoogleCalendarConnection={hasGoogleCalendarConnection}
                />
              </div>
            </section>

            <div id="provider-cards" className="mt-8 space-y-10">
              <ProviderGroupSection
                title="Doctors"
                userId={appUserId}
                hasGoogleCalendarConnection={hasGoogleCalendarConnection}
                snapshots={doctors}
              />
              <ProviderGroupSection
                title="Labs"
                userId={appUserId}
                hasGoogleCalendarConnection={hasGoogleCalendarConnection}
                snapshots={labs}
              />
              <ProviderGroupSection
                title="Pharmacies"
                userId={appUserId}
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#080C14]" />}>
      <DashboardInner />
    </Suspense>
  );
}
