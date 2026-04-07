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
  return Math.max(
    0,
    Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
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

/* ───────────────────────── Global CSS ───────────────────────── */

const globalStyles = `
@keyframes float1 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-10px) rotate(2deg); }
  66% { transform: translateY(5px) rotate(-1deg); }
}
@keyframes float2 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-14px) rotate(-1.5deg); }
  66% { transform: translateY(8px) rotate(1deg); }
}
@keyframes float3 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-8px) rotate(1deg); }
  66% { transform: translateY(12px) rotate(-2deg); }
}
@keyframes float4 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-16px) rotate(2.5deg); }
  66% { transform: translateY(4px) rotate(-0.5deg); }
}
@keyframes float5 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-6px) rotate(-1deg); }
  66% { transform: translateY(10px) rotate(1.5deg); }
}
@keyframes float6 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-12px) rotate(1.5deg); }
  66% { transform: translateY(6px) rotate(-2deg); }
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes pulse-glow-coral {
  0%, 100% { box-shadow: 0 4px 24px rgba(224,64,48,0.08); }
  50% { box-shadow: 0 4px 32px rgba(224,64,48,0.16); }
}
@keyframes pulse-glow-lime {
  0%, 100% { box-shadow: 0 4px 24px rgba(92,107,92,0.06); }
  50% { box-shadow: 0 4px 32px rgba(92,107,92,0.12); }
}
@keyframes pulse-glow-lavender {
  0%, 100% { box-shadow: 0 4px 24px rgba(144,120,200,0.08); }
  50% { box-shadow: 0 4px 32px rgba(144,120,200,0.16); }
}
@keyframes mini-orb-float {
  0%, 100% { transform: translateY(0px) translateX(0px); }
  25% { transform: translateY(-6px) translateX(3px); }
  50% { transform: translateY(-2px) translateX(-4px); }
  75% { transform: translateY(-8px) translateX(2px); }
}
@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
}
@keyframes score-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
@keyframes bubble-drift {
  0%, 100% { transform: translateY(0) translateX(0) scale(1); }
  25% { transform: translateY(-12px) translateX(5px) scale(1.02); }
  50% { transform: translateY(-4px) translateX(-6px) scale(0.98); }
  75% { transform: translateY(-15px) translateX(3px) scale(1.01); }
}
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

/* ───────────────────────── Floating Soap Bubbles ───────────────────────── */

const bubbleConfigs = [
  {
    size: 140,
    top: "6%",
    left: "72%",
    anim: "float1 8s ease-in-out infinite",
    delay: "0s",
  },
  {
    size: 80,
    top: "14%",
    left: "4%",
    anim: "float2 10s ease-in-out infinite",
    delay: "-2s",
  },
  {
    size: 55,
    top: "38%",
    left: "88%",
    anim: "float3 12s ease-in-out infinite",
    delay: "-4s",
  },
  {
    size: 100,
    top: "58%",
    left: "-2%",
    anim: "float4 6s ease-in-out infinite",
    delay: "-1s",
  },
  {
    size: 45,
    top: "75%",
    left: "78%",
    anim: "float5 9s ease-in-out infinite",
    delay: "-3s",
  },
  {
    size: 70,
    top: "90%",
    left: "28%",
    anim: "float6 11s ease-in-out infinite",
    delay: "-5s",
  },
];

function FloatingBubbles() {
  return (
    <>
      {bubbleConfigs.map((b, i) => (
        <div
          key={i}
          className="pointer-events-none absolute"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%,
              rgba(255,255,255,0.8) 0%,
              rgba(176,212,240,0.3) 20%,
              rgba(144,120,200,0.2) 40%,
              rgba(226,240,160,0.15) 60%,
              rgba(224,64,48,0.1) 80%,
              transparent 100%)`,
            boxShadow: `
              inset -6px -6px 15px rgba(0,0,0,0.05),
              inset 3px 3px 10px rgba(255,255,255,0.9),
              0 10px 40px rgba(144,120,200,0.1)`,
            border: "1px solid rgba(255,255,255,0.6)",
            animation: b.anim,
            animationDelay: b.delay,
            zIndex: 1,
          }}
        />
      ))}
    </>
  );
}

/* ───────────────────────── QB Logo (Overlapping Circles) ───────────────────────── */

function QBLogo() {
  const colors = [P.skyBlue, P.lavender, P.lime, P.coral];
  return (
    <div className="relative" style={{ width: 36, height: 24 }}>
      {colors.map((c, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 16,
            height: 16,
            top: i < 2 ? 0 : 8,
            left: i % 2 === 0 ? 0 : 10,
            background: `radial-gradient(circle, ${c}CC, ${c}33)`,
            border: `1px solid ${c}55`,
          }}
        />
      ))}
    </div>
  );
}

/* ───────────────────────── Week Calendar Strip ───────────────────────── */

