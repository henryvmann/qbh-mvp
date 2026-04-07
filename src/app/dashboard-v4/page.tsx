"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import HandleItButton from "../../components/qbh/HandleItButton";

/* ───────────────────────── Types ───────────────────────── */

type Snapshot = {
  provider: { id: string; name: string; phone: string | null };
  followUpNeeded: boolean;
  booking_state: {
    status: string;
    displayTime: string | null;
    appointmentStart: string | null;
  };
  futureConfirmedEvent: { start_at: string } | null;
  system_actions: { next: { type: string; status: string } | null };
  visitCount: number;
  lastVisitDate: string | null;
};

type DashboardData = {
  appUserId: string;
  userName: string | null;
  snapshots: Snapshot[];
  discoverySummary: { chargesAnalyzed: number; providersFound: number };
  hasGoogleCalendarConnection: boolean;
};

/* ───────────────────────── Helpers ───────────────────────── */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function monthsAgo(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    (now.getFullYear() - d.getFullYear()) * 12 +
    (now.getMonth() - d.getMonth())
  );
}

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  if (diffDays === 1) {
    return `Tomorrow at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  if (diffDays > 1 && diffDays <= 7) {
    return `${d.toLocaleDateString([], { weekday: "long" })} at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLastVisit(dateStr: string): string {
  const m = monthsAgo(dateStr);
  if (m <= 0) return "Last visit this month";
  if (m === 1) return "Last visit 1 month ago";
  return `Last visit ${m} months ago`;
}

/* ───────────── Card classification ───────────── */

type CardType = "overdue" | "upcoming" | "in-progress" | "up-to-date";

type ActionItem = {
  type: CardType;
  snapshot: Snapshot;
  sortOrder: number;
};

function classifySnapshots(snapshots: Snapshot[]): ActionItem[] {
  const items: ActionItem[] = [];

  for (const s of snapshots) {
    const hasUpcoming =
      s.booking_state.status === "BOOKED" || s.futureConfirmedEvent !== null;
    const isInProgress = s.booking_state.status === "IN_PROGRESS";
    const isOverdue =
      s.followUpNeeded ||
      (s.lastVisitDate && monthsAgo(s.lastVisitDate) > 6 && !hasUpcoming);

    if (isOverdue && !hasUpcoming && !isInProgress) {
      items.push({ type: "overdue", snapshot: s, sortOrder: 0 });
    } else if (hasUpcoming) {
      items.push({ type: "upcoming", snapshot: s, sortOrder: 1 });
    } else if (isInProgress) {
      items.push({ type: "in-progress", snapshot: s, sortOrder: 2 });
    } else {
      items.push({ type: "up-to-date", snapshot: s, sortOrder: 3 });
    }
  }

  items.sort((a, b) => a.sortOrder - b.sortOrder);
  return items;
}

/* ───────────────────── Ambient Orbs ───────────────────── */

function AmbientOrbs() {
  return (
    <>
      <style jsx>{`
        @keyframes drift1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -15px); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-15px, 20px); }
        }
        @keyframes drift3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(10px, 12px); }
        }
      `}</style>
      <div
        className="pointer-events-none fixed right-[-100px] top-[-50px] h-[500px] w-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(144, 120, 200, 0.08) 0%, transparent 70%)",
          filter: "blur(400px)",
          animation: "drift1 30s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none fixed bottom-[-100px] left-[-100px] h-[600px] w-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(92, 107, 92, 0.06) 0%, transparent 70%)",
          filter: "blur(500px)",
          animation: "drift2 35s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none fixed left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(176, 212, 240, 0.04) 0%, transparent 70%)",
          filter: "blur(600px)",
          animation: "drift3 40s ease-in-out infinite",
        }}
      />
    </>
  );
}

/* ───────────────────── Botanical SVG ───────────────────── */

function LeafDecoration() {
  return (
    <svg
      className="pointer-events-none absolute right-0 top-0 h-full w-2/3"
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMaxYMid slice"
    >
      <ellipse
        cx="300"
        cy="80"
        rx="120"
        ry="40"
        transform="rotate(-30 300 80)"
        fill="#5C6B5C"
        opacity="0.08"
      />
      <ellipse
        cx="340"
        cy="160"
        rx="100"
        ry="35"
        transform="rotate(15 340 160)"
        fill="#5C6B5C"
        opacity="0.06"
      />
      <ellipse
        cx="280"
        cy="220"
        rx="90"
        ry="30"
        transform="rotate(-45 280 220)"
        fill="#5C6B5C"
        opacity="0.08"
      />
      <ellipse
        cx="360"
        cy="240"
        rx="60"
        ry="25"
        transform="rotate(25 360 240)"
        fill="#5C6B5C"
        opacity="0.05"
      />
    </svg>
  );
}

/* ───────────────────── Glass Card Wrapper ───────────────────── */

