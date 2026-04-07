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
  0%, 100% { box-shadow: 0 0 20px rgba(224,64,48,0.08), 0 0 60px rgba(224,64,48,0.04); }
  50% { box-shadow: 0 0 30px rgba(224,64,48,0.15), 0 0 80px rgba(224,64,48,0.08); }
}
@keyframes pulse-glow-lime {
  0%, 100% { box-shadow: 0 0 20px rgba(226,240,160,0.06), 0 0 60px rgba(226,240,160,0.03); }
  50% { box-shadow: 0 0 30px rgba(226,240,160,0.12), 0 0 80px rgba(226,240,160,0.06); }
}
@keyframes pulse-glow-lavender {
  0%, 100% { box-shadow: 0 0 20px rgba(144,120,200,0.08), 0 0 60px rgba(144,120,200,0.04); }
  50% { box-shadow: 0 0 30px rgba(144,120,200,0.15), 0 0 80px rgba(144,120,200,0.08); }
}
@keyframes mini-orb-float {
  0%, 100% { transform: translateY(0px) translateX(0px); }
  25% { transform: translateY(-6px) translateX(3px); }
  50% { transform: translateY(-2px) translateX(-4px); }
  75% { transform: translateY(-8px) translateX(2px); }
}
@keyframes border-rotate {
  0% { --angle: 0deg; }
  100% { --angle: 360deg; }
}
@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
}
@keyframes score-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

/* ───────────────────────── Floating 3D Orbs ───────────────────────── */

const orbConfigs = [
  {
    size: 180,
    top: "5%",
    left: "70%",
    gradient: `radial-gradient(circle at 30% 30%,
      rgba(176,212,240,0.6) 0%,
      rgba(144,120,200,0.3) 40%,
      rgba(92,107,92,0.2) 70%,
      transparent 100%)`,
    shadow: `inset -8px -8px 20px rgba(0,0,0,0.3),
      inset 4px 4px 15px rgba(255,255,255,0.15),
      0 20px 60px rgba(144,120,200,0.15)`,
    anim: "float1 8s ease-in-out infinite",
    delay: "0s",
  },
  {
    size: 100,
    top: "12%",
    left: "5%",
    gradient: `radial-gradient(circle at 35% 25%,
      rgba(226,240,160,0.5) 0%,
      rgba(92,107,92,0.3) 40%,
      rgba(26,29,46,0.2) 70%,
      transparent 100%)`,
    shadow: `inset -6px -6px 16px rgba(0,0,0,0.35),
      inset 3px 3px 12px rgba(255,255,255,0.12),
      0 15px 50px rgba(226,240,160,0.1)`,
    anim: "float2 10s ease-in-out infinite",
    delay: "-2s",
  },
  {
    size: 70,
    top: "35%",
    left: "85%",
    gradient: `radial-gradient(circle at 25% 30%,
      rgba(224,64,48,0.4) 0%,
      rgba(144,120,200,0.25) 45%,
      rgba(26,29,46,0.15) 70%,
      transparent 100%)`,
    shadow: `inset -5px -5px 14px rgba(0,0,0,0.3),
      inset 2px 2px 10px rgba(255,255,255,0.1),
      0 12px 40px rgba(224,64,48,0.08)`,
    anim: "float3 12s ease-in-out infinite",
    delay: "-4s",
  },
  {
    size: 120,
    top: "55%",
    left: "-3%",
    gradient: `radial-gradient(circle at 30% 25%,
      rgba(144,120,200,0.55) 0%,
      rgba(176,212,240,0.25) 40%,
      rgba(92,107,92,0.15) 70%,
      transparent 100%)`,
    shadow: `inset -7px -7px 18px rgba(0,0,0,0.3),
      inset 3px 3px 13px rgba(255,255,255,0.13),
      0 18px 55px rgba(144,120,200,0.12)`,
    anim: "float4 6s ease-in-out infinite",
    delay: "-1s",
  },
  {
    size: 60,
    top: "72%",
    left: "75%",
    gradient: `radial-gradient(circle at 28% 28%,
      rgba(176,212,240,0.5) 0%,
      rgba(226,240,160,0.25) 45%,
      rgba(144,120,200,0.15) 70%,
      transparent 100%)`,
    shadow: `inset -4px -4px 12px rgba(0,0,0,0.3),
      inset 2px 2px 8px rgba(255,255,255,0.1),
      0 10px 35px rgba(176,212,240,0.1)`,
    anim: "float5 9s ease-in-out infinite",
    delay: "-3s",
  },
  {
    size: 90,
    top: "88%",
    left: "30%",
    gradient: `radial-gradient(circle at 32% 28%,
      rgba(92,107,92,0.5) 0%,
      rgba(226,240,160,0.3) 40%,
      rgba(176,212,240,0.15) 70%,
      transparent 100%)`,
    shadow: `inset -6px -6px 16px rgba(0,0,0,0.3),
      inset 3px 3px 11px rgba(255,255,255,0.12),
      0 14px 45px rgba(92,107,92,0.1)`,
    anim: "float6 11s ease-in-out infinite",
    delay: "-5s",
  },
];

