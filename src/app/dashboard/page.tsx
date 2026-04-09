"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import HandleItButton from "../../components/qbh/HandleItButton";

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

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function getTodayDayIndex(): number {
  return new Date().getDay();
}

/* ── SVG Icons ── */

function CheckmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
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

/* ── Bottom Tab Bar ── */

function BottomTabBar() {
  const tabs = [
    { label: "Home", icon: HomeIcon, href: "/dashboard", active: true },
    { label: "Visits", icon: CalendarIcon, href: "/visits", active: false },
    { label: "Kate", icon: ChatIcon, href: "/kate", active: false },
    { label: "Profile", icon: UserIcon, href: "/account", active: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around border-t border-[#EBEDF0] bg-white/95">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className="flex flex-col items-center gap-1"
        >
          <tab.icon active={tab.active} />
          <span
            className={`text-[11px] font-medium ${
              tab.active ? "text-[#5C6B5C]" : "text-[#B0B4BC]"
            }`}
          >
            {tab.label}
          </span>
          {tab.active && (
            <span className="h-1 w-1 rounded-full bg-[#5C6B5C]" />
          )}
        </Link>
      ))}
    </nav>
  );
}

/* ── Main Dashboard ── */

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<DashboardData | null>(null);
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
        if (json?.ok) setData(json);
      })
      .finally(() => setLoading(false));
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
  const healthScore = computeHealthScore(snapshots);

  const topOverdue = overdueSnapshots[0] ?? null;
  const topOverdueMonths = topOverdue ? monthsSinceLastVisit(topOverdue) : null;

  const todayIndex = getTodayDayIndex();

  return (
    <main
      className="min-h-screen pb-24"
      style={{
        background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)",
      }}
    >
      <div className="mx-auto max-w-lg">
        {/* ── 1. Top Bar ── */}
        <div className="flex items-center justify-between px-7 pt-16">
          {/* Neumorphic QB logo */}
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(145deg, #F0F2F5, #E0E3E8)",
              boxShadow:
                "6px 6px 14px rgba(0,0,0,0.10), -6px -6px 14px rgba(255,255,255,0.95), inset 1px 1px 2px rgba(255,255,255,0.6)",
            }}
          >
            <CheckmarkIcon className="h-6 w-6 text-[#C8CCD2]" />
          </div>

          <span className="text-sm text-[#7A7F8A]">
            Hi, {userName || "there"}
          </span>
        </div>

        {/* ── 2. Mini Week Strip ── */}
        <div className="mt-8 flex items-center justify-center gap-2.5">
          {DAY_LETTERS.map((letter, i) => (
            <div
              key={i}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                i === todayIndex
                  ? "bg-[#5C6B5C] text-white"
                  : "text-[#B0B4BC]"
              }`}
            >
              {letter}
            </div>
          ))}
        </div>

        {/* ── 3. Hero Section ── */}
        <div className="mt-3 px-7">
          {overdueCount > 0 ? (
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
              <div
                className="font-extralight leading-none text-[#5C6B5C]"
                style={{ fontSize: "96px" }}
              >
                ✓
              </div>
              <div className="text-3xl font-light text-[#7A7F8A]">
                All caught up
              </div>
              <div className="mt-2 text-base text-[#B0B4BC]">
                Every provider is current. Nice work.
              </div>
            </>
          )}
        </div>

        {/* ── 4. Big Action Button ── */}
        {overdueCount > 0 && (
          <div className="mt-7 px-7">
            <button
              type="button"
              onClick={() => {
                // Trigger handle-all flow
                overdueSnapshots.forEach((s) => {
                  apiFetch("/api/vapi/start-call", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      app_user_id: appUserId,
                      provider_id: s.provider.id,
                      provider_name: s.provider.name,
                      mode: "BOOK",
                    }),
                  });
                });
              }}
              className="w-full rounded-3xl px-6 py-5 text-left shadow-lg"
              style={{
                background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)",
                boxShadow: "0 8px 24px rgba(92,107,92,0.35)",
              }}
            >
              <div className="text-lg font-semibold text-white">
                Let Kate book these →
              </div>
              <div className="mt-1 text-sm text-white/60">
                She&apos;ll call and schedule for you
              </div>
            </button>
          </div>
        )}

        {/* ── 5. Color Hub — At a Glance ── */}
        <div className="mt-10 px-7">
          <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC]">
            AT A GLANCE
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* Providers */}
            <div className="flex min-h-[110px] flex-col justify-between rounded-2xl bg-[#C2D9B8] p-5">
              <div className="text-4xl font-extralight text-[#3D5A3D]">
                {providerCount}
              </div>
              <div className="text-sm font-semibold text-[#3D5A3D]/80">
                Providers
              </div>
            </div>

            {/* Overdue */}
            <div className="flex min-h-[110px] flex-col justify-between rounded-2xl bg-[#F0B8B0] p-5">
              <div className="text-4xl font-extralight text-[#C03020]">
                {overdueCount}
              </div>
              <div className="text-sm font-semibold text-[#C03020]/80">
                Overdue
              </div>
            </div>

            {/* Upcoming */}
            <div className="flex min-h-[110px] flex-col justify-between rounded-2xl bg-[#B0D0E8] p-5">
              <div className="text-4xl font-extralight text-[#2A6090]">
                {upcomingCount}
              </div>
              <div className="text-sm font-semibold text-[#2A6090]/80">
                Upcoming
              </div>
            </div>

            {/* Score */}
            <div className="flex min-h-[110px] flex-col items-center justify-center rounded-2xl bg-[#C8B8E0] p-5">
              <ScoreRing score={healthScore} />
              <div className="mt-1 text-sm font-semibold text-[#5C4A8A]/80">
                Score
              </div>
            </div>
          </div>
        </div>

        {/* ── 6. Provider List ── */}
        <div className="mt-10 px-7">
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
                      <span className="text-sm font-medium text-[#1A1D2E]">
                        {s.provider.name}
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
      </div>

      {/* ── 7. Bottom Tab Bar ── */}
      <BottomTabBar />
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
