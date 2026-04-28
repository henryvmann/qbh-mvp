"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import HandleItButton from "../../components/qbh/HandleItButton";
import TopNav from "../../components/qbh/TopNav";
import BestNextStep from "../../components/qbh/BestNextStep";
import ProviderLink from "../../components/qbh/ProviderLink";
import HealthScoreRing from "../../components/qbh/HealthScoreRing";

/* ── Types ── */
type DashboardData = {
  appUserId: string;
  userName: string | null;
  snapshots: any[];
  hasGoogleCalendarConnection: boolean;
};

/* ── Helpers ── */
function isOverdue(s: any): boolean {
  return s.followUpNeeded && s.booking_state?.status !== "BOOKED" && s.booking_state?.status !== "IN_PROGRESS";
}
function hasConfirmedBooking(s: any): boolean {
  return s.booking_state?.status === "BOOKED";
}

const DAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function getWeekDays() {
  const today = new Date();
  const dow = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    return { abbrev: DAY_ABBREV[i], date: d.getDate(), isToday: i === dow };
  });
}

/* ── Main ── */
function DashboardInner() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      let res = await apiFetch("/api/dashboard/data");
      if (res.status === 401) { await new Promise((r) => setTimeout(r, 1500)); res = await apiFetch("/api/dashboard/data"); }
      if (res.status === 401) { await new Promise((r) => setTimeout(r, 3000)); res = await apiFetch("/api/dashboard/data"); }
      if (res.status === 401) { router.push("/login"); return; }
      const json = await res.json();
      if (json?.ok) setData(json);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [router]);

  const BG = "linear-gradient(180deg, #CDDBD6 0%, #DDD8D0 35%, #ECEAE6 100%)";

  if (loading) return <main className="min-h-screen" style={{ background: BG }} />;
  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="text-center text-[#7A7F8A]">Setting up your dashboard...</div>
      </main>
    );
  }

  const { appUserId, userName, snapshots } = data;
  const nonPharmacy = snapshots.filter((s: any) => s.provider.provider_type !== "pharmacy");
  const overdueSnaps = nonPharmacy.filter(isOverdue);
  const overdueCount = overdueSnaps.length;
  const upcomingCount = nonPharmacy.filter(hasConfirmedBooking).length;
  const weekDays = getWeekDays();

  return (
    <main className="min-h-screen pb-16" style={{ background: BG }}>
      {/* Subtle greenhouse grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        opacity: 0.04,
        backgroundImage: "linear-gradient(#0FA5A5 1px, transparent 1px), linear-gradient(90deg, #D4A44C80 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      <TopNav />

      <div className="relative mx-auto max-w-xl px-7">

        {/* ── Greeting ── */}
        <div className="pt-8 text-center">
          <span className="text-sm" style={{ color: "#7A7F8A" }}>Hi, {userName || "there"}</span>
        </div>

        {/* ── Health Coordination Score ── */}
        <div className="mt-4 flex justify-center" data-wizard="hero">
          <HealthScoreRing />
        </div>

        {/* ── Kate's #1 Suggestion ── */}
        <div className="mt-6" data-wizard="best-next-step">
          <BestNextStep />
        </div>

        {/* ── Week Strip ── */}
        <Link href="/calendar-view" className="mt-6 flex items-center justify-center gap-1.5 group">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all"
              style={day.isToday ? {
                background: "linear-gradient(135deg, #4A6B4A, #5C7B5C)",
                color: "#fff",
                boxShadow: "0 2px 12px rgba(74,107,74,0.3)",
              } : { color: "#B0B4BC" }}
            >
              <span className="text-[10px] font-medium">{day.abbrev}</span>
              <span className="text-sm font-semibold">{day.date}</span>
            </div>
          ))}
        </Link>

        {/* ── Quick Stats ── */}
        <div className="mt-6 flex justify-center gap-8">
          <Link href="/providers" className="text-center group">
            <div className="text-2xl font-light text-[#4A6B4A] group-hover:scale-105 transition">{snapshots.length}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7A7F8A]">Providers</div>
          </Link>
          {overdueCount > 0 && (
            <Link href="/visits" className="text-center group">
              <div className="text-2xl font-light text-[#E04030] group-hover:scale-105 transition">{overdueCount}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7A7F8A]">Overdue</div>
            </Link>
          )}
          <Link href="/visits" className="text-center group">
            <div className="text-2xl font-light text-[#D4A44C] group-hover:scale-105 transition">{upcomingCount}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7A7F8A]">Upcoming</div>
          </Link>
        </div>

        {/* ── Provider List ── */}
        <div className="mt-8" data-wizard="providers">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A7F8A]">
            Your Providers
          </div>
          <div className="mt-3 rounded-2xl bg-white/55 backdrop-blur-sm border border-white/70 shadow-sm overflow-hidden">
            {snapshots.map((s: any, idx: number) => {
              const overdue = isOverdue(s);
              const booked = hasConfirmedBooking(s);
              const isLast = idx === snapshots.length - 1;
              const isPharmacy = s.provider.provider_type === "pharmacy";
              const dotColor = isPharmacy ? "#B0B4BC" : overdue ? "#E04030" : booked ? "#D4A44C" : "#4A6B4A";

              return (
                <div
                  key={s.provider.id}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/30"
                  style={!isLast ? { borderBottom: "1px solid rgba(255,255,255,0.5)" } : {}}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}30` }}
                    />
                    <div>
                      <span className="text-sm font-medium text-[#1A2E1A]">
                        <ProviderLink providerId={s.provider.id} providerName={s.provider.name} />
                      </span>
                      {s.provider.specialty && (
                        <span className="ml-2 text-[10px] text-[#7A7F8A]">{s.provider.specialty}</span>
                      )}
                    </div>
                  </div>
                  {isPharmacy ? (
                    <span className="text-[10px] font-medium text-[#B0B4BC]">Pharmacy</span>
                  ) : overdue ? (
                    <HandleItButton userId={appUserId} providerId={s.provider.id} providerName={s.provider.name} label="Book" />
                  ) : booked ? (
                    <span className="text-[10px] font-semibold text-[#D4A44C]">Upcoming</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-[#4A6B4A]">On track</span>
                  )}
                </div>
              );
            })}
            {snapshots.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#B0B4BC]">
                Add your first provider to get started.
              </div>
            )}
          </div>
        </div>

        {/* ── What To Do Next ── */}
        <div className="mt-10 pb-8" data-wizard="next-steps">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A7F8A] mb-3">
            What To Do Next
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/providers", title: "Providers", desc: "Your care team hub" },
              { href: "/visits", title: "Visits", desc: "Upcoming & past" },
              { href: "/settings", title: "Profile", desc: "Health history & prefs" },
              { href: "/goals", title: "Goals", desc: "Track your progress" },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <div className="rounded-2xl bg-white/55 backdrop-blur-sm border border-white/70 p-4 transition hover:bg-white/70 hover:shadow-md group">
                  <div className="text-sm font-semibold text-[#1A2E1A]">{item.title}</div>
                  <div className="text-xs mt-0.5 text-[#7A7F8A]">{item.desc}</div>
                  <div className="mt-2 h-[2px] w-6 rounded-full bg-gradient-to-r from-[#0FA5A5] to-[#D4A44C] transition-all group-hover:w-10" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function DashboardV3Page() {
  return (
    <Suspense fallback={<main className="min-h-screen" style={{ background: "linear-gradient(180deg, #CDDBD6 0%, #DDD8D0 35%, #ECEAE6 100%)" }} />}>
      <DashboardInner />
    </Suspense>
  );
}