function FloatingOrbs() {
  return (
    <>
      {orbConfigs.map((orb, i) => (
        <div
          key={i}
          className="pointer-events-none absolute"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            borderRadius: "50%",
            background: orb.gradient,
            boxShadow: orb.shadow,
            animation: orb.anim,
            animationDelay: orb.delay,
            zIndex: 1,
          }}
        />
      ))}
    </>
  );
}

/* ───────────────────────── Overlapping Circle Cluster ───────────────────────── */

function CircleCluster() {
  return (
    <div className="relative mx-auto" style={{ width: 160, height: 160 }}>
      <div
        className="absolute rounded-full"
        style={{
          top: 0,
          left: 16,
          width: 80,
          height: 80,
          background:
            "radial-gradient(circle, rgba(176,212,240,0.7), rgba(176,212,240,0.1))",
          filter: "blur(1px)",
          animation: "breathe 4s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: 8,
          left: 48,
          width: 80,
          height: 80,
          background:
            "radial-gradient(circle, rgba(144,120,200,0.7), rgba(144,120,200,0.1))",
          filter: "blur(1px)",
          animation: "breathe 4.5s ease-in-out infinite",
          animationDelay: "-1s",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: 40,
          left: 24,
          width: 80,
          height: 80,
          background:
            "radial-gradient(circle, rgba(226,240,160,0.6), rgba(226,240,160,0.1))",
          filter: "blur(1px)",
          animation: "breathe 5s ease-in-out infinite",
          animationDelay: "-2s",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: 32,
          left: 56,
          width: 80,
          height: 80,
          background:
            "radial-gradient(circle, rgba(224,64,48,0.5), rgba(224,64,48,0.1))",
          filter: "blur(1px)",
          animation: "breathe 4.2s ease-in-out infinite",
          animationDelay: "-3s",
        }}
      />
    </div>
  );
}

/* ───────────────────────── Care Score Orb ───────────────────────── */

