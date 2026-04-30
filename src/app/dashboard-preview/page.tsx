"use client";

/**
 * Brand-spec sandbox preview of the dashboard. Static mock data, no API calls,
 * no auth — just the new palette + typography + voice applied to the existing
 * dashboard layout. Compare against /dashboard.
 *
 * Palette (from Refined Brand Positioning doc):
 *   Olive       #5B6347   primary brand
 *   Cream       #F2EFE9   page background / surface
 *   Midnight    #050E33   high-contrast headlines + body
 *   Pistachio   #DEEDA9   on-track / success
 *   Sky blue    #B0DAEF   info / past visit
 *   Vermilion   #E53B25   overdue / alert
 *   Purple      #8E58E0   recurring / care recipient
 */

import Link from "next/link";

const PALETTE = {
  olive: "#5B6347",
  oliveDark: "#3F4632",
  cream: "#F2EFE9",
  creamSurface: "#FBFAF6",
  midnight: "#050E33",
  midnightSoft: "#1B2247",
  pistachio: "#DEEDA9",
  pistachioDark: "#7B9320",
  skyBlue: "#B0DAEF",
  skyBlueDark: "#3A6F8C",
  vermilion: "#E53B25",
  vermilionSoft: "#FCE3DF",
  purple: "#8E58E0",
  purpleSoft: "#EDE3FB",
  textMuted: "#6B6F76",
  divider: "#E2DCD2",
};

type StatusKey = "on_track" | "overdue" | "upcoming" | "recurring" | "pharmacy";

type ProviderRow = {
  id: string;
  name: string;
  specialty: string | null;
  status: StatusKey;
};

const MOCK_PROVIDERS: ProviderRow[] = [
  { id: "1", name: "Dr. Megan Nasonson", specialty: "Primary Care", status: "upcoming" },
  { id: "2", name: "Dr. Elizabeth Seckler", specialty: "Dentist", status: "overdue" },
  { id: "3", name: "Dr. Eric Echelman", specialty: "Dermatology", status: "on_track" },
  { id: "4", name: "Dr. Patel", specialty: "Cardiology", status: "on_track" },
  { id: "5", name: "Therapy — Sarah Lin", specialty: "Mental Health", status: "recurring" },
  { id: "6", name: "CVS Pharmacy", specialty: null, status: "pharmacy" },
];

function StatusPill({ status }: { status: StatusKey }) {
  switch (status) {
    case "on_track":
      return (
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: PALETTE.pistachio, color: PALETTE.pistachioDark }}
        >
          On track
        </span>
      );
    case "overdue":
      return (
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: PALETTE.vermilionSoft, color: PALETTE.vermilion }}
        >
          Overdue
        </span>
      );
    case "upcoming":
      return (
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: PALETTE.skyBlue, color: PALETTE.skyBlueDark }}
        >
          Upcoming
        </span>
      );
    case "recurring":
      return (
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: PALETTE.purpleSoft, color: PALETTE.purple }}
        >
          Recurring
        </span>
      );
    case "pharmacy":
      return (
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: PALETTE.cream, color: PALETTE.textMuted }}
        >
          Pharmacy
        </span>
      );
  }
}

function getWeekDays() {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    days.push({
      abbrev: d.toLocaleDateString("en-US", { weekday: "short" })[0],
      date: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
    });
  }
  return days;
}

