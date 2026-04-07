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

/* ───────────────────── Animated Gradient Background ───────────────────── */

function AnimatedGradientBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #F0EDE8 0%, #B0D4F0 40%, #E2F0A0 70%, #F0EDE8 100%)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 20s ease infinite",
        }}
      />
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          25% { background-position: 100% 50%; }
          50% { background-position: 100% 0%; }
          75% { background-position: 0% 100%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

/* ───────────────────── Botanical SVG (Light) ───────────────────── */

function BotanicalSVG() {
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
        opacity="0.1"
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
      {/* Leaf vein lines */}
      <path
        d="M320 60 Q290 140 260 220"
        stroke="#5C6B5C"
        strokeWidth="1"
        opacity="0.08"
      />
      <path
        d="M350 100 Q330 170 300 240"
        stroke="#5C6B5C"
        strokeWidth="0.8"
        opacity="0.06"
      />
    </svg>
  );
}

/* ───────────────────── Glass Card Wrapper ───────────────────── */

const glassBase =
  "relative overflow-hidden rounded-[20px] border border-white/60 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-200 hover:scale-[1.005] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]";

const glassStandard =
  glassBase + " bg-white/45 backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)]";

const glassMuted =
  glassBase + " bg-white/30 backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)]";

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
    <section className={glassStandard + " p-8"}>
      <BotanicalSVG />
      <div className="relative z-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5C6B5C]">
          Quarterback
        </p>
        <h1 className="mt-3 text-[32px] font-light leading-tight tracking-tight text-[#1A1D2E] sm:text-4xl">
          {greeting}, {name}.
        </h1>
        <p className="mt-2 text-base text-[#5C6B5C]">{subtitle}</p>
      </div>
    </section>
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
    <div className={glassStandard + " border-l-4 border-l-[#E04030]"}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[#1A1D2E]">
            {snapshot.provider.name}
          </h3>
          <p className="mt-1 text-sm text-[#5C6B5C]/80">{detail}</p>
        </div>
        <span className="ml-3 flex-shrink-0 rounded-full bg-[#E04030]/15 px-2.5 py-1 text-xs font-medium text-[#E04030]">
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
    </div>
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
    <div className={glassStandard + " border-l-4 border-l-[#5C6B5C]"}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[#1A1D2E]">
            {snapshot.provider.name}
          </h3>
          <p className="mt-1 text-sm text-[#5C6B5C]/80">{detail}</p>
        </div>
        <span className="ml-3 flex-shrink-0 rounded-full bg-[#5C6B5C]/15 p-1.5 text-[#5C6B5C]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      </div>
    </div>
  );
}

function InProgressCard({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className={glassStandard + " border-l-4 border-l-[#9078C8]"}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[#1A1D2E]">
            {snapshot.provider.name}
          </h3>
          <p className="mt-1 text-sm text-[#5C6B5C]/80">
            Kate is working on this
          </p>
        </div>
        <span className="ml-3 flex-shrink-0 rounded-full bg-[#9078C8]/15 px-2.5 py-1 text-xs font-medium text-[#9078C8]">
          In progress
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9078C8] opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#9078C8]" />
        </span>
        <span className="text-xs text-[#9078C8]/70">Scheduling in progress</span>
      </div>
    </div>
  );
}

function UpToDateCard({ snapshot }: { snapshot: Snapshot }) {
  const detail = snapshot.lastVisitDate
    ? formatLastVisit(snapshot.lastVisitDate)
    : `${snapshot.visitCount} visit${snapshot.visitCount === 1 ? "" : "s"} on record`;

  return (
    <div className={glassMuted}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-medium text-[#5C6B5C]/70">
            {snapshot.provider.name}
          </h3>
          <p className="mt-1 text-sm text-[#5C6B5C]/50">{detail}</p>
        </div>
        <span className="ml-3 flex-shrink-0 text-[#5C6B5C]/30">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      </div>
    </div>
  );
}

function CalendarNudgeCard({ userId }: { userId: string }) {
  return (
    <Link
      href={`/calendar-connect?user_id=${encodeURIComponent(userId)}`}
      className={glassStandard + " block border-l-4 border-l-[#B0D4F0]"}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[#1A1D2E]">
            Connect your calendar
          </h3>
          <p className="mt-1 text-sm text-[#5C6B5C]/80">
            Kate can check your schedule before booking
          </p>
        </div>
        <span className="ml-3 flex-shrink-0 rounded-full bg-[#B0D4F0]/25 p-2 text-[#4A90B8]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
      </div>
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

    // Insert calendar nudge after 2nd card
    if (i === 1 && showCalendarNudge) {
      cards.push(<CalendarNudgeCard key="calendar-nudge" userId={userId} />);
    }
  }

  // If fewer than 2 cards but nudge needed, append it
  if (items.length < 2 && showCalendarNudge) {
    cards.push(<CalendarNudgeCard key="calendar-nudge" userId={userId} />);
  }

  return (
    <section className="mt-6 space-y-3 pb-28">
      {cards.length === 0 ? (
        <div className={glassStandard + " p-8 text-center"}>
          <p className="text-[#5C6B5C]/60">No providers discovered yet.</p>
        </div>
      ) : (
        cards
      )}
    </section>
  );
}

/* ───────────────────── Glass Bottom Tab Bar ───────────────────── */

function GlassBottomTabBar() {
  const tabs = [
    {
      label: "Home",
      href: "/dashboard-v3",
      active: true,
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
        </svg>
      ),
    },
    {
      label: "Timeline",
      href: "/timeline",
      active: false,
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
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
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
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
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <text
            x="12"
            y="16"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="11"
            fontWeight="600"
          >
            K
          </text>
        </svg>
      ),
    },
    {
      label: "Profile",
      href: "/account",
      active: false,
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/50 bg-white/70 backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)]">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-4">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 transition-colors duration-200 ${
              tab.active
                ? "text-[#5C6B5C]"
                : "text-[#1A1D2E]/40 hover:text-[#1A1D2E]/60"
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        ))}
      </div>
      {/* Safe area for phones with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

/* ───────────────────── Loading Skeleton ───────────────────── */

function LoadingSkeleton() {
  return (
    <main className="relative min-h-screen">
      <AnimatedGradientBackground />
      <div className="mx-auto max-w-lg px-4 pt-10 sm:px-6">
        <div className={glassStandard + " h-40 animate-pulse p-8"} />
        <div className="mt-6 space-y-3">
          <div className={glassStandard + " h-24 animate-pulse"} />
          <div className={glassStandard + " h-24 animate-pulse"} />
          <div className={glassMuted + " h-20 animate-pulse"} />
        </div>
      </div>
    </main>
  );
}

/* ───────────────────── Main Dashboard ───────────────────── */

function DashboardV3Inner() {
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
    return <LoadingSkeleton />;
  }

  if (!data) return null;

  return (
    <main className="relative min-h-screen">
      <AnimatedGradientBackground />
      <div className="mx-auto max-w-lg px-4 pb-20 pt-10 sm:px-6">
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
      <GlassBottomTabBar />
    </main>
  );
}

export default function DashboardV3Page() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardV3Inner />
    </Suspense>
  );
}
