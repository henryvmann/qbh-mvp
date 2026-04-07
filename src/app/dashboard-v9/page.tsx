"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0)
    return `Today at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (diffDays === 1)
    return `Tomorrow at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (diffDays > 1 && diffDays <= 7)
    return `${d.toLocaleDateString([], { weekday: "long" })} at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  bg: "linear-gradient(150deg, #2E3830 0%, #343C34 40%, #3A4238 100%)",
  glass: "rgba(255, 255, 255, 0.07)",
  glassBorder: "rgba(255, 255, 255, 0.10)",
  glassBlur: "blur(20px)",
  cream: "#F0EDE8",
  orange: "#E08850",
  olive: "#5C6B5C",
  skyBlue: "#B0D4F0",
  lavender: "#9078C8",
  coral: "#E04030",
  lime: "#E2F0A0",
};

/* ───────────────────────── Animations ───────────────────────── */

const globalStyles = `
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}
`;

/* ───────────────────────── SVG Icons ───────────────────────── */

function LeafIcon({ size = 28, color = C.orange }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path
        d="M14 3C8 3 4 8 4 14c0 4 2.5 7.5 6 9.5C11 21 12 18 14 15c2 3 3 6 4 8.5C21.5 21.5 24 18 24 14c0-6-4-11-10-11z"
        fill={color}
      />
      <path
        d="M14 8v12"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M14 12c-2-1.5-4-2-5-2M14 15c2-1.5 4-2 5-2"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HomeIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#fff" : "none"} stroke={active ? "#fff" : C.cream} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.4 }}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/* ───────────────────────── Glass Card ───────────────────────── */

function GlassCard({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: C.glass,
        backdropFilter: C.glassBlur,
        WebkitBackdropFilter: C.glassBlur,
        border: `1px solid ${C.glassBorder}`,
        borderRadius: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ───────────────────────── Calendar Strip ───────────────────────── */

function CalendarStrip() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun

  const days = useMemo(() => {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const result: { label: string; date: number; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - dayOfWeek + i);
      result.push({
        label: labels[i],
        date: d.getDate(),
        isToday: i === dayOfWeek,
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GlassCard style={{ margin: "0 20px", padding: "16px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {days.map((d) => (
          <div
            key={d.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: C.cream,
                opacity: 0.5,
                marginBottom: 6,
                fontWeight: 500,
              }}
            >
              {d.label}
            </span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: d.isToday ? C.orange : "transparent",
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: d.isToday ? 700 : 500,
                  color: d.isToday ? "#fff" : C.cream,
                  opacity: d.isToday ? 1 : 0.7,
                }}
              >
                {d.date}
              </span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/* ───────────────────────── Donut Chart ───────────────────────── */

type DonutData = {
  overduePercent: number;
  upcomingPercent: number;
  inProgressPercent: number;
  upToDatePercent: number;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function DonutChart({ data }: { data: DonutData }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = 90;
  const strokeW = 18;
  const labelR = r + 34;
  const gap = 4; // degrees gap between segments

  const segments = [
    { key: "overdue", percent: data.overduePercent, color: C.orange, label: "Overdue" },
    { key: "upcoming", percent: data.upcomingPercent, color: C.skyBlue, label: "Upcoming" },
    { key: "inProgress", percent: data.inProgressPercent, color: C.lavender, label: "In progress" },
    { key: "upToDate", percent: data.upToDatePercent, color: C.olive, label: "Up to date" },
  ].filter((s) => s.percent > 0);

  const totalGap = segments.length * gap;
  const usableDegrees = 360 - totalGap;

  let currentAngle = 0;
  const arcs: {
    key: string;
    path: string;
    color: string;
    label: string;
    percent: number;
    midAngle: number;
  }[] = [];

  for (const seg of segments) {
    const sweep = (seg.percent / 100) * usableDegrees;
    const startAngle = currentAngle + gap / 2;
    const endAngle = startAngle + sweep;
    const midAngle = startAngle + sweep / 2;
    arcs.push({
      key: seg.key,
      path: describeArc(cx, cy, r, startAngle, endAngle),
      color: seg.color,
      label: seg.label,
      percent: seg.percent,
      midAngle,
    });
    currentAngle = endAngle + gap / 2;
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 16, position: "relative" }}>
      <svg width={size + 80} height={size + 80} viewBox={`-40 -40 ${size + 80} ${size + 80}`}>
        {/* Background track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeW} />
        {/* Segments */}
        {arcs.map((arc) => (
          <path
            key={arc.key}
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
        ))}
        {/* Center glass circle with leaf */}
        <circle cx={cx} cy={cy} r={30} fill="rgba(46,56,48,0.85)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* Leaf icon in center */}
        <g transform={`translate(${cx - 12}, ${cy - 12})`}>
          <path
            d="M12 2C7 2 3.5 6.5 3.5 12c0 3.5 2 6.5 5 8C9.2 18 10 15.5 12 13c2 2.5 2.8 5 3.5 7 3-1.5 5-4.5 5-8C20.5 6.5 17 2 12 2z"
            fill={C.orange}
          />
        </g>
        {/* Labels outside ring */}
        {arcs.map((arc) => {
          const pos = polarToCartesian(cx, cy, labelR, arc.midAngle);
          const textAnchor = pos.x > cx + 10 ? "start" : pos.x < cx - 10 ? "end" : "middle";
          return (
            <g key={arc.key + "-label"}>
              <text
                x={pos.x}
                y={pos.y - 6}
                textAnchor={textAnchor}
                fill={C.cream}
                fontSize="10"
                fontWeight="600"
                opacity="0.75"
              >
                {arc.label}
              </text>
              <text
                x={pos.x}
                y={pos.y + 8}
                textAnchor={textAnchor}
                fill={arc.color}
                fontSize="13"
                fontWeight="700"
              >
                {Math.round(arc.percent)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ───────────────────────── Provider Card ───────────────────────── */

function ProviderActionCard({
  item,
  userId,
}: {
  item: ActionItem;
  userId: string;
}) {
  const s = item.snapshot;

  const dotColor =
    item.type === "overdue"
      ? C.orange
      : item.type === "upcoming"
        ? C.olive
        : item.type === "in-progress"
          ? C.lavender
          : C.olive;

  const statusLabel =
    item.type === "overdue"
      ? "Overdue"
      : item.type === "upcoming"
        ? "Upcoming"
        : item.type === "in-progress"
          ? "In progress"
          : "Up to date";

  const statusDetail =
    item.type === "overdue" && s.lastVisitDate
      ? `Last visit ${monthsAgo(s.lastVisitDate)} months ago`
      : item.type === "upcoming" && s.futureConfirmedEvent
        ? formatRelativeDate(s.futureConfirmedEvent.start_at)
        : item.type === "upcoming" && s.booking_state.displayTime
          ? s.booking_state.displayTime
          : item.type === "in-progress"
            ? "Kate is calling"
            : s.lastVisitDate
              ? `Last visit ${monthsAgo(s.lastVisitDate)} months ago`
              : "No recent visits";

  return (
    <GlassCard style={{ padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.cream }}>
            {s.provider.name}
          </div>
          <div style={{ fontSize: 13, color: C.cream, opacity: 0.55, marginTop: 4 }}>
            {statusDetail}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: dotColor,
                display: "inline-block",
                animation: item.type === "in-progress" ? "pulse-dot 2s ease-in-out infinite" : undefined,
              }}
            />
            <span style={{ fontSize: 12, color: C.cream, opacity: 0.7, fontWeight: 500 }}>
              {statusLabel}
            </span>
          </div>
        </div>
        {item.type === "overdue" && (
          <div style={{ marginLeft: 12, flexShrink: 0 }}>
            <HandleItButton
              userId={userId}
              providerId={s.provider.id}
              providerName={s.provider.name}
              phoneNumber={s.provider.phone}
              label="Book with Kate →"
            />
          </div>
        )}
      </div>
    </GlassCard>
  );
}

/* ───────────────────────── Tab Bar ───────────────────────── */

function TabBar() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 448,
          background: "rgba(30, 35, 30, 0.9)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "12px 0 28px 0",
        }}
      >
        {/* Home — active */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              background: C.orange,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HomeIcon active />
          </div>
        </div>
        {/* Calendar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "13px 0" }}>
          <CalendarIcon />
        </div>
        {/* Chat */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "13px 0" }}>
          <ChatIcon />
        </div>
        {/* Profile */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "13px 0" }}>
          <ProfileIcon />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Main ───────────────────────── */

function DashboardInner() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/dashboard/data")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const items = useMemo(
    () => (data ? classifySnapshots(data.snapshots) : []),
    [data]
  );

  const donutData = useMemo(() => {
    if (!data || data.snapshots.length === 0)
      return { overduePercent: 0, upcomingPercent: 0, inProgressPercent: 0, upToDatePercent: 25 };
    const total = data.snapshots.length;
    const counts = { overdue: 0, upcoming: 0, inProgress: 0, upToDate: 0 };
    for (const it of items) {
      if (it.type === "overdue") counts.overdue++;
      else if (it.type === "upcoming") counts.upcoming++;
      else if (it.type === "in-progress") counts.inProgress++;
      else counts.upToDate++;
    }
    return {
      overduePercent: (counts.overdue / total) * 100,
      upcomingPercent: (counts.upcoming / total) * 100,
      inProgressPercent: (counts.inProgress / total) * 100,
      upToDatePercent: (counts.upToDate / total) * 100,
    };
  }, [data, items]);

  const userName = data?.userName || "there";

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: `3px solid rgba(255,255,255,0.1)`,
            borderTopColor: C.orange,
            borderRadius: 20,
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: C.bg,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: 448,
        margin: "0 auto",
        paddingBottom: 100,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{globalStyles}</style>

      {/* ── Top bar ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 20px 0 20px",
        }}
      >
        <LeafIcon />
        <div style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BellIcon />
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GearIcon />
          </div>
        </div>
      </div>

      {/* ── Greeting ── */}
      <div style={{ padding: "12px 20px 0 20px" }}>
        <div style={{ fontSize: 13, color: C.cream, opacity: 0.6 }}>
          Hi, {userName}
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: C.cream,
            lineHeight: 1.2,
            marginTop: 4,
          }}
        >
          Keep thriving,
          <br />
          one appointment
          <br />
          at a time
        </div>
      </div>

      {/* ── Calendar Strip ── */}
      <div style={{ marginTop: 20 }}>
        <CalendarStrip />
      </div>

      {/* ── Health Overview (Donut) ── */}
      <div style={{ padding: "0 20px", marginTop: 24 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: C.cream,
            opacity: 0.8,
          }}
        >
          Health Overview
        </div>
        <DonutChart data={donutData} />
      </div>

      {/* ── Provider Action Cards ── */}
      <div style={{ padding: "0 20px", marginTop: 24 }}>
        {items.map((item) => (
          <ProviderActionCard
            key={item.snapshot.provider.id}
            item={item}
            userId={data?.appUserId || ""}
          />
        ))}
      </div>

      {/* ── Tab Bar ── */}
      <TabBar />
    </div>
  );
}

export default function DashboardV9Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100dvh",
            background: C.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ color: C.cream, opacity: 0.5 }}>Loading...</div>
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