export default function DashboardPreviewPage() {
  const weekDays = getWeekDays();
  const upcomingCount = MOCK_PROVIDERS.filter((p) => p.status === "upcoming").length;
  const overdueCount = MOCK_PROVIDERS.filter((p) => p.status === "overdue").length;
  const total = MOCK_PROVIDERS.filter((p) => p.status !== "pharmacy").length;

  return (
    <main
      className="min-h-screen pb-16"
      style={{ background: PALETTE.cream, color: PALETTE.midnight }}
    >
      {/* Sandbox banner */}
      <div
        className="text-center py-2 text-xs font-semibold tracking-wide"
        style={{ background: PALETTE.midnight, color: PALETTE.cream }}
      >
        BRAND PREVIEW — sandbox at /dashboard-preview · live at /dashboard
      </div>

      {/* Top nav placeholder (visual only — not the real TopNav) */}
      <div
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{ borderColor: PALETTE.divider }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: PALETTE.olive, color: PALETTE.cream }}
          >
            QH
          </div>
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: PALETTE.midnight }}
          >
            Quarterback Health
          </span>
        </div>
        <div className="flex items-center gap-5 text-xs font-medium" style={{ color: PALETTE.textMuted }}>
          <span style={{ color: PALETTE.midnight, fontWeight: 600 }}>Dashboard</span>
          <span>Care team</span>
          <span>Visits</span>
          <span>Goals</span>
        </div>
      </div>

      <div className="relative mx-auto max-w-xl px-7">
        {/* Greeting */}
        <div className="pt-8">
          <span className="text-sm" style={{ color: PALETTE.textMuted }}>
            Hi, Jennifer
          </span>
          <h1
            className="mt-1 text-3xl font-light tracking-tight"
            style={{ color: PALETTE.midnight, fontFamily: "ui-serif, Georgia, serif" }}
          >
            Healthcare, handled.
          </h1>
        </div>

        {/* Health Coordination Score */}
        <div className="mt-8 flex flex-col items-center">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3"
            style={{ color: PALETTE.textMuted }}
          >
            Health Coordination Score
          </div>
          <div className="relative" style={{ width: 140, height: 140 }}>
            <svg width={140} height={140} viewBox="0 0 140 140" className="transform -rotate-90">
              <circle cx={70} cy={70} r={58} fill="none" stroke={PALETTE.divider} strokeWidth={7} />
              <circle
                cx={70}
                cy={70}
                r={58}
                fill="none"
                stroke={PALETTE.olive}
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={`${(72 / 100) * 2 * Math.PI * 58} ${2 * Math.PI * 58}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-light" style={{ color: PALETTE.midnight }}>72</span>
              <span
                className="text-[10px] font-bold uppercase tracking-wider mt-1"
                style={{ color: PALETTE.olive }}
              >
                On track
              </span>
            </div>
          </div>
        </div>

        {/* Kate's #1 Suggestion */}
        <div
          className="mt-8 rounded-2xl p-5 flex items-start gap-4"
          style={{
            background: PALETTE.creamSurface,
            border: `1px solid ${PALETTE.divider}`,
          }}
        >
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-base font-semibold"
            style={{ background: PALETTE.olive, color: PALETTE.cream }}
          >
            K
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: PALETTE.textMuted }}>
              From Kate
            </div>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: PALETTE.midnight }}>
              Dr. Seckler is overdue for a check-up. I'll handle the call.
            </p>
            <button
              className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: PALETTE.olive, color: PALETTE.cream }}
            >
              Let Kate book it
            </button>
          </div>
        </div>

        {/* Week Strip */}
        <div className="mt-8 flex items-center justify-center gap-1.5">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all"
              style={
                day.isToday
                  ? { background: PALETTE.olive, color: PALETTE.cream }
                  : { color: PALETTE.textMuted }
              }
            >
              <span className="text-[10px] font-medium">{day.abbrev}</span>
              <span className="text-sm font-semibold">{day.date}</span>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 flex justify-center gap-10">
          <div className="text-center">
            <div className="text-3xl font-light" style={{ color: PALETTE.midnight }}>{total}</div>
            <div
              className="text-[10px] font-semibold uppercase tracking-wider mt-1"
              style={{ color: PALETTE.textMuted }}
            >
              Care team
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-light" style={{ color: PALETTE.vermilion }}>{overdueCount}</div>
            <div
              className="text-[10px] font-semibold uppercase tracking-wider mt-1"
              style={{ color: PALETTE.textMuted }}
            >
              Overdue
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-light" style={{ color: PALETTE.skyBlueDark }}>{upcomingCount}</div>
            <div
              className="text-[10px] font-semibold uppercase tracking-wider mt-1"
              style={{ color: PALETTE.textMuted }}
            >
              Upcoming
            </div>
          </div>
        </div>

        {/* Provider list */}
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: PALETTE.textMuted }}
            >
              Your care team
            </div>
            <button
              className="text-xs font-semibold underline underline-offset-2"
              style={{ color: PALETTE.olive }}
            >
              Hand off a provider
            </button>
          </div>

          <div
            className="mt-3 rounded-2xl overflow-hidden"
            style={{
              background: PALETTE.creamSurface,
              border: `1px solid ${PALETTE.divider}`,
            }}
          >
            {MOCK_PROVIDERS.map((p, idx) => {
              const isLast = idx === MOCK_PROVIDERS.length - 1;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white"
                  style={!isLast ? { borderBottom: `1px solid ${PALETTE.divider}` } : {}}
                >
                  <div>
                    <div className="text-sm font-medium" style={{ color: PALETTE.midnight }}>
                      {p.name}
                    </div>
                    {p.specialty && (
                      <div className="text-[11px] mt-0.5" style={{ color: PALETTE.textMuted }}>
                        {p.specialty}
                      </div>
                    )}
                  </div>
                  <StatusPill status={p.status} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-12 text-center text-[11px]" style={{ color: PALETTE.textMuted }}>
          Sandbox preview. No live data.
        </div>
      </div>
    </main>
  );
}
