"use client";

/**
 * Brand-spec sandbox v2 — based on the deep-blue / bone / serif-accent design
 * direction. Static, no API. Compare at /dashboard-preview-v2.
 *
 * Palette:
 *   Deep Blue     #0F2A44   headlines + primary CTA
 *   Primary Blue  #2F5DBC   links + brand accent
 *   Sky Blue      #A7C7E7   icon fills + soft info
 *   Bone          #F7F8FA   page background
 *   Soft Gray     #E6EAF0   dividers + subtle surfaces
 *   Olive (acc)   #7ABA6B   success / on track
 *   Gold (acc)    #E6C15A   warning / upcoming / attention
 *
 * Typography:
 *   Headline   Inter Semibold      (sans)
 *   Body       Inter Regular       (sans)
 *   Accent     Source Serif Semibold (serif — for elegance moments)
 */

import * as React from "react";

const C = {
  deepBlue: "#0F2A44",
  primaryBlue: "#2F5DBC",
  skyBlue: "#A7C7E7",
  skyBlueSoft: "#E8F0FA",
  bone: "#F7F8FA",
  white: "#FFFFFF",
  softGray: "#E6EAF0",
  textMuted: "#6B7280",
  textSubtle: "#9AA1AC",
  olive: "#7ABA6B",
  oliveSoft: "#E8F3E2",
  gold: "#E6C15A",
  goldSoft: "#FAF1D7",
};

const SERIF: React.CSSProperties = { fontFamily: "var(--font-source-serif), ui-serif, Georgia, serif" };
const SANS: React.CSSProperties = { fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" };

// ── Inline icon set (rounded, friendly, single stroke) ────────────────────────
function Icon({
  name,
  size = 20,
  color = "currentColor",
  strokeWidth = 1.6,
}: {
  name:
    | "heart"
    | "sparkle"
    | "user"
    | "bell"
    | "calendar"
    | "flask"
    | "users"
    | "pill"
    | "check"
    | "leaf"
    | "stars"
    | "home"
    | "clock"
    | "chat"
    | "phone"
    | "arrow"
    | "chevron";
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "heart":
      return (
        <svg {...common}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "flask":
      return (
        <svg {...common}>
          <path d="M9 3h6M10 3v7l-4 8a2 2 0 0 0 1.7 3h8.6a2 2 0 0 0 1.7-3l-4-8V3" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "pill":
      return (
        <svg {...common}>
          <path d="M10.5 20.5a4.95 4.95 0 0 1 0-7l7-7a4.95 4.95 0 0 1 7 7l-7 7a4.95 4.95 0 0 1-7 0z" />
          <path d="M8.5 8.5l7 7" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...common}>
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96c1.4 9.3-3.34 11.84-8.2 17.04z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6" />
        </svg>
      );
    case "stars":
      return (
        <svg {...common}>
          <path d="M12 3l1.9 4.6 4.6 1.9-4.6 1.9-1.9 4.6-1.9-4.6-4.6-1.9 4.6-1.9z" />
          <path d="M19 14l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      );
  }
}

// ── Orbital sphere illustration ──────────────────────────────────────────────
function Orbital({ size = 200 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <defs>
        <radialGradient id="sphere" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#3A6BB8" />
          <stop offset="50%" stopColor="#1A3D6B" />
          <stop offset="100%" stopColor="#0F2A44" />
        </radialGradient>
      </defs>
      {/* Orbits */}
      <ellipse
        cx="100"
        cy="100"
        rx="90"
        ry="35"
        stroke={C.primaryBlue}
        strokeWidth="0.8"
        opacity="0.55"
        transform="rotate(-20 100 100)"
      />
      <ellipse
        cx="100"
        cy="100"
        rx="92"
        ry="32"
        stroke={C.gold}
        strokeWidth="0.7"
        opacity="0.5"
        transform="rotate(25 100 100)"
      />
      {/* Sphere */}
      <circle cx="100" cy="100" r="42" fill="url(#sphere)" />
      <ellipse cx="86" cy="86" rx="14" ry="9" fill="#FFFFFF" opacity="0.16" />
      {/* Orbit dots */}
      <circle cx="184" cy="80" r="3.2" fill={C.gold} />
      <circle cx="20" cy="120" r="2.6" fill={C.primaryBlue} />
      <circle cx="160" cy="158" r="2.4" fill={C.skyBlue} />
      <circle cx="40" cy="60" r="2" fill={C.gold} opacity="0.7" />
    </svg>
  );
}

// ── Reusable bits ────────────────────────────────────────────────────────────
function PillarRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: C.skyBlueSoft, color: C.primaryBlue }}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color: C.deepBlue }}>{title}</div>
        <div className="text-xs leading-relaxed mt-1" style={{ color: C.textMuted }}>{body}</div>
      </div>
    </div>
  );
}

