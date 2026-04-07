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

/* ───────────────────────── Colors ───────────────────────── */

const C = {
  bg: "linear-gradient(160deg, #3A4038 0%, #2A302A 40%, #1E2420 100%)",
  glass: "rgba(255, 255, 255, 0.08)",
  glassWarm: "rgba(255, 255, 255, 0.10)",
  glassBorder: "rgba(255, 255, 255, 0.12)",
  glassBorderSubtle: "rgba(255, 255, 255, 0.08)",
  orange: "#E08850",
  cream: "#F0EDE8",
  muted: "rgba(240, 237, 232, 0.55)",
  mutedLight: "rgba(240, 237, 232, 0.4)",
  olive: "#5C6B5C",
  lavender: "#9078C8",
  skyBlue: "#B0D4F0",
  tagBg: "rgba(255, 255, 255, 0.1)",
  tabBarBg: "rgba(42, 48, 42, 0.9)",
};

/* ───────────────────── QB Leaf Logo ───────────────────── */

function QBLeafLogo({ size = 24, color = C.cream }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C12 2 8 6 8 12C8 16.5 10 20 12 22C14 20 16 16.5 16 12C16 6 12 2 12 2Z"
        fill={color}
        opacity="0.9"
      />
      <path
        d="M4 10C4 10 7 8 12 10C17 12 20 10 20 10C20 10 17 16 12 14C7 12 4 14 4 10Z"
        fill={color}
        opacity="0.6"
      />
    </svg>
  );
}

/* ───────────────────── Glass Card ───────────────────── */

function WarmGlassCard({
  children,
  className = "",
  accentLeft,
  warm,
}: {
  children: React.ReactNode;
  className?: string;
  accentLeft?: string;
  warm?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 transition-all duration-200 ${className}`}
      style={{
        background: warm ? C.glassWarm : C.glass,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${C.glassBorder}`,
        borderLeft: accentLeft ? `3px solid ${accentLeft}` : undefined,
        borderRadius: "16px",
      }}
    >
      {children}
    </div>
  );
}

/* ───────────────────── Top Bar ───────────────────── */

function TopBar() {
  return (
    <div className="flex items-center justify-between px-1 pb-2">
      <QBLeafLogo size={28} color={C.orange} />
      <div className="flex items-center gap-4">
        {/* Bell icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {/* Gear icon */}
        <Link href="/account">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────── Greeting Section ───────────────────── */

function GreetingSection({ userName }: { userName: string | null }) {
  const name = userName || "there";
  return (
    <div className="px-1 pb-5 pt-4">
      <p className="text-sm" style={{ color: C.muted }}>
        Hi, {name}
      </p>
      <h1
        className="mt-1 text-2xl font-medium leading-snug"
        style={{ color: C.cream }}
      >
        Keep thriving, one appointment at a time
      </h1>
    </div>
  );
}

/* ───────────────────── Week Calendar Strip ───────────────────── */

function WeekCalendarStrip() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return {
      abbr: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
      date: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
    };
  });

  return (
    <WarmGlassCard className="mb-4">
      <div className="flex items-center justify-between">
        {days.map((day) => (
          <div key={day.abbr} className="flex flex-col items-center gap-1.5">
            <span
              className="text-[10px] font-medium uppercase"
              style={{ color: C.muted, letterSpacing: "0.05em" }}
            >
              {day.abbr}
            </span>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200"
              style={{
                background: day.isToday ? C.orange : "transparent",
                color: day.isToday ? "#1E2420" : C.cream,
              }}
            >
              {day.date}
            </span>
          </div>
        ))}
      </div>
    </WarmGlassCard>
  );
}

/* ───────────────────── Provider Action Cards ───────────────────── */

function OverdueCard({ snapshot, userId }: { snapshot: Snapshot; userId: string }) {
  const detail = snapshot.lastVisitDate
    ? formatLastVisit(snapshot.lastVisitDate)
    : "Overdue for a visit";

  const firstName = snapshot.provider.name.split(" ")[0];

  return (
    <WarmGlassCard warm>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold" style={{ color: C.cream }}>
            {snapshot.provider.name}
          </h3>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>
            {detail}
          </p>
        </div>
        <span
          className="ml-3 flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: "rgba(224, 136, 80, 0.15)", color: C.orange }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: C.orange }}
          />
          Overdue
        </span>
      </div>
      <HandleItButton
        userId={userId}
        providerId={snapshot.provider.id}
        providerName={snapshot.provider.name}
        phoneNumber={snapshot.provider.phone}
        label={`Book with ${firstName} \u2192`}
      />
    </WarmGlassCard>
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
    <WarmGlassCard accentLeft={C.olive}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold" style={{ color: C.cream }}>
            {snapshot.provider.name}
          </h3>
          <p className="mt-1.5 text-sm font-medium" style={{ color: "rgba(240, 237, 232, 0.8)" }}>
            {detail}
          </p>
        </div>
        <span
          className="ml-3 flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: "rgba(92, 107, 92, 0.2)", color: C.olive }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: C.olive }}
          />
          Upcoming
        </span>
      </div>
    </WarmGlassCard>
  );
}

