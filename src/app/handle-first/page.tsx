"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import HandleItButton from "../../components/qbh/HandleItButton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DashboardData = {
  appUserId: string;
  snapshots: any[];
  discoverySummary: { chargesAnalyzed: number };
  hasGoogleCalendarConnection: boolean;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function selectTopPriority(snapshots: any[]): any {
  const followUps = snapshots
    .filter((s) => s.followUpNeeded)
    .sort(
      (a, b) =>
        new Date(a.last_seen_at ?? 0).getTime() -
        new Date(b.last_seen_at ?? 0).getTime()
    );

  if (followUps.length > 0) return followUps[0];
  return snapshots[0];
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HandleFirstPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await apiFetch("/api/dashboard/data");

        if (res.status === 401) {
          router.replace("/login");
          return;
        }

        const json = await res.json();
        if (!cancelled) {
          if (
            !json.ok ||
            !json.snapshots ||
            json.snapshots.length === 0
          ) {
            router.replace("/dashboard");
            return;
          }
          setData(json);
        }
      } catch {
        if (!cancelled) router.replace("/dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  /* ---- Loading state ---- */
  if (loading || !data) {
    return <div className="min-h-screen bg-[#0B1120]" />;
  }

  const { appUserId, snapshots, hasGoogleCalendarConnection } = data;
  const topProvider = selectTopPriority(snapshots);
  const otherProviders = snapshots.filter((s) => s !== topProvider);

  return (
    <div className="relative min-h-screen bg-[#0B1120] text-white overflow-hidden">
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-[#D4A843]/10 blur-3xl" />

      <div className="relative mx-auto max-w-md px-5 py-10">
        {/* ---- Header ---- */}
        <p className="text-xs font-semibold uppercase tracking-widest text-[#D4A843]">
          Quarterback AI
        </p>
        <h1 className="mt-3 text-2xl font-bold leading-tight">
          Here&apos;s what we found
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Based on your healthcare spending, here&apos;s your top priority.
        </p>

        {/* ---- Priority provider card ---- */}
        <div className="mt-8 rounded-2xl border border-[#1E2B45] bg-[#131B2E] p-5">
          <h2 className="text-lg font-semibold">{topProvider.provider.name}</h2>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            {topProvider.followUpNeeded ? (
              <span className="inline-block rounded-full bg-[#D4A843]/15 px-2.5 py-0.5 text-xs font-medium text-[#D4A843]">
                Follow-up needed
              </span>
            ) : (
              <span>Last visit: {formatDate(topProvider.last_seen_at)}</span>
            )}
          </div>

          {topProvider.provider.phone && (
            <p className="mt-1.5 text-sm text-gray-500">
              {topProvider.provider.phone}
            </p>
          )}

          <HandleItButton
            userId={appUserId}
            providerId={topProvider.provider.id}
            providerName={topProvider.provider.name}
            phoneNumber={topProvider.provider.phone}
            label="Book an appointment →"
          />
        </div>

        {/* ---- Google Calendar ---- */}
        {!hasGoogleCalendarConnection && (
          <div className="mt-5 rounded-2xl border border-[#1E2B45] bg-[#131B2E] p-5">
            <h3 className="text-base font-semibold">
              Connect Google Calendar
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              So QB can check your real availability before booking
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.href = `/calendar-connect?user_id=${appUserId}`;
              }}
              className="mt-4 w-full rounded-2xl border border-[#D4A843] bg-transparent px-4 py-2.5 text-sm font-semibold text-[#D4A843] transition hover:bg-[#D4A843]/10"
            >
              Connect calendar
            </button>
          </div>
        )}

        {/* ---- Other providers summary ---- */}
        {otherProviders.length > 0 && (
          <div className="mt-5 rounded-2xl border border-[#1E2B45] bg-[#131B2E] p-5">
            <p className="text-sm font-medium text-gray-300">
              We also found{" "}
              <span className="text-white">{otherProviders.length}</span> other
              provider{otherProviders.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-2 space-y-1">
              {otherProviders.map((s: any) => (
                <li
                  key={s.provider.id}
                  className="text-xs text-gray-500"
                >
                  {s.provider.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ---- Go to dashboard ---- */}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mt-8 w-full rounded-2xl border border-[#D4A843] bg-transparent px-4 py-2.5 text-sm font-semibold text-[#D4A843] transition hover:bg-[#D4A843]/10"
        >
          Go to dashboard →
        </button>
      </div>
    </div>
  );
}
