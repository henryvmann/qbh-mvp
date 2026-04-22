"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { Check } from "lucide-react";
import HandleItButton from "../../components/qbh/HandleItButton";
import KateInsights from "../../components/qbh/KateInsights";
import CareGaps from "../../components/qbh/CareGaps";
import KateFollowUp from "../../components/qbh/KateFollowUp";
import TopNav from "../../components/qbh/TopNav";
import BestNextStep from "../../components/qbh/BestNextStep";
import UrgentCareButton from "../../components/qbh/UrgentCareButton";
import ProviderLink from "../../components/qbh/ProviderLink";

/* ── Types ── */

type DashboardData = {
  appUserId: string;
  userName: string | null;
  snapshots: any[];
  discoverySummary: { chargesAnalyzed: number };
  hasGoogleCalendarConnection: boolean;
};

/* ── Helpers ── */

function isOverdue(snapshot: any): boolean {
  return (
    snapshot.followUpNeeded &&
    snapshot.booking_state?.status !== "BOOKED" &&
    snapshot.booking_state?.status !== "IN_PROGRESS"
  );
}

function hasConfirmedBooking(snapshot: any): boolean {
  return snapshot.booking_state?.status === "BOOKED";
}

function monthsSinceLastVisit(snapshot: any): number | null {
  const last = snapshot.lastVisitDate || snapshot.last_visit_date;
  if (!last) return null;
  const d = new Date(last);
  const now = new Date();
  return Math.max(
    1,
    Math.round(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30)
    )
  );
}

function computeHealthScore(snapshots: any[]): number {
  if (snapshots.length === 0) return 100;
  const current = snapshots.filter((s) => !isOverdue(s)).length;
  return Math.round((current / snapshots.length) * 100);
}

/* ── Day helpers ── */

const DAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekDays(): Array<{ abbrev: string; date: number; isToday: boolean }> {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const days: Array<{ abbrev: string; date: number; isToday: boolean }> = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - dayOfWeek + i);
    days.push({
      abbrev: DAY_ABBREV[i],
      date: d.getDate(),
      isToday: i === dayOfWeek,
    });
  }

  return days;
}

/* ── SVG Icons ── */

