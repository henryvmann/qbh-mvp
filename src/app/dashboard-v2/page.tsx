"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "../../lib/api";
import HandleItButton from "../../components/qbh/HandleItButton";
import KateInsights from "../../components/qbh/KateInsights";
import CareGaps from "../../components/qbh/CareGaps";
import KateFollowUp from "../../components/qbh/KateFollowUp";
import TopNav from "../../components/qbh/TopNav";
import BestNextStep from "../../components/qbh/BestNextStep";
import ProviderLink from "../../components/qbh/ProviderLink";

/* ── Colors ── */
const TEAL = "#0FA5A5";
const GOLD = "#D4A44C";
const NAVY = "#0F1729";
const SURFACE = "rgba(255,255,255,0.05)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "rgba(255,255,255,0.92)";
const TEXT_SECONDARY = "rgba(255,255,255,0.50)";
const TEXT_MUTED = "rgba(255,255,255,0.30)";

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
  return Math.max(1, Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30)));
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
    days.push({ abbrev: DAY_ABBREV[i], date: d.getDate(), isToday: i === dayOfWeek });
  }
  return days;
}

/* ── Glass Card ── */
function GlassCard({ children, className = "", style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: SURFACE, border: `1px solid ${BORDER}`, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── Metric Pill ── */
function MetricPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-light" style={{ color }}>{value}</span>
      <span className="text-[10px] font-medium" style={{ color: TEXT_SECONDARY }}>{label}</span>
    </div>
  );
}