function WeekStrip() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div
      className="mx-4 mt-4 overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
        border: "1px solid rgba(255,255,255,0.7)",
        borderRadius: 20,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-center justify-around px-2 py-3">
        {days.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1"
              style={{ minWidth: 36 }}
            >
              <span
                className="text-[10px] font-medium uppercase"
                style={{ color: isToday ? P.olive : `${P.navy}60` }}
              >
                {dayLabels[i]}
              </span>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                style={
                  isToday
                    ? {
                        background: P.olive,
                        color: P.cream,
                        boxShadow: `0 2px 12px ${P.olive}40`,
                      }
                    : {
                        color: P.navy,
                      }
                }
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Hero Orb with Full Ring Arc Gauge ───────────────────────── */

function HeroOrbWithGauge({ items }: { items: ActionItem[] }) {
  const total = items.length || 1;
  const overdueCount = items.filter((i) => i.type === "overdue").length;
  const upcomingCount = items.filter((i) => i.type === "upcoming").length;
  const inProgressCount = items.filter((i) => i.type === "in-progress").length;
  const upToDateCount = items.filter((i) => i.type === "up-to-date").length;

  const goodCount = upToDateCount + upcomingCount;
  const careScore = Math.round((goodCount / total) * 100);

  // Arc segments as fractions for a full 360 ring
  const segments = [
    { fraction: upToDateCount / total, color: P.olive },
    { fraction: upcomingCount / total, color: P.skyBlue },
    { fraction: inProgressCount / total, color: P.lavender },
    { fraction: overdueCount / total, color: P.coral },
  ].filter((s) => s.fraction > 0);

  const orbSize = 220;
  const ringSize = orbSize + 48;
  const svgSize = ringSize + 16;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r = ringSize / 2 - 8;
  const circumference = 2 * Math.PI * r;

  // Build stroke dash segments
  let cumulativeOffset = 0;
  const segmentElements = segments.map((seg, i) => {
    const len = seg.fraction * circumference;
    const gap = circumference - len;
    const offset = -cumulativeOffset;
    cumulativeOffset += len;
    return (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${len - 4} ${gap + 4}`}
        strokeDashoffset={offset}
        opacity={0.7}
        style={{
          filter: `drop-shadow(0 0 6px ${seg.color}40)`,
          transform: "rotate(-90deg)",
          transformOrigin: `${cx}px ${cy}px`,
        }}
      />
    );
  });

  return (
    <div className="relative mx-auto mt-8 mb-2 flex items-center justify-center"
      style={{ width: svgSize, height: svgSize }}
    >
      {/* Arc gauge ring */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="absolute inset-0"
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={6}
        />
        {segmentElements}
      </svg>

      {/* The giant iridescent orb */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          width: orbSize,
          height: orbSize,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%,
            rgba(255,255,255,0.95) 0%,
            rgba(176,212,240,0.4) 25%,
            rgba(144,120,200,0.3) 45%,
            rgba(226,240,160,0.2) 65%,
            rgba(240,237,232,0.3) 100%)`,
          boxShadow: `
            inset -10px -10px 30px rgba(0,0,0,0.05),
            inset 5px 5px 20px rgba(255,255,255,0.8),
            0 20px 60px rgba(144,120,200,0.15),
            0 5px 15px rgba(0,0,0,0.08)`,
          border: "1px solid rgba(255,255,255,0.7)",
          animation: "score-pulse 6s ease-in-out infinite",
        }}
      >
        {/* Glass highlight */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            top: 20,
            left: 40,
            width: 70,
            height: 40,
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, transparent 100%)",
            transform: "rotate(-15deg)",
            filter: "blur(5px)",
          }}
        />
        <div className="relative flex flex-col items-center">
          <span
            className="text-6xl font-extralight tracking-tight"
            style={{ color: P.navy }}
          >
            {careScore}
          </span>
          <span
            className="mt-1 text-[10px] uppercase tracking-[0.2em] font-medium"
            style={{ color: `${P.navy}70` }}
          >
            Care Score
          </span>
        </div>
      </div>

      {/* Tiny floating bubbles near the orb */}
      {[
        { size: 18, top: "10%", left: "5%", delay: "0s" },
        { size: 12, top: "80%", left: "85%", delay: "-1.5s" },
        { size: 22, top: "65%", left: "2%", delay: "-3s" },
      ].map((b, i) => (
        <div
          key={i}
          className="pointer-events-none absolute"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%,
              rgba(255,255,255,0.9) 0%,
              rgba(176,212,240,0.3) 40%,
              transparent 100%)`,
            border: "1px solid rgba(255,255,255,0.5)",
            boxShadow: "inset 1px 1px 4px rgba(255,255,255,0.8)",
            animation: `bubble-drift ${4 + i * 2}s ease-in-out infinite`,
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
}

/* ───────────────────────── Frosted White Glass Card ───────────────────────── */

function GlassCard({
  children,
  accentColor,
  glowType,
  className = "",
}: {
  children: React.ReactNode;
  accentColor?: string;
  glowType?: "coral" | "lime" | "lavender" | "none";
  className?: string;
}) {
  const glowAnim =
    glowType === "coral"
      ? "pulse-glow-coral 3s ease-in-out infinite"
      : glowType === "lime"
        ? "pulse-glow-lime 3s ease-in-out infinite"
        : glowType === "lavender"
          ? "pulse-glow-lavender 3s ease-in-out infinite"
          : "none";

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius: 24,
        background: "rgba(255, 255, 255, 0.55)",
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
        border: "1px solid rgba(255, 255, 255, 0.7)",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.06)",
        animation: glowAnim,
      }}
    >
      {/* Colored left accent bar */}
      {accentColor && (
        <div
          className="absolute left-0 top-4 bottom-4"
          style={{
            width: 3,
            borderRadius: 3,
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}40`,
          }}
        />
      )}
      {children}
    </div>
  );
}