function CareScoreOrb({ score }: { score: number }) {
  const color =
    score >= 70 ? P.lime : score >= 40 ? P.skyBlue : P.coral;

  return (
    <div
      className="relative mx-auto flex items-center justify-center"
      style={{
        width: 200,
        height: 200,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%,
          rgba(255,255,255,0.15) 0%,
          rgba(176,212,240,0.12) 20%,
          rgba(144,120,200,0.08) 40%,
          rgba(92,107,92,0.06) 60%,
          rgba(13,15,20,0.4) 100%)`,
        boxShadow: `
          inset -12px -12px 30px rgba(0,0,0,0.4),
          inset 6px 6px 20px rgba(255,255,255,0.1),
          0 0 60px rgba(144,120,200,0.15),
          0 0 120px rgba(176,212,240,0.08),
          0 30px 80px rgba(0,0,0,0.3)`,
        animation: "score-pulse 6s ease-in-out infinite",
      }}
    >
      {/* Inner glass highlight */}
      <div
        className="absolute rounded-full"
        style={{
          top: 15,
          left: 30,
          width: 60,
          height: 35,
          background:
            "radial-gradient(ellipse, rgba(255,255,255,0.2) 0%, transparent 100%)",
          transform: "rotate(-15deg)",
          filter: "blur(3px)",
        }}
      />
      <div className="relative flex flex-col items-center">
        <span
          className="text-6xl font-extralight tracking-tight"
          style={{ color }}
        >
          {score}
        </span>
        <span
          className="mt-1 text-xs uppercase tracking-[0.2em]"
          style={{ color: "rgba(240,237,232,0.5)" }}
        >
          Care Score
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── Iridescent Card ───────────────────────── */

function IridescentCard({
  children,
  glowType,
  className = "",
}: {
  children: React.ReactNode;
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
        borderRadius: 28,
        background: `linear-gradient(135deg,
          rgba(176,212,240,0.1),
          rgba(144,120,200,0.05),
          rgba(226,240,160,0.1),
          rgba(224,64,48,0.05))`,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: `0 0 1px rgba(176,212,240,0.3), 0 0 30px rgba(144,120,200,0.05)`,
        animation: glowAnim,
      }}
    >
      {/* Iridescent border shimmer overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: 28,
          background: `conic-gradient(from 0deg,
            rgba(176,212,240,0.15),
            rgba(144,120,200,0.1),
            rgba(226,240,160,0.12),
            rgba(224,64,48,0.08),
            rgba(176,212,240,0.15))`,
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: 1,
          opacity: 0.6,
        }}
      />
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
      className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: color,
          boxShadow: `0 0 6px ${color}80`,
        }}
      />
      {children}
    </span>
  );
}

/* ───────────────────────── 3D Arc Gauge ───────────────────────── */

function ArcGauge3D({
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
  const r = (size - 24) / 2;
  const circ = Math.PI * r;
  const clamped = Math.min(Math.max(value, 0), 100);
  const filled = (clamped / 100) * circ;

  // Position of the orb at end of arc
  const angle = Math.PI - (clamped / 100) * Math.PI;
  const cx = size / 2;
  const cy = size / 2;
  const orbX = cx + r * Math.cos(angle);
  const orbY = cy - r * Math.sin(angle);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size / 2 + 24}
        viewBox={`0 0 ${size} ${size / 2 + 24}`}
      >
        {/* Recessed track with inner shadow */}
        <defs>
          <filter id={`recess-${label.replace(/\s/g, "")}`}>
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.5)" />
            <feDropShadow dx="0" dy="-1" stdDeviation="1" floodColor="rgba(255,255,255,0.05)" />
          </filter>
          <linearGradient id={`grad-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
          <filter id={`glow-${label.replace(/\s/g, "")}`}>
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track (recessed) */}
        <path
          d={`M 12 ${cy} A ${r} ${r} 0 0 1 ${size - 12} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={12}
          strokeLinecap="round"
          filter={`url(#recess-${label.replace(/\s/g, "")})`}
        />

        {/* Filled arc with gradient glow */}
        {clamped > 0 && (
          <path
            d={`M 12 ${cy} A ${r} ${r} 0 0 1 ${size - 12} ${cy}`}
            fill="none"
            stroke={`url(#grad-${label.replace(/\s/g, "")})`}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ}`}
            filter={`url(#glow-${label.replace(/\s/g, "")})`}
            className="transition-all duration-1000"
          />
        )}

        {/* Marble orb at end of arc */}
        {clamped > 0 && (
          <>
            <circle
              cx={orbX}
              cy={orbY}
              r={8}
              fill={color}
              opacity="0.9"
            />
            <circle
              cx={orbX}
              cy={orbY}
              r={8}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1"
            />
            <circle
              cx={orbX - 2}
              cy={orbY - 2}
              r={3}
              fill="rgba(255,255,255,0.3)"
            />
          </>
        )}

        {/* Center text */}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fill={P.cream}
          fontSize={size / 4}
          fontWeight="200"
        >
          {centerText}
        </text>
      </svg>
      <span
        className="text-xs uppercase tracking-[0.15em] text-center"
        style={{ color: "rgba(240,237,232,0.45)" }}
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
  const nextValue =
    nextDays !== null ? Math.max(0, 100 - (nextDays / 30) * 100) : 0;

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

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 mt-8 pb-2">
      <IridescentCard className="min-w-[200px] flex-1 p-5 flex items-center justify-center">
        <ArcGauge3D
          value={careScore}
          label="Care Score"
          centerText={`${careScore}%`}
          color={careScore >= 70 ? P.lime : careScore >= 40 ? P.skyBlue : P.coral}
          size={160}
        />
      </IridescentCard>
      <IridescentCard className="min-w-[200px] flex-1 p-5 flex items-center justify-center">
        <ArcGauge3D
          value={nextValue}
          label="Days to Next"
          centerText={nextDays !== null ? String(nextDays) : "\u2014"}
          color={P.skyBlue}
          size={160}
        />
      </IridescentCard>
      <IridescentCard className="min-w-[200px] flex-1 p-5 flex items-center justify-center">
        <ArcGauge3D
          value={overdueValue}
          label={
            worstOverdue
              ? `Since ${worstOverdue.name}`
              : "No data"
          }
          centerText={worstOverdue ? `${worstOverdue.months}mo` : "\u2014"}
          color={P.coral}
          size={160}
        />
      </IridescentCard>
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
    <IridescentCard glowType="coral">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-medium"
              style={{ color: P.cream }}
            >
              {snapshot.provider.name}
            </h3>
            <p
              className="mt-1.5 text-sm"
              style={{ color: "rgba(240,237,232,0.55)" }}
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
    </IridescentCard>
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
    <IridescentCard glowType="lime">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-medium"
              style={{ color: P.cream }}
            >
              {snapshot.provider.name}
            </h3>
            <p
              className="mt-1.5 text-base font-medium"
              style={{ color: "rgba(240,237,232,0.75)" }}
            >
              {detail}
            </p>
          </div>
          <GlassPill color={P.lime}>Upcoming</GlassPill>
        </div>
      </div>
    </IridescentCard>
  );
}

function InProgressCard({ snapshot }: { snapshot: Snapshot }) {
  return (
    <IridescentCard glowType="lavender">
      <div className="relative p-5">
        {/* Floating mini-orb */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: 12,
            right: 16,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%,
              rgba(144,120,200,0.8) 0%,
              rgba(144,120,200,0.3) 60%,
              transparent 100%)`,
            boxShadow: `0 0 12px rgba(144,120,200,0.4),
              inset -2px -2px 4px rgba(0,0,0,0.2),
              inset 1px 1px 3px rgba(255,255,255,0.2)`,
            animation: "mini-orb-float 3s ease-in-out infinite",
          }}
        />
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-medium"
              style={{ color: P.cream }}
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
    </IridescentCard>
  );
}

function UpToDateCard({ snapshot }: { snapshot: Snapshot }) {
  const detail = snapshot.lastVisitDate
    ? formatLastVisit(snapshot.lastVisitDate)
    : `${snapshot.visitCount} visit${snapshot.visitCount === 1 ? "" : "s"} on record`;

  return (
    <IridescentCard>
      <div className="p-5" style={{ opacity: 0.7 }}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-medium"
              style={{ color: "rgba(240,237,232,0.55)" }}
            >
              {snapshot.provider.name}
            </h3>
            <p
              className="mt-1.5 text-sm"
              style={{ color: "rgba(240,237,232,0.35)" }}
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
            className="ml-3 flex-shrink-0"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>
    </IridescentCard>
  );
}

function CalendarNudgeCard({ userId }: { userId: string }) {
  return (
    <Link
      href={`/calendar-connect?user_id=${encodeURIComponent(userId)}`}
    >
      <IridescentCard>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h3
                className="text-lg font-medium"
                style={{ color: P.cream }}
              >
                Connect your calendar
              </h3>
              <p
                className="mt-1 text-sm"
                style={{ color: "rgba(240,237,232,0.5)" }}
              >
                Smarter booking with your real schedule
              </p>
            </div>
            <span
              className="ml-4 flex-shrink-0 rounded-full px-5 py-2 text-sm font-medium"
              style={{
                background: "rgba(176,212,240,0.12)",
                color: P.skyBlue,
                border: "1px solid rgba(176,212,240,0.25)",
                backdropFilter: "blur(10px)",
              }}
            >
              Connect
            </span>
          </div>
        </div>
      </IridescentCard>
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
        className="text-xs uppercase tracking-[0.2em] px-1 mb-3"
        style={{ color: "rgba(240,237,232,0.35)" }}
      >
        Your Providers
      </h2>
      {cards.length === 0 ? (
        <IridescentCard>
          <div className="p-8 text-center">
            <p
              className="text-base"
              style={{ color: "rgba(240,237,232,0.45)" }}
            >
              No providers discovered yet.
            </p>
          </div>
        </IridescentCard>
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
      href: "/dashboard-v7",
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
        background: "rgba(13, 15, 20, 0.9)",
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mx-auto flex h-16 items-center justify-around px-4">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className="flex flex-col items-center gap-1 transition-colors duration-200"
            style={{
              color: tab.active ? P.lime : "rgba(240,237,232,0.3)",
            }}
          >
            {tab.active ? tab.icon : tab.iconInactive}
            <span className="text-[10px] font-medium tracking-wide">
              {tab.label}
            </span>
            {tab.active && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: P.lime,
                  boxShadow: `0 0 8px ${P.lime}, 0 0 20px rgba(226,240,160,0.3)`,
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
        background:
          "radial-gradient(ellipse at 50% 40%, rgba(26,29,46,0.6) 0%, #0D0F14 70%)",
        backgroundColor: "#0D0F14",
      }}
    >
      <div className="space-y-6 px-4 pt-32">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse p-8"
            style={{
              borderRadius: 28,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="mb-4 h-5 w-1/3 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
            <div
              className="mb-3 h-4 w-2/3 rounded-full"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
            <div
              className="h-4 w-1/2 rounded-full"
              style={{ background: "rgba(255,255,255,0.03)" }}
            />
          </div>
        ))}
      </div>
    </main>
  );
}

/* ───────────────────── Main Dashboard ───────────────────── */

function DashboardV7Inner() {
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

  // Compute care score for the hero orb
  const careScore = useMemo(() => {
    if (!actionItems.length) return 0;
    const total = actionItems.length;
    const goodCount = actionItems.filter(
      (i) => i.type === "up-to-date" || i.type === "upcoming"
    ).length;
    return Math.round((goodCount / total) * 100);
  }, [actionItems]);

  if (loading) return <LoadingSkeleton />;
  if (!data) return null;

  const name = data.userName || "there";

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden pb-24"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, rgba(26,29,46,0.6) 0%, #0D0F14 70%)",
        backgroundColor: "#0D0F14",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

      {/* Floating 3D Orbs */}
      <FloatingOrbs />

      {/* Content layer */}
      <div className="relative z-10">
        {/* Hero Area */}
        <div className="relative pt-12 pb-4 px-6 text-center">
          {/* Overlapping circle cluster */}
          <CircleCluster />

          {/* Greeting */}
          <p
            className="mt-6 text-base"
            style={{ color: P.cream, opacity: 0.7 }}
          >
            Hi, {name}
          </p>

          {/* Holographic shimmer headline */}
          <h1
            className="mt-2 text-2xl font-light"
            style={{
              background: `linear-gradient(90deg, ${P.skyBlue}, ${P.lavender}, ${P.lime}, ${P.skyBlue})`,
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "shimmer 3s linear infinite",
            }}
          >
            Your health, visualized
          </h1>

          {/* Care Score Orb */}
          <div className="mt-8">
            <CareScoreOrb score={careScore} />
          </div>
        </div>

        {/* 3D Arc Gauges */}
        <GaugeSection items={actionItems} />

        {/* Provider Action Cards */}
        <ActionCards
          items={actionItems}
          userId={data.appUserId}
          showCalendarNudge={!data.hasGoogleCalendarConnection}
        />
      </div>

      {/* Bottom Tab Bar */}
      <BottomTabBar />
    </main>
  );
}

export default function DashboardV7Page() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardV7Inner />
    </Suspense>
  );
}