/* ── Main Dashboard ── */
function DashboardInner() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingAll, setBookingAll] = useState(false);
  const [bookingAllDone, setBookingAllDone] = useState(false);

  useEffect(() => {
    async function load() {
      let res = await apiFetch("/api/dashboard/data");
      if (res.status === 401) {
        await new Promise((r) => setTimeout(r, 1500));
        res = await apiFetch("/api/dashboard/data");
      }
      if (res.status === 401) {
        await new Promise((r) => setTimeout(r, 3000));
        res = await apiFetch("/api/dashboard/data");
      }
      if (res.status === 401) { router.push("/login"); return; }
      const json = await res.json();
      if (json?.ok) setData(json);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [router]);

  if (loading) return <main className="min-h-screen" style={{ background: NAVY }} />;

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: NAVY }}>
        <div className="text-center">
          <div className="text-lg font-light" style={{ color: TEXT_SECONDARY }}>No data yet</div>
          <div className="mt-2 text-sm" style={{ color: TEXT_MUTED }}>Your dashboard will populate once providers are discovered.</div>
        </div>
      </main>
    );
  }

  const { appUserId, userName, snapshots } = data;
  const nonPharmacySnapshots = snapshots.filter((s: any) => s.provider.provider_type !== "pharmacy");
  const overdueSnapshots = nonPharmacySnapshots.filter(isOverdue);
  const overdueCount = overdueSnapshots.length;
  const upcomingCount = nonPharmacySnapshots.filter(hasConfirmedBooking).length;
  const providerCount = snapshots.length;
  const topOverdue = overdueSnapshots[0] ?? null;
  const topOverdueMonths = topOverdue ? monthsSinceLastVisit(topOverdue) : null;
  const weekDays = getWeekDays();

  return (
    <main className="min-h-screen pb-16" style={{ background: `linear-gradient(180deg, ${NAVY} 0%, #111827 50%, #0C1220 100%)` }}>
      <TopNav />

      <div className="mx-auto max-w-lg sm:max-w-xl md:max-w-2xl">

        {/* ── Greeting + Metrics ── */}
        <div className="px-7 pt-8 flex items-center justify-between">
          <span className="text-sm" style={{ color: TEXT_SECONDARY }}>Hi, {userName || "there"}</span>
          <div className="flex items-center gap-5">
            <MetricPill value={providerCount} label="providers" color={TEAL} />
            <MetricPill value={upcomingCount} label="upcoming" color={GOLD} />
            {overdueCount > 0 && <MetricPill value={overdueCount} label="overdue" color="#F87171" />}
          </div>
        </div>

        {/* ── Best Next Step ── */}
        <div className="px-7 mt-2" data-wizard="best-next-step">
          <BestNextStep />
        </div>

        {/* ── Week Strip ── */}
        <Link href="/calendar-view" className="mt-6 flex items-center justify-center gap-2 group">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1 rounded-xl px-2.5 py-2 transition"
              style={day.isToday
                ? { background: `linear-gradient(135deg, ${TEAL}, ${GOLD})`, color: "#fff" }
                : { color: TEXT_MUTED }
              }
            >
              <span className="text-[10px] font-medium">{day.abbrev}</span>
              <span className="text-sm font-semibold">{day.date}</span>
            </div>
          ))}
        </Link>

        {/* ── Kate's Brief ── */}
        <div className="mt-6 px-7" data-wizard="hero">
          <GlassCard className="relative overflow-hidden p-6">
            {/* Faint constellation texture */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `radial-gradient(circle at 20% 30%, ${TEAL} 1px, transparent 1px), radial-gradient(circle at 80% 70%, ${GOLD} 1px, transparent 1px), radial-gradient(circle at 50% 50%, ${TEAL} 0.5px, transparent 0.5px)`,
              backgroundSize: "60px 60px, 80px 80px, 40px 40px",
            }} />

            <div className="relative flex items-start gap-4">
              <Image
                src="/kate-avatar.png"
                alt="Kate"
                width={44}
                height={44}
                className="rounded-full shrink-0 mt-0.5"
                style={{ boxShadow: `0 0 0 2px ${GOLD}40` }}
              />
              <div className="flex-1">
                {providerCount === 0 ? (
                  <>
                    <div className="text-lg font-light" style={{ color: TEXT_PRIMARY }}>
                      Let&apos;s build your health profile
                    </div>
                    <div className="mt-1 text-sm" style={{ color: TEXT_SECONDARY }}>
                      Start by adding your providers — who&apos;s your primary care doctor?
                    </div>
                    <Link
                      href="/providers?add=true"
                      className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                      style={{ background: `linear-gradient(135deg, ${TEAL}, ${GOLD})` }}
                    >
                      Add your first provider
                    </Link>
                  </>
                ) : overdueCount > 0 ? (
                  <>
                    <div className="text-lg font-light" style={{ color: TEXT_PRIMARY }}>
                      {overdueCount === 1
                        ? `${topOverdue?.provider?.name || "A provider"} is overdue`
                        : `${overdueCount} providers need attention`}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: TEXT_SECONDARY }}>
                      {topOverdueMonths
                        ? `It's been ${topOverdueMonths} months. Want me to handle it?`
                        : "Want me to call and book for you?"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-light" style={{ color: TEAL }}>You&apos;re all set</div>
                    <div className="mt-1 text-sm" style={{ color: TEXT_SECONDARY }}>
                      All providers are on track. Nothing needs your attention.
                    </div>
                  </>
                )}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* ── Book All ── */}
        {overdueCount > 0 && (
          <div className="mt-4 px-7">
            <GlassCard style={{ background: `linear-gradient(135deg, ${TEAL}12, ${GOLD}12)` }}>
              <div className="px-5 py-3">
                {overdueSnapshots.slice(0, 5).map((s: any) => (
                  <div key={s.provider.id} className="flex items-center gap-2 py-1.5 text-sm" style={{ color: TEXT_SECONDARY }}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#F87171" }} />
                    {s.provider.name}
                  </div>
                ))}
              </div>
              <div className="px-5 pb-4">
                <button
                  type="button"
                  disabled={bookingAll || bookingAllDone}
                  onClick={async () => {
                    setBookingAll(true);
                    try {
                      await Promise.all(overdueSnapshots.map((s: any) =>
                        apiFetch("/api/vapi/start-call", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ app_user_id: appUserId, provider_id: s.provider.id, provider_name: s.provider.name, mode: "BOOK" }),
                        })
                      ));
                      setBookingAllDone(true);
                    } catch { setBookingAllDone(true); } finally { setBookingAll(false); }
                  }}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${TEAL}, ${GOLD})` }}
                >
                  {bookingAll ? "Starting calls..." : bookingAllDone ? "Kate is on it!" : `Let Kate book ${overdueCount === 1 ? "it" : "all " + overdueCount}`}
                </button>
              </div>
            </GlassCard>
          </div>
        )}

        <KateFollowUp />
        <KateInsights />
        <CareGaps />

        {/* ── Provider Network ── */}
        <div className="mt-10 px-7" data-wizard="providers">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: TEXT_MUTED }}>Your Network</div>
          <GlassCard className="mt-3 overflow-hidden">
            {snapshots.map((s: any, idx: number) => {
              const overdue = isOverdue(s);
              const booked = hasConfirmedBooking(s);
              const isLast = idx === snapshots.length - 1;
              const isPharmacy = s.provider.provider_type === "pharmacy";
              const statusColor = isPharmacy ? TEXT_MUTED : overdue ? "#F87171" : booked ? GOLD : TEAL;

              return (
                <div
                  key={s.provider.id}
                  className="flex items-center justify-between px-5 py-3.5"
                  style={!isLast ? { borderBottom: `1px solid ${BORDER}` } : {}}
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}40` }} />
                    <div>
                      <span className="text-sm font-medium" style={{ color: TEXT_PRIMARY }}>
                        <ProviderLink providerId={s.provider.id} providerName={s.provider.name} />
                      </span>
                      {isPharmacy && <span className="ml-2 text-[10px]" style={{ color: TEXT_MUTED }}>Pharmacy</span>}
                    </div>
                  </div>
                  {isPharmacy ? (
                    <span className="text-[10px] font-medium" style={{ color: TEXT_MUTED }}>Tracked</span>
                  ) : overdue ? (
                    <HandleItButton userId={appUserId} providerId={s.provider.id} providerName={s.provider.name} label="Book" />
                  ) : booked ? (
                    <span className="text-[10px] font-medium" style={{ color: GOLD }}>Upcoming</span>
                  ) : (
                    <span className="text-[10px] font-medium" style={{ color: TEAL }}>On track</span>
                  )}
                </div>
              );
            })}
            {snapshots.length === 0 && (
              <div className="px-5 py-8 text-center text-sm" style={{ color: TEXT_MUTED }}>No providers discovered yet.</div>
            )}
          </GlassCard>
        </div>

        {/* ── At a Glance ── */}
        <div className="mt-10 px-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: TEXT_MUTED }}>At a Glance</div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Link href="/providers">
              <GlassCard className="flex min-h-[100px] flex-col justify-between p-5 transition hover:brightness-125">
                <div className="text-3xl font-extralight" style={{ color: TEAL }}>{providerCount}</div>
                <div className="text-xs font-medium" style={{ color: TEXT_SECONDARY }}>Providers</div>
              </GlassCard>
            </Link>
            <Link href="/visits">
              <GlassCard className="flex min-h-[100px] flex-col justify-between p-5 transition hover:brightness-125">
                <div className="text-3xl font-extralight" style={{ color: overdueCount > 0 ? "#F87171" : TEXT_SECONDARY }}>{overdueCount}</div>
                <div className="text-xs font-medium" style={{ color: TEXT_SECONDARY }}>Overdue</div>
              </GlassCard>
            </Link>
            <Link href="/visits">
              <GlassCard className="flex min-h-[100px] flex-col justify-between p-5 transition hover:brightness-125">
                <div className="text-3xl font-extralight" style={{ color: GOLD }}>{upcomingCount}</div>
                <div className="text-xs font-medium" style={{ color: TEXT_SECONDARY }}>Upcoming</div>
              </GlassCard>
            </Link>
          </div>
        </div>
      </div>

      {/* ── What To Do Next ── */}
      <div className="mx-auto max-w-lg sm:max-w-xl md:max-w-2xl mt-10 px-7 pb-8" data-wizard="next-steps">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: TEXT_MUTED }}>What To Do Next</div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/providers", title: "Manage Providers", desc: "Add, edit, or review your care team" },
            { href: "/settings", title: "Your Profile", desc: "Health history, insurance, preferences" },
            { href: "/visits", title: "Visits", desc: "Upcoming and past appointments" },
            { href: "/goals", title: "Goals", desc: "Set and track your health goals" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <GlassCard className="p-4 transition hover:brightness-125 group">
                <div className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>{item.title}</div>
                <div className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>{item.desc}</div>
                <div className="mt-2 h-[1px] w-8 transition-all group-hover:w-12" style={{ background: `linear-gradient(90deg, ${TEAL}, ${GOLD})` }} />
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function DashboardV2Page() {
  return (
    <Suspense fallback={<main className="min-h-screen" style={{ background: NAVY }} />}>
      <DashboardInner />
    </Suspense>
  );
}