/* ───────────────────────── Glass Pill ───────────────────────── */

function GlassPill({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: color,
          boxShadow: `0 0 4px ${color}80`,
        }}
      />
      {children}
    </span>
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
    <GlassCard accentColor={P.coral} glowType="coral">
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-medium"
              style={{ color: P.navy }}
            >
              {snapshot.provider.name}
            </h3>
            <p
              className="mt-1.5 text-sm"
              style={{ color: `${P.navy}70` }}
            >
              {detail}
            </p>
          </div>
          <GlassPill color={P.coral}>Overdue</GlassPill>
        </div>
        <div className="mt-4">
          <HandleItButton
            userId={userId}
            providerId={snapshot.provider.id}
            providerName={snapshot.provider.name}
            phoneNumber={snapshot.provider.phone}
            label={`Book with ${firstName}`}
          />
        </div>
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
    <GlassCard accentColor={P.olive} glowType="lime">
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-medium"
              style={{ color: P.navy }}
            >
              {snapshot.provider.name}
            </h3>
            <p
              className="mt-1.5 text-base font-medium"
              style={{ color: `${P.navy}B0` }}
            >
              {detail}
            </p>
          </div>
          <GlassPill color={P.olive}>Upcoming</GlassPill>
        </div>
      </div>
    </GlassCard>
  );
}