function CheckmarkIcon({ className }: { className?: string }) {
  return <Check className={className} size={20} strokeWidth={2.5} />;
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function HomeIcon({ active }: { active?: boolean }) {
  const color = active ? "#5C6B5C" : "#B0B4BC";
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CalendarIcon({ active }: { active?: boolean }) {
  const color = active ? "#5C6B5C" : "#B0B4BC";
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChatIcon({ active }: { active?: boolean }) {
  const color = active ? "#5C6B5C" : "#B0B4BC";
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function UserIcon({ active }: { active?: boolean }) {
  const color = active ? "#5C6B5C" : "#B0B4BC";
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/* ── Score Ring ── */

function ScoreRing({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle
          cx={36}
          cy={36}
          r={radius}
          fill="none"
          stroke="#D8C8F0"
          strokeWidth={5}
        />
        <circle
          cx={36}
          cy={36}
          r={radius}
          fill="none"
          stroke="#5C6B5C"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeDashoffset={circumference * 0.25}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <span className="absolute text-lg font-semibold text-[#5C4A8A]">
        {score}
      </span>
    </div>
  );
}

/* ── Top Nav Bar ── */

function TopNavBar({ activePath = "/dashboard" }: { activePath?: string }) {
  const links = [
    { label: "Home", href: "/dashboard" },
    { label: "Goals", href: "/goals" },
    { label: "Visits", href: "/visits" },
    { label: "Timeline", href: "/timeline" },
  ];

  return (
    <nav className="sticky top-0 z-30 border-b border-[#2A2F35]" style={{ background: "#1A1D2E" }}>
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
        {/* QB Logo */}
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15), inset 0 -1px 2px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,1)",
            }}
          >
            <CheckmarkIcon className="h-5 w-5 text-[#D0D3D8]" />
          </div>
          <span className="text-sm font-semibold text-white/90 hidden sm:inline">
            Quarterback Health
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = activePath === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ── Main Dashboard ── */

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingAll, setBookingAll] = useState(false);
  const [bookingAllDone, setBookingAllDone] = useState(false);

  useEffect(() => {
    async function load() {
      let res = await apiFetch("/api/dashboard/data");

      // If 401, wait and retry — session may still be propagating
      if (res.status === 401) {
        console.log("[dashboard] First attempt 401 — retrying in 1.5s");
        await new Promise((r) => setTimeout(r, 1500));
        res = await apiFetch("/api/dashboard/data");
      }

      // If still 401, try one more time with a longer delay
      if (res.status === 401) {
        console.log("[dashboard] Second attempt 401 — retrying in 3s");
        await new Promise((r) => setTimeout(r, 3000));
        res = await apiFetch("/api/dashboard/data");
      }

      if (res.status === 401) {
        console.log("[dashboard] All retries failed — redirecting to login");
        router.push("/login");
        return;
      }

      const json = await res.json();
      if (json?.ok) setData(json);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main
        className="min-h-screen"
        style={{
          background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)",
        }}
      />
    );
  }

  if (!data) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)",
        }}
      >
        <div className="text-center">
          <div className="text-lg font-light text-[#7A7F8A]">
            No data yet
          </div>
          <div className="mt-2 text-sm text-[#B0B4BC]">
            Your dashboard will populate once providers are discovered.
          </div>
        </div>
      </main>
    );
  }

  const { appUserId, userName, snapshots } = data;

  const nonPharmacySnapshots = snapshots.filter((s) => s.provider.provider_type !== "pharmacy");
  const overdueSnapshots = nonPharmacySnapshots.filter(isOverdue);
  const overdueCount = overdueSnapshots.length;
  const upcomingCount = nonPharmacySnapshots.filter(hasConfirmedBooking).length;
  const providerCount = snapshots.length;

  const topOverdue = overdueSnapshots[0] ?? null;
  const topOverdueMonths = topOverdue ? monthsSinceLastVisit(topOverdue) : null;

  const weekDays = getWeekDays();

  return (
    <main
      className="min-h-screen pb-12"
      style={{
        background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)",
      }}
    >
      <TopNav />
      <div className="mx-auto max-w-lg sm:max-w-xl md:max-w-2xl">
        {/* ── 1. Greeting ── */}
        <div className="px-7 pt-8">
          <span className="text-sm text-[#7A7F8A]">
            Hi, {userName || "there"}
          </span>
        </div>

        {/* ── Best Next Step ── */}
        <div className="px-7" data-wizard="best-next-step">
          <BestNextStep />
        </div>

        {/* ── 2. Week Strip with dates — links to calendar ── */}
        <Link href="/calendar-view" className="mt-6 flex items-center justify-center gap-2 group">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-2 transition ${
                day.isToday
                  ? "bg-[#5C6B5C] text-white"
                  : "text-[#B0B4BC] group-hover:text-[#7A7F8A]"
              }`}
            >
              <span className="text-[10px] font-medium">{day.abbrev}</span>
              <span className="text-sm font-semibold">{day.date}</span>
            </div>
          ))}
        </Link>

        {/* ── 3. Hero Section ── */}
        <div className="mt-3 px-7" data-wizard="hero">
          {providerCount === 0 ? (
            <>
              <div className="text-3xl font-light text-[#1A1D2E]">
                Let&apos;s build your health profile
              </div>
              <div className="mt-2 text-base text-[#7A7F8A]">
                Start by adding your providers &mdash; who&apos;s your primary care doctor? Dentist? Therapist?
              </div>
              <Link
                href="/providers?add=true"
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
              >
                Add your first provider
              </Link>
            </>
          ) : overdueCount > 0 ? (
            <>
              <div
                className="font-extralight leading-none text-[#1A1D2E]"
                style={{ fontSize: "96px" }}
              >
                {overdueCount}
              </div>
              <div className="text-3xl font-light text-[#7A7F8A]">overdue</div>
              {topOverdue && (
                <div className="mt-2 text-base text-[#B0B4BC]">
                  {topOverdue.provider?.name || "A provider"} hasn&apos;t seen
                  you in {topOverdueMonths ?? "a while"}{" "}
                  {topOverdueMonths ? "months" : ""}.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-3xl font-light text-[#5C6B5C]">
                You&apos;re all set
              </div>
              <div className="mt-2 text-base text-[#7A7F8A]">
                Nothing needs attention right now.
              </div>
            </>
          )}
        </div>

        {/* ── 4. Big Action Button ── */}
        {overdueCount > 0 && (
          <div className="mt-7 px-7">
            <div
              className="overflow-hidden rounded-3xl shadow-lg"
              style={{
                background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)",
                boxShadow: "0 8px 24px rgba(92,107,92,0.35)",
              }}
            >
              <div className="px-6 pt-5 pb-3">
                <div className="text-base font-semibold text-white">
                  {overdueCount === 1
                    ? "Want Kate to book this?"
                    : `Want Kate to book all ${overdueCount}?`}
                </div>
                <div className="mt-1 text-sm text-white/50">
                  She&apos;ll call each office and schedule for you
                </div>
              </div>

              <div className="px-6 pb-2">
                {overdueSnapshots.slice(0, 5).map((s) => (
                  <div
                    key={s.provider.id}
                    className="flex items-center gap-2 py-1.5 text-sm text-white/70"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                    {s.provider.name}
                  </div>
                ))}
                {overdueCount > 5 && (
                  <div className="py-1.5 text-xs text-white/40">
                    +{overdueCount - 5} more
                  </div>
                )}
              </div>

              <div className="px-6 pb-5 pt-2">
                <button
                  type="button"
                  disabled={bookingAll || bookingAllDone}
                  onClick={async () => {
                    setBookingAll(true);
                    try {
                      await Promise.all(
                        overdueSnapshots.map((s) =>
                          apiFetch("/api/vapi/start-call", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              app_user_id: appUserId,
                              provider_id: s.provider.id,
                              provider_name: s.provider.name,
                              mode: "BOOK",
                            }),
                          })
                        )
                      );
                      setBookingAllDone(true);
                    } catch {
                      // still mark as done so UI updates
                      setBookingAllDone(true);
                    } finally {
                      setBookingAll(false);
                    }
                  }}
                  className="w-full rounded-2xl bg-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/25 disabled:opacity-60"
                >
                  {bookingAll
                    ? "Starting calls..."
                    : bookingAllDone
                      ? "Kate is on it!"
                      : `Book ${overdueCount === 1 ? "it" : "all"} now`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. Kate's Follow-up Questions ── */}
        <KateFollowUp />

        {/* ── 6. Kate's Insights ── */}
        <KateInsights />

        {/* ── 6. Care Gaps ── */}
        <CareGaps />

        {/* ── 7. Provider List ── */}
        <div className="mt-10 px-7" data-wizard="providers">
          <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC]">
            YOUR PROVIDERS
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
            {snapshots.map((s, idx) => {
              const overdue = isOverdue(s);
              const isLast = idx === snapshots.length - 1;
              const isPharmacy = s.provider.provider_type === "pharmacy";

              return (
                <div
                  key={s.provider.id}
                  className={`flex items-center justify-between px-5 py-4 ${
                    !isLast ? "border-b border-[#F0F0F0]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: isPharmacy
                          ? "#A0C8E8"
                          : overdue
                            ? "#E04030"
                            : "#5C6B5C",
                      }}
                    />
                    <div>
                      <span className="text-sm font-medium">
                        <ProviderLink providerId={s.provider.id} providerName={s.provider.name} />
                      </span>
                      {isPharmacy && (
                        <span className="ml-2 text-xs text-[#A0C8E8]">Pharmacy</span>
                      )}
                    </div>
                  </div>

                  {isPharmacy ? (
                    <span className="text-xs text-[#B0B4BC]">Tracked</span>
                  ) : overdue ? (
                    <HandleItButton
                      userId={appUserId}
                      providerId={s.provider.id}
                      providerName={s.provider.name}
                      label="Book"
                    />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 text-[#B0B4BC]" />
                  )}
                </div>
              );
            })}
            {snapshots.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#B0B4BC]">
                No providers discovered yet.
              </div>
            )}
          </div>
        </div>
        {/* ── Urgent Care (subtle bar) ── */}
        <div className="mt-8 px-7">
          <UrgentCareButton />
        </div>

        {/* ── 6. Color Hub — At a Glance ── */}
        <div className="mt-10 px-7">
          <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC]">
            AT A GLANCE
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {/* Providers */}
            <Link href="/providers" className="flex min-h-[100px] flex-col justify-between rounded-2xl bg-[#C2D9B8] p-5 transition hover:brightness-95">
              <div className="text-4xl font-extralight text-[#3D5A3D]">
                {providerCount}
              </div>
              <div className="text-sm font-semibold text-[#3D5A3D]/80">
                Providers
              </div>
            </Link>

            {/* Overdue */}
            <Link href="/visits" className="flex min-h-[100px] flex-col justify-between rounded-2xl bg-[#F0B8B0] p-5 transition hover:brightness-95">
              <div className="text-4xl font-extralight text-[#C03020]">
                {overdueCount}
              </div>
              <div className="text-sm font-semibold text-[#C03020]/80">
                Overdue
              </div>
            </Link>

            {/* Upcoming */}
            <Link href="/visits" className="flex min-h-[100px] flex-col justify-between rounded-2xl bg-[#B0D0E8] p-5 transition hover:brightness-95">
              <div className="text-4xl font-extralight text-[#2A6090]">
                {upcomingCount}
              </div>
              <div className="text-sm font-semibold text-[#2A6090]/80">
                Upcoming
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── What To Do Next ── */}
      <div className="mt-10 px-7 pb-8" data-wizard="next-steps">
        <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC] mb-4">
          What To Do Next
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/providers"
            className="rounded-2xl bg-white border border-[#EBEDF0] p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="text-sm font-semibold text-[#1A1D2E]">Manage Providers</div>
            <div className="text-xs text-[#7A7F8A] mt-1">Add, edit, or review your care team</div>
          </Link>
          <Link
            href="/settings"
            className="rounded-2xl bg-white border border-[#EBEDF0] p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="text-sm font-semibold text-[#1A1D2E]">Your Profile</div>
            <div className="text-xs text-[#7A7F8A] mt-1">Health history, insurance, preferences</div>
          </Link>
          <Link
            href="/visits"
            className="rounded-2xl bg-white border border-[#EBEDF0] p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="text-sm font-semibold text-[#1A1D2E]">Visits</div>
            <div className="text-xs text-[#7A7F8A] mt-1">Upcoming and past appointments</div>
          </Link>
          <Link
            href="/goals"
            className="rounded-2xl bg-white border border-[#EBEDF0] p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="text-sm font-semibold text-[#1A1D2E]">Goals</div>
            <div className="text-xs text-[#7A7F8A] mt-1">Set and track your health goals</div>
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen"
          style={{
            background:
              "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)",
          }}
        />
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