function InProgressCard({ snapshot }: { snapshot: Snapshot }) {
  return (
    <WarmGlassCard>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold" style={{ color: C.cream }}>
            {snapshot.provider.name}
          </h3>
          <div className="mt-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ background: C.lavender }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: C.lavender }}
              />
            </span>
            <span className="text-sm" style={{ color: C.lavender }}>
              Kate is calling
            </span>
          </div>
        </div>
        <span
          className="ml-3 flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: "rgba(144, 120, 200, 0.15)", color: C.lavender }}
        >
          In progress
        </span>
      </div>
    </WarmGlassCard>
  );
}

function UpToDateCard({ snapshot }: { snapshot: Snapshot }) {
  const detail = snapshot.lastVisitDate
    ? formatLastVisit(snapshot.lastVisitDate)
    : `${snapshot.visitCount} visit${snapshot.visitCount === 1 ? "" : "s"} on record`;

  return (
    <WarmGlassCard>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3
            className="text-base font-medium"
            style={{ color: "rgba(240, 237, 232, 0.6)" }}
          >
            {snapshot.provider.name}
          </h3>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>
            {detail}
          </p>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.olive}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-3 flex-shrink-0 opacity-60"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    </WarmGlassCard>
  );
}

function CalendarNudgeCard({ userId }: { userId: string }) {
  return (
    <Link href={`/calendar-connect?user_id=${encodeURIComponent(userId)}`}>
      <WarmGlassCard accentLeft={C.skyBlue}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold" style={{ color: C.cream }}>
              Connect your calendar
            </h3>
            <p className="mt-1 text-sm" style={{ color: C.muted }}>
              Connect your calendar for smarter booking
            </p>
          </div>
          <span
            className="ml-3 flex-shrink-0 rounded-full px-5 py-2.5 text-xs font-medium"
            style={{ background: "rgba(176, 212, 240, 0.2)", color: C.skyBlue }}
          >
            Connect
          </span>
        </div>
      </WarmGlassCard>
    </Link>
  );
}

/* ───────────────────── Action Cards List ───────────────────── */

function ActionCards({
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
        cards.push(<OverdueCard key={key} snapshot={item.snapshot} userId={userId} />);
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
    <section className="space-y-3">
      {cards.length === 0 ? (
        <WarmGlassCard>
          <p className="py-4 text-center" style={{ color: C.muted }}>
            No providers discovered yet.
          </p>
        </WarmGlassCard>
      ) : (
        cards
      )}
    </section>
  );
}

/* ───────────────────── Health Summary Ring ───────────────────── */

