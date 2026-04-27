"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

/* ── Palette: Greenhouse 3026 ──
   Sky gradient background, frosted glass surfaces,
   botanical green primary, soft teal tech accents,
   warm gold for actions. Light and airy but sharp.
*/
const GREEN = "#4A6B4A";
const GREEN_LIGHT = "#5C7B5C";
const TEAL_GLOW = "#0FA5A5";
const GOLD = "#C89B3C";
const SKY_TOP = "#C8E0F0";
const SKY_MID = "#E0EDF7";
const SKY_BOT = "#F0F4F8";
const GLASS = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.7)";
const GLASS_HOVER = "rgba(255,255,255,0.72)";
const TEXT_DARK = "#1A2E1A";
const TEXT_MID = "#5A6B6A";
const TEXT_LIGHT = "#8A9A98";

/* ── Types ── */
type DashboardData = {
  appUserId: string;
  userName: string | null;
  snapshots: any[];
  discoverySummary: { chargesAnalyzed: number };
  hasGoogleCalendarConnection: boolean;
};

/* ── Helpers ── */
function isOverdue(s: any): boolean {
  return s.followUpNeeded && s.booking_state?.status !== "BOOKED" && s.booking_state?.status !== "IN_PROGRESS";
}
function hasConfirmedBooking(s: any): boolean {
  return s.booking_state?.status === "BOOKED";
}
function monthsSince(s: any): number | null {
  const last = s.lastVisitDate || s.last_visit_date;
  if (!last) return null;
  return Math.max(1, Math.round((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24 * 30)));
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

/* ── Frosted Glass Card ── */
function FrostCard({ children, className = "", glow, style, ...props }: React.HTMLAttributes<HTMLDivElement> & { glow?: boolean }) {
  return (
    <div
      className={`rounded-2xl backdrop-blur-md transition-all duration-300 ${className}`}
      style={{
        background: GLASS,
        border: `1px solid ${GLASS_BORDER}`,
        boxShadow: glow
          ? `0 4px 24px rgba(15,165,165,0.08), 0 1px 3px rgba(0,0,0,0.04)`
          : `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── Stat Orb ── */
function StatOrb({ value, label, color, href }: { value: number; label: string; color: string; href: string }) {
  return (
    <Link href={href}>
      <FrostCard className="flex min-h-[110px] flex-col items-center justify-center p-5 transition hover:scale-[1.02] hover:shadow-lg group relative overflow-hidden">
        {/* Soft radial glow behind number */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
          background: `radial-gradient(circle at 50% 40%, ${color}15, transparent 70%)`,
        }} />
        <div className="relative text-4xl font-extralight tracking-tight" style={{ color }}>{value}</div>
        <div className="relative mt-1 text-xs font-semibold tracking-wide uppercase" style={{ color: TEXT_MID }}>{label}</div>
      </FrostCard>
    </Link>
  );
}

/* ── Main ── */
function DashboardInner() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingAll, setBookingAll] = useState(false);
  const [bookingAllDone, setBookingAllDone] = useState(false);

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

  const BG = `linear-gradient(180deg, ${SKY_TOP} 0%, ${SKY_MID} 35%, ${SKY_BOT} 100%)`;

  if (loading) return <main className="min-h-screen" style={{ background: BG }} />;
  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="text-center">
          <div className="text-lg font-light" style={{ color: TEXT_MID }}>No data yet</div>
        </div>
      </main>
    );
  }

  const { appUserId, userName, snapshots } = data;
  const nonPharmacy = snapshots.filter((s: any) => s.provider.provider_type !== "pharmacy");
  const overdueSnaps = nonPharmacy.filter(isOverdue);
  const overdueCount = overdueSnaps.length;
  const upcomingCount = nonPharmacy.filter(hasConfirmedBooking).length;
  const providerCount = snapshots.length;
  const topOverdue = overdueSnaps[0] ?? null;
  const topOverdueMonths = topOverdue ? monthsSince(topOverdue) : null;
  const weekDays = getWeekDays();

  return (
    <main className="min-h-screen pb-16 relative" style={{ background: BG }}>
      {/* Subtle organic grid — like light through greenhouse glass panels */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015]" style={{
        backgroundImage: `
          linear-gradient(${TEAL_GLOW} 1px, transparent 1px),
          linear-gradient(90deg, ${TEAL_GLOW} 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
      }} />

      <TopNav />

      <div className="relative mx-auto max-w-lg sm:max-w-xl md:max-w-2xl">

        {/* ── Greeting ── */}
        <div className="px-7 pt-8">
          <div className="text-sm tracking-wide" style={{ color: TEXT_MID }}>
            Hi, {userName || "there"}
          </div>
        </div>

        {/* ── Best Next Step ── */}
        <div className="px-7 mt-1" data-wizard="best-next-step">
          <BestNextStep />
        </div>

        {/* ── Week Strip ── */}
        <Link href="/calendar-view" className="mt-6 flex items-center justify-center gap-1.5 group">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all duration-200"
              style={day.isToday ? {
                background: `linear-gradient(135deg, ${GREEN}, ${GREEN_LIGHT})`,
                color: "#fff",
                boxShadow: `0 2px 12px ${GREEN}30`,
              } : {
                color: TEXT_LIGHT,
              }}
            >
              <span className="text-[10px] font-medium">{day.abbrev}</span>
              <span className="text-sm font-semibold">{day.date}</span>
            </div>
          ))}
        </Link>

        {/* ── Kate's Brief ── */}
        <div className="mt-6 px-7" data-wizard="hero">
          <FrostCard glow className="p-6 relative overflow-hidden">
            {/* Leaf-vein pattern — organic tech texture */}
            <svg className="absolute top-0 right-0 w-32 h-32 opacity-[0.04]" viewBox="0 0 100 100" fill="none">
              <path d="M50 0 C50 50 100 50 100 100" stroke={GREEN} strokeWidth="0.5" />
              <path d="M30 0 C30 40 70 60 100 80" stroke={TEAL_GLOW} strokeWidth="0.3" />
              <path d="M0 20 C30 20 50 50 80 100" stroke={GREEN} strokeWidth="0.3" />
              <circle cx="50" cy="50" r="1" fill={TEAL_GLOW} opacity="0.5" />
              <circle cx="30" cy="30" r="0.8" fill={GREEN} opacity="0.4" />
              <circle cx="75" cy="75" r="0.8" fill={GOLD} opacity="0.4" />
            </svg>

            <div className="relative flex items-start gap-4">
              <div className="relative">
                <Image
                  src="/kate-avatar.png"
                  alt="Kate"
                  width={46}
                  height={46}
                  className="rounded-full shrink-0"
                  style={{ boxShadow: `0 0 0 2px ${GREEN}30, 0 0 12px ${TEAL_GLOW}10` }}
                />
                {/* Status dot */}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: TEAL_GLOW }} />
              </div>
              <div className="flex-1">
                {providerCount === 0 ? (
                  <>
                    <div className="text-xl font-light" style={{ color: TEXT_DARK }}>
                      Let&apos;s build your health profile
                    </div>
                    <div className="mt-1.5 text-sm leading-relaxed" style={{ color: TEXT_MID }}>
                      Start by adding your providers — your PCP, dentist, specialists.
                    </div>
                    <Link
                      href="/providers?add=true"
                      className="mt-4 inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
                      style={{ background: `linear-gradient(135deg, ${GREEN}, ${GREEN_LIGHT})`, boxShadow: `0 4px 16px ${GREEN}25` }}
                    >
                      Add your first provider &rarr;
                    </Link>
                  </>
                ) : overdueCount > 0 ? (
                  <>
                    <div className="text-xl font-light" style={{ color: TEXT_DARK }}>
                      {overdueCount === 1
                        ? `${topOverdue?.provider?.name || "A provider"} is overdue`
                        : `${overdueCount} providers need attention`}
                    </div>
                    <div className="mt-1.5 text-sm leading-relaxed" style={{ color: TEXT_MID }}>
                      {topOverdueMonths
                        ? `It's been ${topOverdueMonths} months. I can call and schedule for you.`
                        : "Want me to handle the booking?"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xl font-light" style={{ color: GREEN }}>
                      All clear
                    </div>
                    <div className="mt-1.5 text-sm leading-relaxed" style={{ color: TEXT_MID }}>
                      Every provider is on track. Nothing needs your attention.
                    </div>
                  </>
                )}
              </div>
            </div>
          </FrostCard>
        </div>

        {/* ── Book All ── */}
        {overdueCount > 0 && (
          <div className="mt-4 px-7">
            <FrostCard className="overflow-hidden" style={{ background: `linear-gradient(135deg, ${GREEN}08, ${TEAL_GLOW}06)` }}>
              <div className="px-5 py-3">
                {overdueSnaps.slice(0, 5).map((s: any) => (
                  <div key={s.provider.id} className="flex items-center gap-2.5 py-1.5 text-sm" style={{ color: TEXT_MID }}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "#E04030", boxShadow: "0 0 4px #E0403030" }} />
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
                      await Promise.all(overdueSnaps.map((s: any) =>
                        apiFetch("/api/vapi/start-call", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ app_user_id: appUserId, provider_id: s.provider.id, provider_name: s.provider.name, mode: "BOOK" }),
                        })
                      ));
                      setBookingAllDone(true);
                    } catch { setBookingAllDone(true); } finally { setBookingAll(false); }
                  }}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${GREEN}, ${GREEN_LIGHT})`, boxShadow: `0 4px 16px ${GREEN}25` }}
                >
                  {bookingAll ? "Starting calls..." : bookingAllDone ? "Kate is on it!" : `Let Kate book ${overdueCount === 1 ? "it" : "all " + overdueCount}`}
                </button>
              </div>
            </FrostCard>
          </div>
        )}

        <KateFollowUp />
        <KateInsights />
        <CareGaps />

        {/* ── Provider Network ── */}
        <div className="mt-10 px-7" data-wizard="providers">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: TEXT_LIGHT }}>
            Your Providers
          </div>
          <FrostCard className="mt-3 overflow-hidden divide-y" style={{ borderColor: "rgba(90,120,90,0.1)" }}>
            {snapshots.map((s: any, idx: number) => {
              const overdue = isOverdue(s);
              const booked = hasConfirmedBooking(s);
              const isPharmacy = s.provider.provider_type === "pharmacy";
              const dotColor = isPharmacy ? TEXT_LIGHT : overdue ? "#E04030" : booked ? GOLD : GREEN;

              return (
                <div
                  key={s.provider.id}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/30"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 rounded-full transition-shadow"
                      style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}30` }}
                    />
                    <div>
                      <span className="text-sm font-medium" style={{ color: TEXT_DARK }}>
                        <ProviderLink providerId={s.provider.id} providerName={s.provider.name} />
                      </span>
                      {isPharmacy && <span className="ml-2 text-[10px]" style={{ color: TEXT_LIGHT }}>Pharmacy</span>}
                    </div>
                  </div>
                  {isPharmacy ? (
                    <span className="text-[10px] font-medium" style={{ color: TEXT_LIGHT }}>Tracked</span>
                  ) : overdue ? (
                    <HandleItButton userId={appUserId} providerId={s.provider.id} providerName={s.provider.name} label="Book" />
                  ) : booked ? (
                    <span className="text-[10px] font-semibold" style={{ color: GOLD }}>Upcoming</span>
                  ) : (
                    <span className="text-[10px] font-semibold" style={{ color: GREEN }}>On track</span>
                  )}
                </div>
              );
            })}
            {snapshots.length === 0 && (
              <div className="px-5 py-8 text-center text-sm" style={{ color: TEXT_LIGHT }}>No providers discovered yet.</div>
            )}
          </FrostCard>
        </div>

        {/* ── At a Glance — Orbs ── */}
        <div className="mt-10 px-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: TEXT_LIGHT }}>
            At a Glance
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <StatOrb value={providerCount} label="Providers" color={GREEN} href="/providers" />
            <StatOrb value={overdueCount} label="Overdue" color={overdueCount > 0 ? "#E04030" : TEXT_LIGHT} href="/visits" />
            <StatOrb value={upcomingCount} label="Upcoming" color={GOLD} href="/visits" />
          </div>
        </div>
      </div>

      {/* ── What To Do Next ── */}
      <div className="mx-auto max-w-lg sm:max-w-xl md:max-w-2xl mt-10 px-7 pb-8" data-wizard="next-steps">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: TEXT_LIGHT }}>
          What To Do Next
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/providers", title: "Manage Providers", desc: "Add, edit, or review your care team" },
            { href: "/settings", title: "Your Profile", desc: "Health history, insurance, preferences" },
            { href: "/visits", title: "Visits", desc: "Upcoming and past appointments" },
            { href: "/goals", title: "Goals", desc: "Set and track your health goals" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <FrostCard className="p-4 group hover:shadow-md transition-all">
                <div className="text-sm font-semibold" style={{ color: TEXT_DARK }}>{item.title}</div>
                <div className="text-xs mt-1 leading-relaxed" style={{ color: TEXT_MID }}>{item.desc}</div>
                {/* Gradient underline — grows on hover */}
                <div
                  className="mt-3 h-[2px] w-6 rounded-full transition-all duration-300 group-hover:w-10"
                  style={{ background: `linear-gradient(90deg, ${GREEN}, ${TEAL_GLOW})` }}
                />
              </FrostCard>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function DashboardV2Page() {
  return (
    <Suspense fallback={<main className="min-h-screen" style={{ background: `linear-gradient(180deg, ${SKY_TOP} 0%, ${SKY_MID} 35%, ${SKY_BOT} 100%)` }} />}>
      <DashboardInner />
    </Suspense>
  );
}