function FeelingTile({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center text-center px-4">
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: C.skyBlueSoft, color: C.primaryBlue }}
      >
        {icon}
      </div>
      <div className="text-sm font-semibold" style={{ color: C.deepBlue }}>{title}</div>
      <div className="text-[11px] mt-1.5 leading-snug" style={{ color: C.textMuted }}>{body}</div>
    </div>
  );
}

function TimelineItem({
  month,
  day,
  dotColor,
  category,
  title,
  subtitle,
  meta,
  iconBg,
  icon,
}: {
  month: string;
  day: string;
  dotColor: string;
  category: string;
  title: string;
  subtitle?: string;
  meta?: string;
  iconBg: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-8 shrink-0 text-center">
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textSubtle }}>{month}</div>
        <div className="text-base font-semibold" style={{ color: C.deepBlue }}>{day}</div>
      </div>
      <div className="pt-2 shrink-0">
        <div className="h-2.5 w-2.5 rounded-full" style={{ background: dotColor }} />
      </div>
      <div
        className="flex-1 rounded-2xl px-4 py-3 flex items-start justify-between gap-3"
        style={{ background: C.bone, border: `1px solid ${C.softGray}` }}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textSubtle }}>{category}</div>
          <div className="text-sm font-semibold mt-0.5" style={{ color: C.deepBlue }}>{title}</div>
          {subtitle && <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>{subtitle}</div>}
          {meta && <div className="text-xs mt-0.5" style={{ color: C.textSubtle }}>{meta}</div>}
        </div>
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: iconBg, color: C.primaryBlue }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function CareTeamRow({
  name,
  role,
  initial,
  bg,
  showCall = true,
}: {
  name: string;
  role: string;
  initial: string;
  bg: string;
  showCall?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
        style={{ background: bg, color: C.deepBlue }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: C.deepBlue }}>{name}</div>
        <div className="text-xs" style={{ color: C.textMuted }}>{role}</div>
      </div>
      <button
        className="h-9 w-9 rounded-full flex items-center justify-center transition hover:opacity-90"
        style={{ background: C.skyBlueSoft, color: C.primaryBlue }}
      >
        <Icon name="chat" size={16} />
      </button>
      {showCall && (
        <button
          className="h-9 w-9 rounded-full flex items-center justify-center transition hover:opacity-90"
          style={{ background: C.skyBlueSoft, color: C.primaryBlue }}
        >
          <Icon name="phone" size={16} />
        </button>
      )}
    </div>
  );
}

