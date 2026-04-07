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

function daysUntil(dateStr: string): number {
  const now = new Date();
  const d = new Date(dateStr);
  return Math.max(0, Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
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

/* ───────────────────────── Palette ───────────────────────── */

const P = {
  olive: "#5C6B5C",
  cream: "#F0EDE8",
  navy: "#1A1D2E",
  lime: "#E2F0A0",
  skyBlue: "#B0D4F0",
  coral: "#E04030",
  lavender: "#9078C8",
};

/* ───────────────────────── Glass styles ───────────────────────── */

const glassCard: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.07)",
  backdropFilter: "blur(40px)",
  WebkitBackdropFilter: "blur(40px)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "24px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
};

const glassButton: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.12)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "9999px",
  color: P.cream,
};

/* ───────────────────────── Ambient Orbs (CSS keyframes) ───────────────────────── */

const globalStyles = `
@keyframes drift1 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(30px, 20px); }
  50% { transform: translate(-20px, 40px); }
  75% { transform: translate(15px, -10px); }
}
@keyframes drift2 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-25px, 15px); }
  50% { transform: translate(15px, -30px); }
  75% { transform: translate(-10px, 20px); }
}
@keyframes drift3 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(20px, -15px); }
  50% { transform: translate(-15px, 25px); }
  75% { transform: translate(25px, 10px); }
}
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

function AmbientOrbs() {
  return (
    <>
      {/* Top-left olive orb */}
      <div
        className="pointer-events-none fixed"
        style={{
          top: "-100px",
          left: "-100px",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: P.olive,
          opacity: 0.12,
          filter: "blur(200px)",
          animation: "drift1 35s ease-in-out infinite",
        }}
      />
      {/* Bottom-right lavender orb */}
      <div
        className="pointer-events-none fixed"
        style={{
          bottom: "-50px",
          right: "-50px",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: P.lavender,
          opacity: 0.1,
          filter: "blur(200px)",
          animation: "drift2 38s ease-in-out infinite",
        }}
      />
      {/* Center-right sky blue orb */}
      <div
        className="pointer-events-none fixed"
        style={{
          top: "40%",
          right: "10%",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: P.skyBlue,
          opacity: 0.06,
          filter: "blur(200px)",
          animation: "drift3 32s ease-in-out infinite",
        }}
      />
    </>
  );
}

/* ───────────────────────── Arc Gauge ───────────────────────── */

function ArcGauge({
  value,
  label,
  centerText,
  color,
  size = 180,
}: {
  value: number;
  label: string;
  centerText: string;
  color: string;
  size?: number;
}) {
  const r = (size - 20) / 2;
  const circ = Math.PI * r;
  const filled = (Math.min(Math.max(value, 0), 100) / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size / 2 + 20}
        viewBox={`0 0 ${size} ${size / 2 + 20}`}
      >
        <path
          d={`M 10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={`M 10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          className="transition-all duration-1000"
        />
        <text
          x={size / 2}
          y={size / 2 - 8}
          textAnchor="middle"
          fill="#F0EDE8"
          fontSize={size / 4}
          fontWeight="300"
        >
          {centerText}
        </text>
      </svg>
      <span
        className="text-sm text-center"
        style={{ color: "rgba(240,237,232,0.55)" }}
      >
        {label}
      </span>
    </div>
  );
}

/* ───────────────────────── Gauge Section ───────────────────────── */

function GaugeSection({ items }: { items: ActionItem[] }) {
  const total = items.length || 1;
  const goodCount = items.filter(
    (i) => i.type === "up-to-date" || i.type === "upcoming"
  ).length;
  const careScore = Math.round((goodCount / total) * 100);

  // Days until next appointment
  const upcomingDates: number[] = [];
  for (const item of items) {
    const s = item.snapshot;
    if (s.futureConfirmedEvent?.start_at) {
      upcomingDates.push(daysUntil(s.futureConfirmedEvent.start_at));
    } else if (s.booking_state.appointmentStart) {
      upcomingDates.push(daysUntil(s.booking_state.appointmentStart));
    }
  }
  const nextDays = upcomingDates.length > 0 ? Math.min(...upcomingDates) : null;
  const nextValue = nextDays !== null ? Math.max(0, 100 - (nextDays / 30) * 100) : 0;

  // Most overdue provider
  let worstOverdue: { months: number; name: string } | null = null;
  for (const item of items) {
    if (item.snapshot.lastVisitDate) {
      const m = monthsAgo(item.snapshot.lastVisitDate);
      if (!worstOverdue || m > worstOverdue.months) {
        worstOverdue = {
          months: m,
          name: item.snapshot.provider.name.split(" ")[0],
        };
      }
    }
  }
  const overdueValue = worstOverdue
    ? Math.min(100, (worstOverdue.months / 12) * 100)
    : 0;

  const careColor =
    careScore >= 70 ? P.lime : careScore >= 40 ? P.olive : P.coral;

  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 mt-6 pb-2">
      <div
        className="min-w-[220px] flex-1 p-6 flex items-center justify-center"
        style={glassCard}
      >
        <ArcGauge
          value={careScore}
          label="Care Score"
          centerText={`${careScore}%`}
          color={careColor}
        />
      </div>
      <div
        className="min-w-[220px] flex-1 p-6 flex items-center justify-center"
        style={glassCard}
      >
        <ArcGauge
          value={nextValue}
          label="Days to Next"
          centerText={nextDays !== null ? String(nextDays) : "\u2014"}
          color={P.skyBlue}
        />
      </div>
      <div
        className="min-w-[220px] flex-1 p-6 flex items-center justify-center"
        style={glassCard}
      >
        <ArcGauge
          value={overdueValue}
          label={
            worstOverdue
              ? `Months since ${worstOverdue.name}`
              : "No visit data"
          }
          centerText={worstOverdue ? String(worstOverdue.months) : "\u2014"}
          color={P.coral}
        />
      </div>
    </div>
  );
}

/* ───────────────────────── Top Bar ───────────────────────── */

function TopBar({ showCalendarLink, userId }: { showCalendarLink?: boolean; userId?: string }) {
  return (
    <div className="flex items-center justify-between px-6 pt-6">
      {/* Leaf icon in lime */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2C12 2 8 6 8 12C8 16.5 10 20 12 22C14 20 16 16.5 16 12C16 6 12 2 12 2Z"
          fill={P.lime}
          opacity="0.9"
        />
        <path
          d="M4 10C4 10 7 8 12 10C17 12 20 10 20 10C20 10 17 16 12 14C7 12 4 14 4 10Z"
          fill={P.lime}
          opacity="0.6"
        />
      </svg>
      {/* Right icons */}
      <div className="flex items-center gap-4">
        {showCalendarLink && (
          <Link
            href={`/calendar-connect${userId ? `?user_id=${encodeURIComponent(userId)}` : ""}`}
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200"
            style={{
              ...glassButton,
              color: P.skyBlue,
              borderColor: "rgba(176, 212, 240, 0.3)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.skyBlue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Connect Calendar
          </Link>
        )}
        {/* Bell */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={P.cream}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.5 }}
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {/* Gear */}
        <Link href="/account">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={P.cream}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.5 }}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────────── Week Calendar Strip ───────────────────────── */

function WeekCalendarStrip() {
  const today = new Date();
  const dayOfWeek = today.getDay();
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
    <div className="mx-4 mt-6 p-6" style={glassCard}>
      <div className="flex items-center justify-between">
        {days.map((day) => (
          <div key={day.abbr} className="flex flex-col items-center gap-2">
            <span
              className="text-base font-medium uppercase"
              style={{
                color: "rgba(240,237,232,0.5)",
                letterSpacing: "0.05em",
              }}
            >
              {day.abbr}
            </span>
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-xl font-semibold transition-colors duration-200"
              style={{
                background: day.isToday ? P.cream : "transparent",
                color: day.isToday ? P.navy : P.cream,
              }}
            >
              {day.date}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────── Provider Action Cards ───────────────────── */

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
  const firstName = snapshot.provider.name.split(" ")[0];

  return (
    <div className="p-6" style={glassCard}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3
            className="text-xl font-medium"
            style={{ color: P.cream }}
          >
            {snapshot.provider.name}
          </h3>
          <p
            className="mt-2 text-base"
            style={{ color: "rgba(240,237,232,0.6)" }}
          >
            {detail}
          </p>
        </div>
        <span
          className="ml-3 flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
          style={{
            ...glassButton,
            background: "rgba(224, 64, 48, 0.15)",
            color: P.coral,
            border: "1px solid rgba(224, 64, 48, 0.25)",
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: P.coral }}
          />
          Overdue
        </span>
      </div>
      <div className="mt-5">
        <HandleItButton
          userId={userId}
          providerId={snapshot.provider.id}
          providerName={snapshot.provider.name}
          phoneNumber={snapshot.provider.phone}
          label={`Book with ${firstName} \u2192`}
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
    <div className="p-6" style={glassCard}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3
            className="text-xl font-medium"
            style={{ color: P.cream }}
          >
            {snapshot.provider.name}
          </h3>
          <p
            className="mt-2 text-lg font-medium"
            style={{ color: "rgba(240,237,232,0.8)" }}
          >
            {detail}
          </p>
        </div>
        <span
          className="ml-3 flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
          style={{
            ...glassButton,
            background: "rgba(226, 240, 160, 0.15)",
            color: P.lime,
            border: "1px solid rgba(226, 240, 160, 0.25)",
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: P.lime }}
          />
          Upcoming
        </span>
      </div>
    </div>
  );
}

function InProgressCard({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="p-6" style={glassCard}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3
            className="text-xl font-medium"
            style={{ color: P.cream }}
          >
            {snapshot.provider.name}
          </h3>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ background: P.lavender }}
              />
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ background: P.lavender }}
              />
            </span>
            <span className="text-base" style={{ color: P.lavender }}>
              Kate is working on this
            </span>
          </div>
        </div>
        <span
          className="ml-3 flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
          style={{
            ...glassButton,
            background: "rgba(144, 120, 200, 0.15)",
            color: P.lavender,
            border: "1px solid rgba(144, 120, 200, 0.25)",
          }}
        >
          In progress
        </span>
      </div>
    </div>
  );
}

function UpToDateCard({ snapshot }: { snapshot: Snapshot }) {
  const detail = snapshot.lastVisitDate
    ? formatLastVisit(snapshot.lastVisitDate)
    : `${snapshot.visitCount} visit${snapshot.visitCount === 1 ? "" : "s"} on record`;

  return (
    <div
      className="p-6"
      style={{
        ...glassCard,
        background: "rgba(255, 255, 255, 0.04)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3
            className="text-xl font-medium"
            style={{ color: "rgba(240, 237, 232, 0.5)" }}
          >
            {snapshot.provider.name}
          </h3>
          <p
            className="mt-2 text-base"
            style={{ color: "rgba(240,237,232,0.4)" }}
          >
            {detail}
          </p>
        </div>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={P.olive}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-3 flex-shrink-0 opacity-60"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    </div>
  );
}

function CalendarNudgeCard({ userId }: { userId: string }) {
  return (
    <Link href={`/calendar-connect?user_id=${encodeURIComponent(userId)}`}>
      <div
        className="p-6"
        style={{
          ...glassCard,
          background: "rgba(176, 212, 240, 0.08)",
          border: "1px solid rgba(176, 212, 240, 0.2)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h3
              className="text-xl font-medium"
              style={{ color: P.cream }}
            >
              Connect your calendar
            </h3>
            <p
              className="mt-2 text-base"
              style={{ color: "rgba(240,237,232,0.6)" }}
            >
              Smarter booking with your real schedule
            </p>
          </div>
          <span
            className="ml-4 flex-shrink-0 px-6 py-3 text-base font-medium"
            style={glassButton}
          >
            Connect
          </span>
        </div>
      </div>
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
    <section className="mx-4 mt-6 space-y-4">
      {cards.length === 0 ? (
        <div className="p-8 text-center" style={glassCard}>
          <p
            className="text-lg"
            style={{ color: "rgba(240,237,232,0.5)" }}
          >
            No providers discovered yet.
          </p>
        </div>
      ) : (
        cards
      )}
    </section>
  );
}

/* ───────────────────── Bottom Tab Bar ───────────────────── */

function BottomTabBar() {
  const tabs = [
    {
      label: "Home",
      href: "/dashboard-v6",
      active: true,
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2C12 2 8 6 8 12C8 16.5 10 20 12 22C14 20 16 16.5 16 12C16 6 12 2 12 2Z"
            fill="currentColor"
            opacity="0.9"
          />
          <path
            d="M4 10C4 10 7 8 12 10C17 12 20 10 20 10C20 10 17 16 12 14C7 12 4 14 4 10Z"
            fill="currentColor"
            opacity="0.6"
          />
        </svg>
      ),
      iconInactive: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C12 2 8 6 8 12C8 16.5 10 20 12 22C14 20 16 16.5 16 12C16 6 12 2 12 2Z" />
          <path d="M4 10C4 10 7 8 12 10C17 12 20 10 20 10C20 10 17 16 12 14C7 12 4 14 4 10Z" />
        </svg>
      ),
    },
    {
      label: "Calendar",
      href: "/visits",
      active: false,
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="3" y="4" width="18" height="18" rx="3" />
        </svg>
      ),
      iconInactive: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
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
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
      iconInactive: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
    },
    {
      label: "Profile",
      href: "/account",
      active: false,
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        </svg>
      ),
      iconInactive: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
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
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 w-full"
      style={{
        background: "rgba(26, 29, 46, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <div className="mx-auto flex h-16 items-center justify-around px-4">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className="flex flex-col items-center gap-1 transition-colors duration-200"
            style={{
              color: tab.active ? P.lime : "rgba(240,237,232,0.35)",
            }}
          >
            {tab.active ? tab.icon : tab.iconInactive}
            <span className="text-[10px] font-medium">{tab.label}</span>
            {tab.active && (
              <span
                className="mt-[-2px] h-1 w-1 rounded-full"
                style={{ background: P.lime }}
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
    <main
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(160deg, #2A2E2A 0%, #1A1D2E 50%, #2A2830 100%)",
      }}
    >
      <div className="space-y-6 px-4 pt-20">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse p-8"
            style={glassCard}
          >
            <div
              className="mb-4 h-5 w-1/3 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <div
              className="mb-3 h-4 w-2/3 rounded-full"
              style={{ background: "rgba(255,255,255,0.05)" }}
            />
            <div
              className="h-4 w-1/2 rounded-full"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
          </div>
        ))}
      </div>
    </main>
  );
}

/* ───────────────────── Main Dashboard ───────────────────── */

function DashboardV6Inner() {
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

  const name = data.userName || "there";

  return (
    <main
      className="relative min-h-screen overflow-hidden pb-24"
      style={{
        background:
          "linear-gradient(160deg, #2A2E2A 0%, #1A1D2E 50%, #2A2830 100%)",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

      {/* Ambient orbs */}
      <AmbientOrbs />

      {/* Content */}
      <div className="relative z-10">
        {/* Top Bar */}
        <TopBar showCalendarLink={!data.hasGoogleCalendarConnection} userId={data.appUserId} />

        {/* Greeting */}
        <div className="px-6 mt-4">
          <p
            className="text-sm"
            style={{ color: "rgba(240,237,232,0.6)" }}
          >
            Hi, {name}
          </p>
          <h1
            className="mt-2 text-4xl font-light leading-tight"
            style={{ color: P.cream }}
          >
            Keep thriving, one appointment at a time
          </h1>
        </div>

        {/* Week Calendar Strip */}
        <WeekCalendarStrip />

        {/* Arc Gauges */}
        <GaugeSection items={actionItems} />

        {/* Action Cards */}
        <ActionCards
          items={actionItems}
          userId={data.appUserId}
          showCalendarNudge={false}
        />
      </div>

      {/* Bottom Tab Bar */}
      <BottomTabBar />
    </main>
  );
}

export default function DashboardV6Page() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardV6Inner />
    </Suspense>
  );
}