function GlassCard({
  children,
  className = "",
  borderColor,
  glow,
  muted,
}: {
  children: React.ReactNode;
  className?: string;
  borderColor?: string;
  glow?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] p-5 transition-all duration-200 hover:bg-white/[0.08] ${className}`}
      style={{
        background: muted ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid rgba(255,255,255,${muted ? "0.05" : "0.1"})`,
        borderLeft: borderColor ? `4px solid ${borderColor}` : undefined,
        borderRadius: "20px",
        boxShadow: glow
          ? `0 8px 32px rgba(0,0,0,0.3), 0 0 20px ${glow}`
          : "0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      {children}
    </div>
  );
}

/* ───────────────────── Hero Section ───────────────────── */

function HeroCard({
  userName,
  overdueCount,
  upcomingCount,
}: {
  userName: string | null;
  overdueCount: number;
  upcomingCount: number;
}) {
  const greeting = getGreeting();
  const name = userName || "there";

  let subtitle: string;
  if (overdueCount > 0) {
    subtitle = `You've got ${overdueCount} thing${overdueCount === 1 ? "" : "s"} to take care of.`;
  } else if (upcomingCount > 0) {
    subtitle = `You have ${upcomingCount} appointment${upcomingCount === 1 ? "" : "s"} coming up.`;
  } else {
    subtitle = "You're all caught up. Enjoy your day.";
  }

  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-8 transition-all duration-200 hover:bg-white/[0.08]"
      style={{
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      <LeafDecoration />
      <div className="relative z-10">
        <p
          className="text-xs font-medium uppercase"
          style={{ letterSpacing: "0.2em", color: "#B0D4F0" }}
        >
          Quarterback
        </p>
        <h1
          className="mt-3 text-4xl font-light tracking-tight"
          style={{ color: "#F0EDE8" }}
        >
          {greeting}, {name}.
        </h1>
        <p className="mt-2 text-base" style={{ color: "rgba(240,237,232,0.5)" }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

/* ───────────────────── Action Cards ───────────────────── */

function OverdueCard({
  snapshot,
  userId,
}: {
  snapshot: Snapshot;
  userId: string;
}) {
  const detail = snapshot.lastVisitDate
    ? formatLastVisit(snapshot.lastVisitDate)
    : "Overdue for a visit";

  return (
    <GlassCard borderColor="#E04030" glow="rgba(224,64,48,0.15)">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold" style={{ color: "#F0EDE8" }}>
            {snapshot.provider.name}
          </h3>
          <p className="mt-1 text-sm" style={{ color: "rgba(240,237,232,0.5)" }}>
            {detail}
          </p>
        </div>
        <span
          className="ml-3 flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: "rgba(224,64,48,0.15)", color: "#E04030" }}
        >
          Overdue
        </span>
      </div>
      <div className="mt-4">
        <HandleItButton
          userId={userId}
          providerId={snapshot.provider.id}
          providerName={snapshot.provider.name}
          phoneNumber={snapshot.provider.phone}
          label="Let Kate book it"
        />
      </div>
    </GlassCard>
  );
}

function UpcomingCard({ snapshot }: { snapshot: Snapshot }) {
  let detail: string;
  if (snapshot.booking_state.displayTime) {
    detail = snapshot.booking_state.displayTime;
  } else if (snapshot.futureConfirmedEvent?.start_at) {
    detail = formatRelativeDate(snapshot.futureConfirmedEvent.start_at);
  } else if (snapshot.booking_state.appointmentStart) {
    detail = formatRelativeDate(snapshot.booking_state.appointmentStart);
  } else {
    detail = "Appointment booked";
  }

  return (
    <GlassCard borderColor="#E2F0A0">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold" style={{ color: "#F0EDE8" }}>
            {snapshot.provider.name}
          </h3>
          <p className="mt-1 text-sm" style={{ color: "rgba(240,237,232,0.8)" }}>
            {detail}
          </p>
        </div>
        <span
          className="ml-3 flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: "rgba(226,240,160,0.15)", color: "#E2F0A0" }}
        >
          Upcoming
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#E2F0A0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span className="text-sm" style={{ color: "rgba(226,240,160,0.7)" }}>
          Confirmed
        </span>
      </div>
    </GlassCard>
  );
}

function InProgressCard({ snapshot }: { snapshot: Snapshot }) {
  return (
    <GlassCard borderColor="#9078C8">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold" style={{ color: "#F0EDE8" }}>
            {snapshot.provider.name}
          </h3>
          <p className="mt-1 text-sm" style={{ color: "rgba(240,237,232,0.5)" }}>
            Kate is working on this
          </p>
        </div>
        <span
          className="ml-3 flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: "rgba(144,120,200,0.15)", color: "#9078C8" }}
        >
          In progress
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ background: "#9078C8" }}
          />
          <span
            className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{ background: "#9078C8" }}
          />
        </span>
        <span className="text-xs" style={{ color: "rgba(144,120,200,0.7)" }}>
          Scheduling in progress
        </span>
      </div>
    </GlassCard>
  );
}

function UpToDateCard({ snapshot }: { snapshot: Snapshot }) {
  const detail = snapshot.lastVisitDate
    ? formatLastVisit(snapshot.lastVisitDate)
    : `${snapshot.visitCount} visit${snapshot.visitCount === 1 ? "" : "s"} on record`;

  return (
    <GlassCard muted>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3
            className="text-base font-medium"
            style={{ color: "rgba(240,237,232,0.5)" }}
          >
            {snapshot.provider.name}
          </h3>
          <p className="mt-1 text-sm" style={{ color: "rgba(240,237,232,0.3)" }}>
            {detail}
          </p>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(240,237,232,0.25)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-3 flex-shrink-0"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    </GlassCard>
  );
}

function CalendarNudgeCard({ userId }: { userId: string }) {
  return (
    <Link href={`/calendar-connect?user_id=${encodeURIComponent(userId)}`}>
      <GlassCard borderColor="#B0D4F0">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold" style={{ color: "#F0EDE8" }}>
              Connect your calendar
            </h3>
            <p className="mt-1 text-sm" style={{ color: "rgba(240,237,232,0.5)" }}>
              Kate can check your schedule before booking
            </p>
          </div>
          <span
            className="ml-3 flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: "rgba(176,212,240,0.15)", color: "#B0D4F0" }}
          >
            Connect
          </span>
        </div>
      </GlassCard>
    </Link>
  );
}

/* ───────────────────── Action Feed ───────────────────── */

function ActionFeed({
  items,
  userId,
  showCalendarNudge,
}: {
  items: ActionItem[];
  userId: string;
  showCalendarNudge: boolean;
}) {
  const cards: React.ReactNode[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = item.snapshot.provider.id;

    switch (item.type) {
      case "overdue":
        cards.push(
          <OverdueCard key={key} snapshot={item.snapshot} userId={userId} />
        );
        break;
      case "upcoming":
        cards.push(<UpcomingCard key={key} snapshot={item.snapshot} />);
        break;
      case "in-progress":
        cards.push(<InProgressCard key={key} snapshot={item.snapshot} />);
        break;
      case "up-to-date":
        cards.push(<UpToDateCard key={key} snapshot={item.snapshot} />);
        break;
    }

    if (i === 1 && showCalendarNudge) {
      cards.push(<CalendarNudgeCard key="calendar-nudge" userId={userId} />);
    }
  }

  if (items.length < 2 && showCalendarNudge) {
    cards.push(<CalendarNudgeCard key="calendar-nudge" userId={userId} />);
  }

  return (
    <section className="mt-6 space-y-3 pb-28">
      {cards.length === 0 ? (
        <GlassCard>
          <p className="py-4 text-center" style={{ color: "rgba(240,237,232,0.5)" }}>
            No providers discovered yet.
          </p>
        </GlassCard>
      ) : (
        cards
      )}
    </section>
  );
}

/* ───────────────────── Bottom Tab Bar ───────────────────── */

function DarkGlassBottomTabBar() {
  const tabs = [
    {
      label: "Home",
      href: "/dashboard-v4",
      active: true,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
        </svg>
      ),
    },
    {
      label: "Timeline",
      href: "/timeline",
      active: false,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: "Calendar",
      href: "/visits",
      active: false,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      label: "Kate",
      href: "#kate",
      active: false,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="12" fontWeight="bold">K</text>
        </svg>
      ),
    },
    {
      label: "Profile",
      href: "/account",
      active: false,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "rgba(26,29,46,0.8)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-4">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className="flex flex-col items-center gap-0.5 transition-colors"
            style={{
              color: tab.active ? "#E2F0A0" : "rgba(240,237,232,0.3)",
            }}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* ───────────────────── Main Dashboard ───────────────────── */

function DashboardV4Inner() {
  const router = useRouter();
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

  const actionItems = useMemo(
    () => (data ? classifySnapshots(data.snapshots) : []),
    [data]
  );

  const overdueCount = useMemo(
    () => actionItems.filter((i) => i.type === "overdue").length,
    [actionItems]
  );

  const upcomingCount = useMemo(
    () => actionItems.filter((i) => i.type === "upcoming").length,
    [actionItems]
  );

  if (loading) {
    return (
      <main
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(135deg, #1A1D2E 0%, #0F1218 30%, #1A2030 60%, #151820 100%)",
        }}
      />
    );
  }

  if (!data) return null;

  return (
    <main
      className="relative min-h-screen overflow-hidden px-4 pb-20 pt-8 sm:px-6"
      style={{
        background:
          "linear-gradient(135deg, #1A1D2E 0%, #0F1218 30%, #1A2030 60%, #151820 100%)",
      }}
    >
      <AmbientOrbs />
      <div className="relative z-10 mx-auto max-w-lg">
        <HeroCard
          userName={data.userName}
          overdueCount={overdueCount}
          upcomingCount={upcomingCount}
        />
        <ActionFeed
          items={actionItems}
          userId={data.appUserId}
          showCalendarNudge={!data.hasGoogleCalendarConnection}
        />
      </div>
      <DarkGlassBottomTabBar />
    </main>
  );
}

export default function DashboardV4Page() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen"
          style={{
            background:
              "linear-gradient(135deg, #1A1D2E 0%, #0F1218 30%, #1A2030 60%, #151820 100%)",
          }}
        />
      }
    >
      <DashboardV4Inner />
    </Suspense>
  );
}