// ── Main composition ─────────────────────────────────────────────────────────
export default function DashboardV2Mock() {
  return (
    <main
      className="min-h-screen pb-16"
      style={{ ...SANS, background: C.bone, color: C.deepBlue }}
    >
      {/* Sandbox banner */}
      <div
        className="text-center py-2 text-xs font-semibold tracking-wide"
        style={{ background: C.deepBlue, color: C.bone }}
      >
        BRAND PREVIEW v2 — sandbox at /dashboard-preview-v2 · live at /dashboard
      </div>

      {/* Header */}
      <header
        className="px-8 py-5 flex items-center justify-between border-b"
        style={{ borderColor: C.softGray, background: C.white }}
      >
        <div className="flex items-center gap-3">
          <Orbital size={36} />
          <div>
            <div className="text-lg font-semibold tracking-tight" style={{ color: C.deepBlue }}>
              QBH
            </div>
            <div className="text-[10px]" style={{ color: C.primaryBlue }}>
              Your health. One step ahead.
            </div>
          </div>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="mx-auto max-w-7xl px-6 lg:px-10 pt-10 pb-12 grid grid-cols-1 lg:grid-cols-[1fr_minmax(360px,420px)_1fr] gap-8">
        {/* ─── LEFT: TODAY'S FOCUS ─────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col gap-8">
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3"
              style={{ color: C.primaryBlue }}
            >
              Today's focus
            </div>
            <h2
              className="text-3xl leading-[1.15] font-semibold"
              style={{ ...SERIF, color: C.deepBlue }}
            >
              One important step. That&apos;s it.
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: C.textMuted }}>
              QBH helps you stay on top of your health by showing you what matters most, in a clear and calm way.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <PillarRow
              icon={<Icon name="heart" size={18} />}
              title="Personalized"
              body="Built around you, your health, and your life."
            />
            <PillarRow
              icon={<Icon name="sparkle" size={18} />}
              title="Proactive"
              body="We help you stay ahead of what matters."
            />
            <PillarRow
              icon={<Icon name="user" size={18} />}
              title="Human"
              body="Real support. Real people. Whenever you need it."
            />
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ background: C.skyBlueSoft }}
          >
            <div className="text-2xl leading-none mb-2" style={{ color: C.primaryBlue, ...SERIF }}>
              &ldquo;
            </div>
            <p
              className="text-base leading-snug"
              style={{ ...SERIF, color: C.deepBlue }}
            >
              This app finally makes health feel simple.
            </p>
            <div className="mt-3 text-xs" style={{ color: C.textMuted }}>— QBH Member</div>
          </div>
        </aside>

        {/* ─── CENTER: PHONE-STYLE DASHBOARD ──────────────────────── */}
        <section
          className="rounded-[36px] shadow-lg overflow-hidden"
          style={{
            background: C.white,
            border: `1px solid ${C.softGray}`,
            boxShadow: "0 8px 32px rgba(15,42,68,0.07), 0 2px 8px rgba(15,42,68,0.04)",
          }}
        >
          {/* Status bar */}
          <div
            className="px-5 py-3 flex items-center justify-between text-xs font-semibold"
            style={{ color: C.deepBlue }}
          >
            <span>9:41</span>
            <div className="flex items-center gap-1.5" style={{ color: C.deepBlue }}>
              <span className="text-[10px]">●●●</span>
              <span>•</span>
              <span>📶</span>
            </div>
          </div>

          {/* App header */}
          <div className="px-6 pt-2 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Orbital size={32} />
              <span className="text-lg font-semibold tracking-tight">QBH</span>
            </div>
            <button
              className="h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: C.bone, color: C.primaryBlue }}
            >
              <Icon name="bell" size={16} />
            </button>
          </div>

          {/* Greeting */}
          <div className="px-6 pt-4">
            <div className="text-sm" style={{ color: C.textMuted }}>
              Hi, Jennifer 👋
            </div>
            <h1
              className="mt-1 text-2xl font-semibold leading-tight"
              style={{ ...SERIF, color: C.deepBlue }}
            >
              Here&apos;s what&apos;s next
            </h1>
          </div>

          {/* Top priority hero card */}
          <div className="px-6 pt-5">
            <div
              className="rounded-3xl overflow-hidden"
              style={{
                background: C.white,
                border: `1px solid ${C.softGray}`,
                boxShadow: "0 4px 20px rgba(15,42,68,0.05)",
              }}
            >
              <div className="px-5 pt-5 relative">
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: C.primaryBlue }}
                >
                  Your top priority
                </div>
                <div
                  className="mt-1.5 text-lg font-semibold leading-snug pr-20"
                  style={{ color: C.deepBlue }}
                >
                  Schedule follow-up with Dr. Smith
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: C.textMuted }}>
                  <Icon name="clock" size={14} />
                  <span>Takes ~2 min</span>
                </div>
                <div className="absolute right-3 top-3 opacity-90">
                  <Orbital size={88} />
                </div>
              </div>
              <div className="px-5 pb-5 pt-5">
                <button
                  className="w-full rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: C.deepBlue, color: C.white }}
                >
                  Schedule now
                  <Icon name="arrow" size={16} color={C.white} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

          {/* Other things to know */}
          <div className="px-6 pt-7">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: C.deepBlue }}>
                Other things to know
              </div>
              <a className="text-xs font-semibold" style={{ color: C.primaryBlue }}>
                See all
              </a>
            </div>

            <div className="flex flex-col gap-2.5">
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ background: C.bone, border: `1px solid ${C.softGray}` }}
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: C.skyBlueSoft, color: C.primaryBlue }}
                >
                  <Icon name="flask" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: C.deepBlue }}>
                    Lab results ready
                  </div>
                  <div className="text-xs" style={{ color: C.textMuted }}>
                    Blood work from May 15
                  </div>
                </div>
                <Icon name="chevron" size={16} color={C.textSubtle} />
              </div>

              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ background: C.bone, border: `1px solid ${C.softGray}` }}
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: C.oliveSoft, color: C.olive }}
                >
                  <Icon name="calendar" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: C.deepBlue }}>
                    Upcoming appointment
                  </div>
                  <div className="text-xs" style={{ color: C.textMuted }}>
                    Annual physical · May 30
                  </div>
                </div>
                <Icon name="chevron" size={16} color={C.textSubtle} />
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="px-6 pt-5">
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: C.oliveSoft, border: `1px solid ${C.olive}40` }}
            >
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: C.olive, color: C.white }}
              >
                <Icon name="check" size={16} strokeWidth={2.5} color={C.white} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: C.deepBlue }}>
                  You&apos;re 80% on top of things
                </div>
                <div className="text-xs" style={{ color: C.textMuted }}>
                  Nice work staying proactive.
                </div>
              </div>
              {/* gauge */}
              <svg width="40" height="22" viewBox="0 0 40 22" fill="none" className="shrink-0">
                <path d="M2 20 A18 18 0 0 1 38 20" stroke={C.softGray} strokeWidth="2.5" strokeLinecap="round" />
                <path d="M2 20 A18 18 0 0 1 32 7" stroke={C.olive} strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Bottom nav */}
          <div
            className="mt-7 mx-6 mb-5 rounded-2xl px-2 py-3 flex items-center justify-around"
            style={{ background: C.white, border: `1px solid ${C.softGray}` }}
          >
            {[
              { label: "Home", icon: "home", active: true },
              { label: "Timeline", icon: "clock", active: false },
              { label: "Care Team", icon: "users", active: false },
              { label: "You", icon: "user", active: false },
            ].map((tab) => (
              <div key={tab.label} className="flex flex-col items-center gap-1">
                <Icon
                  name={tab.icon as any}
                  size={20}
                  color={tab.active ? C.deepBlue : C.textSubtle}
                  strokeWidth={tab.active ? 2 : 1.6}
                />
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: tab.active ? C.deepBlue : C.textSubtle }}
                >
                  {tab.label}
                </span>
              </div>
            ))}
          </div>

          {/* Bottom indicator */}
          <div className="flex justify-center pb-3">
            <div className="h-1 w-32 rounded-full" style={{ background: C.deepBlue }} />
          </div>
        </section>

        {/* ─── RIGHT: TIMELINE + CARE TEAM ────────────────────────── */}
        <aside className="hidden lg:flex flex-col gap-6">
          {/* Timeline card */}
          <div
            className="rounded-3xl p-6"
            style={{
              background: C.white,
              border: `1px solid ${C.softGray}`,
              boxShadow: "0 4px 20px rgba(15,42,68,0.04)",
            }}
          >
            <div
              className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3"
              style={{ color: C.primaryBlue }}
            >
              Your timeline
            </div>
            {/* tabs */}
            <div
              className="flex p-1 rounded-2xl mb-5"
              style={{ background: C.bone }}
            >
              <button
                className="flex-1 py-2 text-xs font-semibold rounded-xl"
                style={{ background: C.white, color: C.deepBlue, boxShadow: "0 1px 3px rgba(15,42,68,0.08)" }}
              >
                Upcoming
              </button>
              <button className="flex-1 py-2 text-xs font-semibold" style={{ color: C.textMuted }}>
                Past
              </button>
              <button className="flex-1 py-2 text-xs font-semibold" style={{ color: C.textMuted }}>
                All
              </button>
            </div>

            <div
              className="text-[10px] font-bold uppercase tracking-wider mb-3"
              style={{ color: C.textSubtle }}
            >
              This month
            </div>
            <div className="flex flex-col gap-3">
              <TimelineItem
                month="May"
                day="16"
                dotColor={C.primaryBlue}
                category="Appointment"
                title="Dr. Smith"
                subtitle="Annual Wellness Visit"
                meta="2:00 PM"
                iconBg={C.skyBlueSoft}
                icon={<Icon name="calendar" size={18} />}
              />
              <TimelineItem
                month="May"
                day="20"
                dotColor={C.olive}
                category="Lab Work"
                title="Blood Panel"
                subtitle="Fasting"
                iconBg={C.oliveSoft}
                icon={<Icon name="flask" size={18} color={C.olive} />}
              />
              <TimelineItem
                month="May"
                day="28"
                dotColor={C.gold}
                category="Follow Up"
                title="Dr. Lee"
                subtitle="Hormone Health"
                meta="10:30 AM"
                iconBg={C.goldSoft}
                icon={<Icon name="users" size={18} color={C.gold} />}
              />
            </div>

            <div
              className="text-[10px] font-bold uppercase tracking-wider mt-6 mb-3"
              style={{ color: C.textSubtle }}
            >
              Next month
            </div>
            <div className="flex flex-col gap-3">
              <TimelineItem
                month="Jun"
                day="02"
                dotColor={C.primaryBlue}
                category="Reminder"
                title="Refill Prescription"
                subtitle="2 medications"
                iconBg={C.skyBlueSoft}
                icon={<Icon name="pill" size={18} />}
              />
            </div>

            <button
              className="mt-6 w-full rounded-2xl py-3 text-sm font-semibold"
              style={{ background: C.skyBlueSoft, color: C.primaryBlue }}
            >
              View full timeline
            </button>
          </div>

          {/* Care team card */}
          <div
            className="rounded-3xl p-6"
            style={{
              background: C.white,
              border: `1px solid ${C.softGray}`,
              boxShadow: "0 4px 20px rgba(15,42,68,0.04)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: C.primaryBlue }}
              >
                Your care team
              </div>
              <a className="text-xs font-semibold" style={{ color: C.primaryBlue }}>
                See all
              </a>
            </div>

            <div className="flex flex-col gap-4">
              <CareTeamRow name="Dr. Smith" role="Primary Care" initial="S" bg="#DCE7F5" />
              <CareTeamRow name="Sara Johnson, NP" role="Nurse Practitioner" initial="J" bg={C.oliveSoft} />
              <CareTeamRow name="Care Coordinator" role="Support Team" initial="C" bg={C.goldSoft} showCall={false} />
            </div>

            <button
              className="mt-5 w-full rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: C.skyBlueSoft, color: C.primaryBlue }}
            >
              <Icon name="chat" size={16} />
              Message your care team
            </button>
          </div>
        </aside>
      </div>

      {/* ─── HOW IT FEELS STRIP ───────────────────────────────────── */}
      <section
        className="mx-auto max-w-7xl mt-2 rounded-3xl px-8 py-8"
        style={{ background: C.white, border: `1px solid ${C.softGray}` }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.18em] mb-5"
              style={{ color: C.primaryBlue }}
            >
              How it feels
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <FeelingTile
                icon={<Icon name="heart" size={20} />}
                title="Supported"
                body="You're not alone."
              />
              <FeelingTile
                icon={<Icon name="check" size={20} strokeWidth={2.2} />}
                title="In Control"
                body="You know what to do next."
              />
              <FeelingTile
                icon={<Icon name="leaf" size={20} />}
                title="Calm"
                body="Less stress. More clarity."
              />
              <FeelingTile
                icon={<Icon name="stars" size={20} />}
                title="Confident"
                body="You've got this."
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Orbital size={140} />
            <div className="max-w-[260px]">
              <p
                className="text-lg leading-snug"
                style={{ ...SERIF, color: C.deepBlue }}
              >
                &ldquo;QBH helps me stay on top of my health so I can focus on living my life.&rdquo;
              </p>
              <div className="mt-3 text-xs" style={{ color: C.primaryBlue, fontWeight: 600 }}>
                — QBH Member
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DESIGN SYSTEM SWATCHES (for review) ──────────────────── */}
      <section className="mx-auto max-w-7xl mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 px-2">
        {/* Palette */}
        <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.softGray}` }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-4" style={{ color: C.primaryBlue }}>
            Color Palette
          </div>
          <div className="grid grid-cols-7 gap-2">
            {[
              { name: "Deep Blue", hex: C.deepBlue },
              { name: "Primary Blue", hex: C.primaryBlue },
              { name: "Sky Blue", hex: C.skyBlue },
              { name: "Bone", hex: C.bone },
              { name: "Soft Gray", hex: C.softGray },
              { name: "Olive (accent)", hex: C.olive },
              { name: "Gold (accent)", hex: C.gold },
            ].map((c) => (
              <div key={c.name} className="text-center">
                <div
                  className="aspect-square rounded-full mb-2"
                  style={{
                    background: c.hex,
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)",
                  }}
                />
                <div className="text-[9px] font-semibold leading-tight" style={{ color: C.deepBlue }}>
                  {c.name}
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: C.textMuted }}>
                  {c.hex}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.softGray}` }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-4" style={{ color: C.primaryBlue }}>
            Typography
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-3xl font-semibold" style={{ color: C.deepBlue }}>Aa</div>
              <div className="text-[10px] font-semibold mt-1" style={{ color: C.deepBlue }}>Headline</div>
              <div className="text-[9px]" style={{ color: C.textMuted }}>Inter / Semibold</div>
            </div>
            <div>
              <div className="text-3xl" style={{ color: C.deepBlue }}>Aa</div>
              <div className="text-[10px] font-semibold mt-1" style={{ color: C.deepBlue }}>Body</div>
              <div className="text-[9px]" style={{ color: C.textMuted }}>Inter / Regular</div>
            </div>
            <div>
              <div className="text-3xl" style={{ ...SERIF, color: C.deepBlue, fontWeight: 600 }}>Aa</div>
              <div className="text-[10px] font-semibold mt-1" style={{ color: C.deepBlue }}>Accent</div>
              <div className="text-[9px]" style={{ color: C.textMuted }}>Source Serif / Semibold</div>
            </div>
          </div>
        </div>

        {/* Icon style */}
        <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.softGray}` }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-4" style={{ color: C.primaryBlue }}>
            Icon Style
          </div>
          <div className="flex items-center justify-around" style={{ color: C.deepBlue }}>
            <Icon name="calendar" size={22} />
            <Icon name="flask" size={22} />
            <Icon name="pill" size={22} />
            <Icon name="chat" size={22} />
            <Icon name="user" size={22} />
          </div>
          <div className="text-[10px] text-center mt-3" style={{ color: C.textMuted }}>
            Friendly, rounded, clear
          </div>
        </div>
      </section>
    </main>
  );
}