function InProgressCard({ snapshot }: { snapshot: Snapshot }) {
  return (
    <GlassCard accentColor={P.lavender} glowType="lavender">
      <div className="relative p-5 pl-6">
        {/* Floating mini-orb */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: 12,
            right: 16,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%,
              rgba(144,120,200,0.6) 0%,
              rgba(144,120,200,0.2) 60%,
              transparent 100%)`,
            boxShadow: `0 0 10px rgba(144,120,200,0.3),
              inset -2px -2px 4px rgba(0,0,0,0.1),
              inset 1px 1px 3px rgba(255,255,255,0.5)`,
            animation: "mini-orb-float 3s ease-in-out infinite",
          }}
        />
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-medium"
              style={{ color: P.navy }}
            >
              {snapshot.provider.name}
            </h3>
            <div className="mt-2 flex items-center gap-2">
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
              <span className="text-sm" style={{ color: P.lavender }}>
                Kate is working on this
              </span>
            </div>
          </div>
          <GlassPill color={P.lavender}>In progress</GlassPill>
        </div>
      </div>
    </GlassCard>
  );
}

function UpToDateCard({ snapshot }: { snapshot: Snapshot }) {
  const detail = snapshot.lastVisitDate
    ? formatLastVisit(snapshot.lastVisitDate)
    : `${snapshot.visitCount} visit${snapshot.visitCount === 1 ? "" : "s"} on record`;

  return (
    <GlassCard>
      <div className="p-5" style={{ opacity: 0.75 }}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3
              className="text-base font-medium"
              style={{ color: `${P.navy}90` }}
            >
              {snapshot.provider.name}
            </h3>
            <p
              className="mt-1 text-sm"
              style={{ color: `${P.navy}55` }}
            >
              {detail}
            </p>
          </div>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={P.olive}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-3 flex-shrink-0"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>
    </GlassCard>
  );
}

function CalendarNudgeCard({ userId }: { userId: string }) {
  return (
    <Link
      href={`/calendar-connect?user_id=${encodeURIComponent(userId)}`}
    >
      <GlassCard>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h3
                className="text-lg font-medium"
                style={{ color: P.navy }}
              >
                Connect your calendar
              </h3>
              <p
                className="mt-1 text-sm"
                style={{ color: `${P.navy}60` }}
              >
                Smarter booking with your real schedule
              </p>
            </div>
            <span
              className="ml-4 flex-shrink-0 rounded-full px-5 py-2 text-sm font-medium"
              style={{
                background: "rgba(176,212,240,0.2)",
                color: P.navy,
                border: "1px solid rgba(176,212,240,0.4)",
                backdropFilter: "blur(10px)",
              }}
            >
              Connect
            </span>
          </div>
        </div>
      </GlassCard>
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
    <section className="mx-4 mt-8 space-y-4">
      <h2
        className="text-xs uppercase tracking-[0.2em] px-1 mb-3 font-medium"
        style={{ color: `${P.navy}45` }}
      >
        Your Providers
      </h2>
      {cards.length === 0 ? (
        <GlassCard>
          <div className="p-8 text-center">
            <p className="text-base" style={{ color: `${P.navy}60` }}>
              No providers discovered yet.
            </p>
          </div>
        </GlassCard>
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
      href: "/dashboard-v8",
      active: true,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="3" />
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
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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
      className="fixed bottom-0 left-0 right-0 z-50 w-full"
      style={{
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div className="mx-auto flex h-16 items-center justify-around px-4">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className="flex flex-col items-center gap-1 transition-colors duration-200"
            style={{
              color: tab.active ? P.olive : `${P.navy}58`,
            }}
          >
            {tab.active ? tab.icon : tab.iconInactive}
            <span className="text-[10px] font-medium tracking-wide">
              {tab.label}
            </span>
            {tab.active && (
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: P.olive,
                  boxShadow: `0 0 6px ${P.olive}, 0 0 16px ${P.olive}50`,
                  marginTop: -2,
                }}
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
        background: `linear-gradient(180deg,
          rgba(176,212,240,0.35) 0%,
          rgba(176,212,240,0.15) 20%,
          #F0EDE8 45%,
          #E8E5E0 70%,
          rgba(92,107,92,0.12) 100%)`,
      }}
    >
      <div className="space-y-6 px-4 pt-32">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse p-8"
            style={{
              borderRadius: 24,
              background: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.5)",
            }}
          >
            <div
              className="mb-4 h-5 w-1/3 rounded-full"
              style={{ background: "rgba(0,0,0,0.06)" }}
            />
            <div
              className="mb-3 h-4 w-2/3 rounded-full"
              style={{ background: "rgba(0,0,0,0.04)" }}
            />
            <div
              className="h-4 w-1/2 rounded-full"
              style={{ background: "rgba(0,0,0,0.03)" }}
            />
          </div>
        ))}
      </div>
    </main>
  );
}

/* ───────────────────── Top Bar ───────────────────── */

function TopBar({
  showCalendarConnect,
  userId,
}: {
  showCalendarConnect: boolean;
  userId: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-14 pb-2">
      <QBLogo />
      <div className="flex items-center gap-3">
        {showCalendarConnect && (
          <Link
            href={`/calendar-connect?user_id=${encodeURIComponent(userId)}`}
            className="rounded-full px-4 py-1.5 text-xs font-medium"
            style={{
              background: "rgba(176,212,240,0.2)",
              border: "1px solid rgba(176,212,240,0.35)",
              color: P.navy,
              backdropFilter: "blur(16px)",
            }}
          >
            Connect Calendar
          </Link>
        )}
        {/* Bell */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={P.navy}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.4 }}
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {/* Gear */}
        <Link href="/account">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={P.navy}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.4 }}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────── Main Dashboard ───────────────────── */

function DashboardV8Inner() {
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

  if (loading) return <LoadingSkeleton />;
  if (!data) return null;

  const name = data.userName || "there";

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden pb-24"
      style={{
        background: `linear-gradient(180deg,
          rgba(176,212,240,0.35) 0%,
          rgba(176,212,240,0.15) 20%,
          #F0EDE8 45%,
          #E8E5E0 70%,
          rgba(92,107,92,0.12) 100%)`,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

      {/* Floating Soap Bubbles */}
      <FloatingBubbles />

      {/* Content layer */}
      <div className="relative z-10">
        {/* Top Bar */}
        <TopBar
          showCalendarConnect={!data.hasGoogleCalendarConnection}
          userId={data.appUserId}
        />

        {/* Greeting */}
        <div className="px-6 mt-2">
          <p
            className="text-base"
            style={{ color: `${P.navy}70` }}
          >
            Hi, {name}
          </p>
          <h1
            className="mt-1 text-3xl font-bold"
            style={{ color: P.navy }}
          >
            Thrive, One Appointment
            <br />
            at a Time
          </h1>
        </div>

        {/* Week Calendar Strip */}
        <WeekStrip />

        {/* Hero Orb with Arc Gauge */}
        <HeroOrbWithGauge items={actionItems} />

        {/* Provider Action Cards */}
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

export default function DashboardV8Page() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardV8Inner />
    </Suspense>
  );
}