function HealthRing({ items }: { items: ActionItem[] }) {
  const total = items.length || 1;
  const overdueCount = items.filter((i) => i.type === "overdue").length;
  const upcomingCount = items.filter((i) => i.type === "upcoming").length;
  const inProgressCount = items.filter((i) => i.type === "in-progress").length;
  const upToDateCount = total - overdueCount - upcomingCount - inProgressCount;

  const segments = [
    { label: "Overdue", count: overdueCount, color: C.orange },
    { label: "Upcoming", count: upcomingCount, color: C.skyBlue },
    { label: "In progress", count: inProgressCount, color: C.lavender },
    { label: "Up to date", count: upToDateCount, color: C.olive },
  ].filter((s) => s.count > 0);

  // SVG ring calculations
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 4; // gap in degrees between segments

  let currentAngle = -90; // start at top

  const arcs = segments.map((seg) => {
    const fraction = seg.count / total;
    const angle = fraction * 360 - gap;
    const startAngle = currentAngle;
    currentAngle += fraction * 360;

    const dashLength = (angle / 360) * circumference;
    const dashGap = circumference - dashLength;

    const rotation = startAngle;

    return {
      ...seg,
      dashLength,
      dashGap,
      rotation,
    };
  });

  return (
    <WarmGlassCard className="mt-4">
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={strokeWidth}
            />
            {/* Segments */}
            {arcs.map((arc, i) => (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc.dashLength} ${arc.dashGap}`}
                strokeLinecap="round"
                transform={`rotate(${arc.rotation} ${size / 2} ${size / 2})`}
                style={{ transition: "stroke-dasharray 0.6s ease" }}
              />
            ))}
          </svg>
          {/* Center leaf */}
          <div className="absolute inset-0 flex items-center justify-center">
            <QBLeafLogo size={28} color="rgba(240, 237, 232, 0.3)" />
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: seg.color }}
              />
              <span className="text-xs" style={{ color: C.muted }}>
                {seg.label}
              </span>
              <span className="text-xs font-semibold" style={{ color: C.cream }}>
                {seg.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </WarmGlassCard>
  );
}

/* ───────────────────── Bottom Tab Bar ───────────────────── */

function WarmBottomTabBar() {
  const tabs = [
    {
      label: "Home",
      href: "/dashboard-v5",
      active: true,
      iconActive: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={C.orange} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C12 2 8 6 8 12C8 16.5 10 20 12 22C14 20 16 16.5 16 12C16 6 12 2 12 2Z" opacity="0.9" />
          <path d="M4 10C4 10 7 8 12 10C17 12 20 10 20 10C20 10 17 16 12 14C7 12 4 14 4 10Z" opacity="0.6" />
        </svg>
      ),
      iconInactive: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C12 2 8 6 8 12C8 16.5 10 20 12 22C14 20 16 16.5 16 12C16 6 12 2 12 2Z" />
          <path d="M4 10C4 10 7 8 12 10C17 12 20 10 20 10C20 10 17 16 12 14C7 12 4 14 4 10Z" />
        </svg>
      ),
    },
    {
      label: "Calendar",
      href: "/visits",
      active: false,
      iconActive: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={C.orange} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <rect x="3" y="4" width="18" height="6" rx="3" fill={C.orange} />
          <line x1="8" y1="2" x2="8" y2="6" stroke={C.orange} strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="2" x2="16" y2="6" stroke={C.orange} strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      iconInactive: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
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
      iconActive: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={C.orange} xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
      iconInactive: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
    },
    {
      label: "Profile",
      href: "/account",
      active: false,
      iconActive: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={C.orange} xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        </svg>
      ),
      iconInactive: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
        background: C.tabBarBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: `1px solid ${C.glassBorderSubtle}`,
      }}
    >
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-4">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className="flex flex-col items-center gap-1 transition-colors duration-200"
            style={{
              color: tab.active ? C.orange : C.mutedLight,
            }}
          >
            {tab.active ? tab.iconActive : tab.iconInactive}
            <span className="text-[10px] font-medium">{tab.label}</span>
            {tab.active && (
              <span
                className="mt-[-2px] h-1 w-1 rounded-full"
                style={{ background: C.orange }}
              />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* ───────────────────── Loading Skeleton ───────────────────── */

function LoadingSkeleton() {
  return (
    <main className="min-h-screen px-4 pt-8" style={{ background: C.bg }}>
      <div className="mx-auto max-w-md space-y-4 pt-12">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl p-6"
            style={{
              background: C.glass,
              backdropFilter: "blur(20px)",
              border: `1px solid ${C.glassBorder}`,
              borderRadius: "16px",
            }}
          >
            <div
              className="mb-3 h-4 w-1/3 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <div
              className="mb-2 h-3 w-2/3 rounded-full"
              style={{ background: "rgba(255,255,255,0.05)" }}
            />
            <div
              className="h-3 w-1/2 rounded-full"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
          </div>
        ))}
      </div>
    </main>
  );
}

/* ───────────────────── Main Dashboard ───────────────────── */

function DashboardV5Inner() {
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

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!data) return null;

  return (
    <main
      className="relative min-h-screen overflow-hidden px-4 pb-24 pt-8 sm:px-6"
      style={{ background: C.bg }}
    >
      <div className="relative z-10 mx-auto max-w-md">
        <TopBar />
        <GreetingSection userName={data.userName} />
        <WeekCalendarStrip />
        <ActionCards
          items={actionItems}
          userId={data.appUserId}
          showCalendarNudge={!data.hasGoogleCalendarConnection}
        />
        <HealthRing items={actionItems} />
      </div>
      <WarmBottomTabBar />
    </main>
  );
}

export default function DashboardV5Page() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardV5Inner />
    </Suspense>
  );
}
