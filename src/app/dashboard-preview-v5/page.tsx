"use client";

/**
 * /dashboard-preview-v5 — Quarterback Health brand sandbox.
 *
 * Three view modes (toggle top-right):
 *   1. Light home — warm cream, premium feel. Approve & handle CTA.
 *   2. Dark home — deep navy, electric-blue glow. Same content.
 *   3. Provider hub — dark only. Care team | Refills segment.
 *
 * Layout (home):
 *   Header wordmark · user avatar · Kate active card · "Health,
 *   organized." hero with subtle orbit · NEXT STEP card · "Everything
 *   else is on track" status · 5-tab bottom nav (sparkle for Kate).
 *
 * Static mockup. No API calls — this is a brand/visual reference for
 * the redesign. Real /api/kate wiring stays in the live /dashboard
 * route until we promote this design.
 */

import React, { useState } from "react";
import Image from "next/image";
import { Inter, Fraunces } from "next/font/google";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
// Fraunces stands in for Austin until the licensed file is installed —
// same display-serif feel, free, drop-in.
const austin = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"] });

// ─────────────────────────────────────────────────────────────────
// Brand tokens (per spec)
// ─────────────────────────────────────────────────────────────────

const T = {
  navy: "#061225",
  navySurface: "#081A33",
  cardNavy: "#0B2545",
  electric: "#1677FF",
  royal: "#006BFF",
  glow: "#2E8CFF",
  green: "#27C46B",
  lightBg: "#FAF8F4",
  white: "#FFFFFF",
  lightBorder: "#E5EAF2",
  lightText: "#071832",
  lightMuted: "#4F5F73",
  darkText: "#FFFFFF",
  darkMuted: "#C9D6EA",
};

type Mode = "light" | "dark" | "hub";

// Theme bundle — what light/dark/hub each resolve to.
function theme(mode: Mode) {
  const dark = mode !== "light";
  return {
    bg: dark ? T.navy : T.lightBg,
    surface: dark ? T.cardNavy : T.white,
    surfaceTint: dark
      ? "rgba(46,140,255,0.08)"
      : "rgba(22,119,255,0.04)",
    border: dark ? "rgba(46,140,255,0.12)" : T.lightBorder,
    text: dark ? T.darkText : T.lightText,
    muted: dark ? T.darkMuted : T.lightMuted,
    glassBg: dark ? "rgba(11,37,69,0.65)" : "rgba(255,255,255,0.75)",
    shadow: dark
      ? "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(46,140,255,0.08)"
      : "0 4px 18px rgba(7,24,50,0.06)",
    inputBorder: dark ? "rgba(201,214,234,0.15)" : T.lightBorder,
  };
}

// ─────────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────────

export default function DashboardPreviewV5() {
  const [mode, setMode] = useState<Mode>("light");
  const [tab, setTab] = useState<NavKey>("home");
  // Hub mode is its own screen — tab nav inside hub still works visually
  // but it always shows the Provider Hub. In light/dark, the active tab
  // selects between five fully-built screens.
  const isHub = mode === "hub";
  const homeMode: Mode = isHub ? "dark" : mode;
  return (
    <div
      className={inter.className}
      style={{
        minHeight: "100vh",
        background: mode === "light" ? "#F2F0EC" : "#03060E",
        WebkitFontSmoothing: "antialiased",
        padding: "24px 16px 48px",
      }}
    >
      <ModeToggle mode={mode} setMode={setMode} />
      <PhoneFrame mode={mode}>
        {isHub ? (
          <ProviderHubScreen tab={tab} setTab={setTab} />
        ) : (
          <>
            {tab === "home" && <HomeScreen mode={homeMode} />}
            {tab === "timeline" && <TimelineScreen mode={homeMode} />}
            {tab === "insights" && <InsightsScreen mode={homeMode} />}
            {tab === "kate" && <KateScreen mode={homeMode} />}
            {tab === "you" && <YouScreen mode={homeMode} />}
            <BottomNav mode={homeMode} active={tab} setActive={setTab} />
          </>
        )}
      </PhoneFrame>
    </div>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const opts: { key: Mode; label: string }[] = [
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
    { key: "hub", label: "Hub" },
  ];
  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        right: 18,
        zIndex: 50,
        display: "flex",
        gap: 4,
        background: "rgba(7,24,50,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: 4,
        borderRadius: 999,
        border: "1px solid rgba(201,214,234,0.2)",
      }}
    >
      {opts.map((o) => {
        const active = mode === o.key;
        return (
          <button
            key={o.key}
            onClick={() => setMode(o.key)}
            style={{
              border: "none",
              background: active ? T.electric : "transparent",
              color: T.white,
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: 0.2,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function PhoneFrame({
  mode,
  children,
}: {
  mode: Mode;
  children: React.ReactNode;
}) {
  const t = theme(mode);
  return (
    <div
      style={{
        margin: "0 auto",
        width: "100%",
        maxWidth: 392,
        minHeight: 820,
        borderRadius: 44,
        background: t.bg,
        boxShadow:
          mode === "light"
            ? "0 30px 80px rgba(7,24,50,0.18), 0 0 0 8px #E0DAD0"
            : "0 30px 80px rgba(0,0,0,0.6), 0 0 0 8px #1A1F2E",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        color: t.text,
      }}
    >
      <StatusBar mode={mode} />
      {children}
    </div>
  );
}

function StatusBar({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <div
      style={{
        height: 44,
        padding: "0 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 14,
        fontWeight: 600,
        color: t.text,
        flexShrink: 0,
      }}
    >
      <span>9:41</span>
      <span style={{ display: "flex", gap: 6, opacity: 0.85, fontSize: 12 }}>
        <span>•••</span>
        <span>◐</span>
        <span>▮▮▮</span>
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Wordmark — "Quarterback Health" in Austin/Fraunces, two-tone
// ─────────────────────────────────────────────────────────────────

function Wordmark({ mode, size = 18 }: { mode: Mode; size?: number }) {
  const navyShade = mode === "light" ? T.lightText : T.darkText;
  return (
    <span
      className={austin.className}
      style={{
        fontSize: size,
        fontWeight: 500,
        letterSpacing: -0.2,
        lineHeight: 1,
      }}
    >
      <span style={{ color: navyShade }}>Quarterback</span>{" "}
      <span style={{ color: T.electric }}>Health</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// HOME SCREEN
// ─────────────────────────────────────────────────────────────────

function HomeScreen({ mode }: { mode: Mode }) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 22px 110px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <HomeHeader mode={mode} />
      <KateActiveCard mode={mode} />
      <Hero mode={mode} />
      <NextStepCard mode={mode} />
      <StatusOnTrackCard mode={mode} />
    </div>
  );
}

function HomeHeader({ mode }: { mode: Mode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 4,
      }}
    >
      <Wordmark mode={mode} size={19} />
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          overflow: "hidden",
          border: `1.5px solid ${mode === "light" ? T.lightBorder : "rgba(201,214,234,0.2)"}`,
        }}
      >
        <Image
          src="/kate-avatar.png"
          alt="You"
          width={36}
          height={36}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </div>
  );
}

function KateActiveCard({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <button
      type="button"
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: t.glassBg,
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${t.border}`,
        borderRadius: 20,
        boxShadow: t.shadow,
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            overflow: "hidden",
          }}
        >
          <Image
            src="/kate-avatar.png"
            alt="Kate"
            width={44}
            height={44}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 15,
            fontWeight: 600,
            color: t.text,
          }}
        >
          Kate is active
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: T.green,
              boxShadow: `0 0 0 3px ${
                mode === "light" ? "rgba(39,196,107,0.18)" : "rgba(39,196,107,0.25)"
              }`,
              display: "inline-block",
            }}
          />
        </div>
        <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>
          Monitoring and ready to help.
        </div>
      </div>
      <span style={{ color: t.muted, fontSize: 18, fontWeight: 300 }}>›</span>
    </button>
  );
}

function Hero({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <div
      style={{
        position: "relative",
        marginTop: 4,
        padding: "0 4px",
      }}
    >
      <h1
        className={austin.className}
        style={{
          fontSize: 38,
          fontWeight: 500,
          color: t.text,
          letterSpacing: -0.8,
          lineHeight: 1.05,
          margin: 0,
        }}
      >
        Health,
        <br />
        organized.
      </h1>
      <p
        style={{
          fontSize: 14,
          color: t.muted,
          marginTop: 10,
          lineHeight: 1.45,
          maxWidth: "70%",
        }}
      >
        Clear next steps.
        <br />
        Less to manage.
      </p>
      <Orbit mode={mode} />
    </div>
  );
}

function Orbit({ mode }: { mode: Mode }) {
  const stroke = mode === "light" ? T.electric : T.glow;
  // Small, subtle orbit — feels like a coordination motif, not a chart.
  return (
    <svg
      width={64}
      height={64}
      viewBox="0 0 64 64"
      style={{
        position: "absolute",
        top: 14,
        right: 4,
        opacity: mode === "light" ? 0.85 : 0.95,
      }}
    >
      <circle
        cx={32}
        cy={32}
        r={28}
        fill="none"
        stroke={stroke}
        strokeOpacity={0.35}
        strokeWidth={1.2}
      />
      <circle cx={60} cy={32} r={3} fill={stroke} />
      {mode !== "light" && (
        <circle
          cx={60}
          cy={32}
          r={5.5}
          fill={stroke}
          fillOpacity={0.25}
        />
      )}
    </svg>
  );
}

function NextStepCard({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <div
      style={{
        background: t.glassBg,
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${t.border}`,
        borderRadius: 22,
        padding: 18,
        boxShadow: t.shadow,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background:
              mode === "light"
                ? "rgba(22,119,255,0.10)"
                : "rgba(46,140,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <CalendarPlusIcon color={T.electric} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: t.muted,
            }}
          >
            Next Step
          </div>
          <div
            className={austin.className}
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: t.text,
              marginTop: 2,
              letterSpacing: -0.3,
              lineHeight: 1.15,
            }}
          >
            Annual physical
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: t.text,
              marginTop: 6,
              fontWeight: 500,
            }}
          >
            Dr. Smith
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: t.muted,
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CalendarSmallIcon color={t.muted} />
            May 21 at 10:00 AM
          </div>
          <p
            style={{
              fontSize: 13,
              color: t.muted,
              marginTop: 10,
              lineHeight: 1.45,
            }}
          >
            Stay on track with preventive care.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          type="button"
          style={{
            border: "none",
            background: T.electric,
            color: T.white,
            fontSize: 14.5,
            fontWeight: 600,
            padding: "13px 16px",
            borderRadius: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow:
              mode === "light"
                ? "0 6px 18px rgba(22,119,255,0.28)"
                : "0 6px 22px rgba(46,140,255,0.35)",
          }}
        >
          Approve &amp; handle <span style={{ fontSize: 16 }}>→</span>
        </button>
        <button
          type="button"
          style={{
            border: `1px solid ${t.inputBorder}`,
            background: "transparent",
            color: t.text,
            fontSize: 14.5,
            fontWeight: 600,
            padding: "12px 16px",
            borderRadius: 14,
            cursor: "pointer",
          }}
        >
          Review first
        </button>
      </div>
    </div>
  );
}

function StatusOnTrackCard({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <button
      type="button"
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        background: t.glassBg,
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        boxShadow: t.shadow,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background:
            mode === "light"
              ? "rgba(39,196,107,0.14)"
              : "rgba(39,196,107,0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <CheckIcon color={T.green} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
          Everything else is on track
        </div>
        <div style={{ fontSize: 12.5, color: t.muted, marginTop: 1 }}>
          You&rsquo;re doing great.
        </div>
      </div>
      <span style={{ color: t.muted, fontSize: 18, fontWeight: 300 }}>›</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// TIMELINE / INSIGHTS / KATE / YOU — light + dark, brand-styled
// dashboards. Calm, glass, electric-blue tile icons. No emojis,
// no chat. Each has the wordmark up top, an Austin headline, and
// content cards in the same visual language as the home page.
// ─────────────────────────────────────────────────────────────────

function ScreenHeader({
  mode,
  title,
  subtitle,
}: {
  mode: Mode;
  title: string;
  subtitle: string;
}) {
  const t = theme(mode);
  return (
    <div style={{ marginTop: 4 }}>
      <HomeHeader mode={mode} />
      <h1
        className={austin.className}
        style={{
          fontSize: 34,
          fontWeight: 500,
          color: t.text,
          letterSpacing: -0.6,
          lineHeight: 1.05,
          margin: "16px 0 6px",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 14,
          color: t.muted,
          margin: 0,
          lineHeight: 1.45,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function ScreenSectionLabel({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  const t = theme(mode);
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: t.muted,
        marginTop: 22,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function IconTile({
  mode,
  size = 40,
  children,
}: {
  mode: Mode;
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background:
          mode === "light"
            ? "rgba(22,119,255,0.10)"
            : "rgba(46,140,255,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function GlassCard({
  mode,
  children,
  onClick,
}: {
  mode: Mode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const t = theme(mode);
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      style={{
        all: onClick ? "unset" : undefined,
        cursor: onClick ? "pointer" : undefined,
        display: "flex",
        background: t.glassBg,
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        padding: "14px 16px",
        boxShadow: t.shadow,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {children}
    </Component>
  );
}

// ─── Timeline ────────────────────────────────────────────────────

function TimelineScreen({ mode }: { mode: Mode }) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 22px 110px",
      }}
    >
      <ScreenHeader
        mode={mode}
        title="Timeline."
        subtitle="Past, present, what's next."
      />

      <ScreenSectionLabel mode={mode}>This week</ScreenSectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TimelineRow
          mode={mode}
          icon={<StethoscopeIcon color={T.electric} />}
          title="Annual physical with Dr. Smith"
          sub="Wed, May 21 · 10:00 AM"
          badge="Scheduled"
          tone="good"
        />
        <TimelineRow
          mode={mode}
          icon={<LabIcon color={T.electric} />}
          title="Blood work"
          sub="Results came in this morning"
          badge="Looks normal"
          tone="good"
        />
      </div>

      <ScreenSectionLabel mode={mode}>Handled this month</ScreenSectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TimelineRow
          mode={mode}
          icon={<PillIcon color={T.electric} />}
          title="Levothyroxine refill"
          sub="Auto-managed — arrives Thursday"
          badge="Done"
          tone="muted"
        />
        <TimelineRow
          mode={mode}
          icon={<PhoneIcon color={T.electric} />}
          title="Insurance pre-auth"
          sub="Kate called Cigna for you"
          badge="Done"
          tone="muted"
        />
        <TimelineRow
          mode={mode}
          icon={<CalendarSmallIcon color={T.electric} size={20} />}
          title="Pediatric well-visit moved"
          sub="Pushed to June 4"
          badge="Done"
          tone="muted"
        />
      </div>
    </div>
  );
}

function TimelineRow({
  mode,
  icon,
  title,
  sub,
  badge,
  tone,
}: {
  mode: Mode;
  icon: React.ReactNode;
  title: string;
  sub: string;
  badge: string;
  tone: "good" | "muted";
}) {
  const t = theme(mode);
  const badgeColors = {
    good: {
      bg: mode === "light" ? "rgba(39,196,107,0.14)" : "rgba(39,196,107,0.22)",
      fg: T.green,
    },
    muted: {
      bg: mode === "light" ? "rgba(7,24,50,0.06)" : "rgba(201,214,234,0.10)",
      fg: t.muted,
    },
  }[tone];
  return (
    <GlassCard mode={mode}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
        <IconTile mode={mode}>{icon}</IconTile>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text }}>{title}</div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{sub}</div>
        </div>
        <span
          style={{
            background: badgeColors.bg,
            color: badgeColors.fg,
            fontSize: 11,
            fontWeight: 600,
            padding: "5px 10px",
            borderRadius: 999,
            flexShrink: 0,
          }}
        >
          {badge}
        </span>
      </div>
    </GlassCard>
  );
}

// ─── Insights ────────────────────────────────────────────────────

function InsightsScreen({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 22px 110px",
      }}
    >
      <ScreenHeader
        mode={mode}
        title="Insights."
        subtitle="Patterns Kate's noticing."
      />

      <ScreenSectionLabel mode={mode}>This year</ScreenSectionLabel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <MetricTile mode={mode} value="8" label="Care visits" delta="+2 vs last year" />
        <MetricTile mode={mode} value="100%" label="On-time refills" delta="6/6 this year" />
        <MetricTile mode={mode} value="3" label="Specialists added" delta="Care team grew" />
        <MetricTile mode={mode} value="14h" label="Time Kate saved" delta="≈ 2 days back" />
      </div>

      <ScreenSectionLabel mode={mode}>Trends</ScreenSectionLabel>
      <GlassCard mode={mode}>
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                Health score
              </div>
              <div style={{ fontSize: 12, color: t.muted, marginTop: 1 }}>
                Past 6 months
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span
                className={austin.className}
                style={{
                  fontSize: 26,
                  fontWeight: 500,
                  color: t.text,
                  lineHeight: 1,
                }}
              >
                86
              </span>
              <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>
                +6
              </span>
            </div>
          </div>
          <Sparkline mode={mode} />
        </div>
      </GlassCard>

      <ScreenSectionLabel mode={mode}>Coverage</ScreenSectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <CoverageRow mode={mode} label="Primary care" status="On track" tone="good" />
        <CoverageRow mode={mode} label="Dental" status="6mo overdue" tone="warn" />
        <CoverageRow mode={mode} label="Vision" status="Up to date" tone="good" />
        <CoverageRow mode={mode} label="Skin check" status="Due in 4 weeks" tone="muted" />
      </div>
    </div>
  );
}

function MetricTile({
  mode,
  value,
  label,
  delta,
}: {
  mode: Mode;
  value: string;
  label: string;
  delta: string;
}) {
  const t = theme(mode);
  return (
    <div
      style={{
        background: t.glassBg,
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: 14,
        boxShadow: t.shadow,
      }}
    >
      <div
        className={austin.className}
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: t.text,
          letterSpacing: -0.5,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: t.text,
          fontWeight: 500,
          marginTop: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{delta}</div>
    </div>
  );
}

function Sparkline({ mode }: { mode: Mode }) {
  // 6-month synthetic trend: 76 → 78 → 75 → 80 → 84 → 86
  const pts = [76, 78, 75, 80, 84, 86];
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const w = 280;
  const h = 60;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * w);
  const ys = pts.map(
    (v) => h - ((v - min) / (max - min)) * (h - 8) - 4
  );
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const area = `${path} L${w} ${h} L0 ${h} Z`;
  const stroke = mode === "light" ? T.electric : T.glow;
  const fill = mode === "light" ? "rgba(22,119,255,0.10)" : "rgba(46,140,255,0.18)";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <path d={area} fill={fill} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 3.5 : 0} fill={stroke} />
      ))}
    </svg>
  );
}

function CoverageRow({
  mode,
  label,
  status,
  tone,
}: {
  mode: Mode;
  label: string;
  status: string;
  tone: "good" | "warn" | "muted";
}) {
  const t = theme(mode);
  const colors = {
    good: T.green,
    warn: "#E08A1F",
    muted: t.muted,
  }[tone];
  const dotBg =
    tone === "good"
      ? T.green
      : tone === "warn"
      ? "#E08A1F"
      : t.muted;
  return (
    <GlassCard mode={mode}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: dotBg,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: t.text }}>
          {label}
        </div>
        <span style={{ fontSize: 12.5, color: colors, fontWeight: 600 }}>
          {status}
        </span>
      </div>
    </GlassCard>
  );
}

// ─── Kate ────────────────────────────────────────────────────────

function KateScreen({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 22px 110px",
      }}
    >
      <HomeHeader mode={mode} />

      <div
        style={{
          marginTop: 28,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ position: "relative" }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              overflow: "hidden",
              border: `2px solid ${mode === "light" ? T.white : T.cardNavy}`,
              boxShadow:
                mode === "light"
                  ? "0 12px 32px rgba(22,119,255,0.18)"
                  : "0 12px 36px rgba(46,140,255,0.35)",
            }}
          >
            <Image
              src="/kate-avatar.png"
              alt="Kate"
              width={92}
              height={92}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <span
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              width: 16,
              height: 16,
              borderRadius: 8,
              background: T.green,
              boxShadow: `0 0 0 3.5px ${mode === "light" ? T.lightBg : T.navy}`,
              display: "block",
            }}
          />
        </div>
        <h1
          className={austin.className}
          style={{
            fontSize: 32,
            fontWeight: 500,
            color: t.text,
            letterSpacing: -0.5,
            margin: "14px 0 4px",
          }}
        >
          Kate.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: t.muted,
            margin: 0,
            lineHeight: 1.45,
            maxWidth: 280,
          }}
        >
          Quietly handling things for you. Always one tap away.
        </p>
      </div>

      <ScreenSectionLabel mode={mode}>Currently handling</ScreenSectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <KateActivityRow
          mode={mode}
          icon={<CalendarSmallIcon color={T.electric} size={20} />}
          title="Booking annual physical"
          sub="Confirming May 21 with Dr. Smith's office"
          badge="In progress"
        />
        <KateActivityRow
          mode={mode}
          icon={<PillIcon color={T.electric} />}
          title="Levothyroxine refill"
          sub="CVS confirmed — pickup Thursday"
          badge="Scheduled"
        />
      </div>

      <ScreenSectionLabel mode={mode}>Handled recently</ScreenSectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <KateActivityRow
          mode={mode}
          icon={<PhoneIcon color={T.electric} />}
          title="Insurance pre-auth"
          sub="Cigna confirmed coverage for May 21"
          badge="Done"
          tone="muted"
        />
        <KateActivityRow
          mode={mode}
          icon={<DocumentIcon color={T.electric} />}
          title="Lab result review"
          sub="All values in range — no follow-up needed"
          badge="Done"
          tone="muted"
        />
      </div>

      <button
        type="button"
        style={{
          marginTop: 22,
          width: "100%",
          border: "none",
          background: T.electric,
          color: T.white,
          fontSize: 15,
          fontWeight: 600,
          padding: "14px 16px",
          borderRadius: 14,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow:
            mode === "light"
              ? "0 6px 18px rgba(22,119,255,0.28)"
              : "0 6px 22px rgba(46,140,255,0.4)",
        }}
      >
        Talk to Kate <span style={{ fontSize: 16 }}>→</span>
      </button>
    </div>
  );
}

function KateActivityRow({
  mode,
  icon,
  title,
  sub,
  badge,
  tone = "active",
}: {
  mode: Mode;
  icon: React.ReactNode;
  title: string;
  sub: string;
  badge: string;
  tone?: "active" | "muted";
}) {
  const t = theme(mode);
  const badgeBg =
    tone === "active"
      ? mode === "light"
        ? "rgba(22,119,255,0.10)"
        : "rgba(46,140,255,0.20)"
      : mode === "light"
      ? "rgba(7,24,50,0.06)"
      : "rgba(201,214,234,0.10)";
  const badgeFg = tone === "active" ? T.electric : t.muted;
  return (
    <GlassCard mode={mode}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
        <IconTile mode={mode}>{icon}</IconTile>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text }}>{title}</div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{sub}</div>
        </div>
        <span
          style={{
            background: badgeBg,
            color: badgeFg,
            fontSize: 11,
            fontWeight: 600,
            padding: "5px 10px",
            borderRadius: 999,
            flexShrink: 0,
          }}
        >
          {badge}
        </span>
      </div>
    </GlassCard>
  );
}

// ─── You ─────────────────────────────────────────────────────────

function YouScreen({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 22px 110px",
      }}
    >
      <ScreenHeader
        mode={mode}
        title="You."
        subtitle="Your account and care setup."
      />

      <ScreenSectionLabel mode={mode}>Care</ScreenSectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SettingsRow
          mode={mode}
          icon={<UsersIcon color={T.electric} />}
          title="Care recipients"
          sub="You + 2 others"
        />
        <SettingsRow
          mode={mode}
          icon={<StethoscopeIcon color={T.electric} />}
          title="Providers"
          sub="6 on your team"
        />
        <SettingsRow
          mode={mode}
          icon={<CalendarSmallIcon color={T.electric} size={20} />}
          title="Calendar"
          sub="Google · connected"
        />
        <SettingsRow
          mode={mode}
          icon={<DocumentIcon color={T.electric} />}
          title="Documents & labs"
          sub="3 recent"
        />
      </div>

      <ScreenSectionLabel mode={mode}>Account</ScreenSectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SettingsRow
          mode={mode}
          icon={<CardIcon color={T.electric} />}
          title="Plan & billing"
          sub="Family · $49/mo"
        />
        <SettingsRow
          mode={mode}
          icon={<BellIcon color={T.electric} />}
          title="Notifications"
          sub="Quiet 9pm – 7am"
        />
        <SettingsRow
          mode={mode}
          icon={<LockIcon color={T.electric} />}
          title="Privacy & data"
          sub="You control everything"
        />
      </div>

      <div
        style={{
          marginTop: 22,
          padding: 18,
          background:
            mode === "light"
              ? "rgba(22,119,255,0.06)"
              : "rgba(46,140,255,0.10)",
          border: `1px solid ${
            mode === "light" ? "rgba(22,119,255,0.16)" : "rgba(46,140,255,0.20)"
          }`,
          borderRadius: 18,
        }}
      >
        <div
          className={austin.className}
          style={{
            fontSize: 17,
            fontWeight: 500,
            color: t.text,
            letterSpacing: -0.2,
            marginBottom: 4,
          }}
        >
          Your data is yours.
        </div>
        <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.5 }}>
          QBH works for you. Nothing leaves without your say-so.
        </div>
      </div>
    </div>
  );
}

function SettingsRow({
  mode,
  icon,
  title,
  sub,
}: {
  mode: Mode;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  const t = theme(mode);
  return (
    <GlassCard mode={mode}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
        <IconTile mode={mode} size={36}>
          {icon}
        </IconTile>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text }}>{title}</div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{sub}</div>
        </div>
        <span style={{ color: t.muted, fontSize: 18, fontWeight: 300 }}>›</span>
      </div>
    </GlassCard>
  );
}

// ─── Brand-spec icons (line, electric blue) ──────────────────────

function StethoscopeIcon({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v6a5 5 0 0 0 10 0V3" />
      <path d="M5 3h2M13 3h2" />
      <path d="M10 14v3a4 4 0 0 0 8 0v-2" />
      <circle cx={18} cy={11} r={2} />
    </svg>
  );
}
function LabIcon({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v6.5L4 18a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 18l-5-8.5V3" />
      <line x1={7} y1={3} x2={17} y2={3} />
      <line x1={6.5} y1={14} x2={17.5} y2={14} />
    </svg>
  );
}
function PillIcon({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={2.5} y={8} width={19} height={8} rx={4} transform="rotate(-30 12 12)" />
      <line x1={8} y1={8} x2={14.5} y2={14.5} transform="rotate(-30 12 12)" />
    </svg>
  );
}
function PhoneIcon({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function UsersIcon({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function DocumentIcon({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1={8} y1={13} x2={16} y2={13} />
      <line x1={8} y1={17} x2={13} y2={17} />
    </svg>
  );
}
function CardIcon({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={5} width={20} height={14} rx={2.5} />
      <line x1={2} y1={10} x2={22} y2={10} />
      <line x1={6} y1={15} x2={10} y2={15} />
    </svg>
  );
}
function BellIcon({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function LockIcon({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={4} y={11} width={16} height={10} rx={2} />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// PROVIDER HUB (dark only)
// ─────────────────────────────────────────────────────────────────

function ProviderHubScreen({
  tab,
  setTab,
}: {
  tab: NavKey;
  setTab: (k: NavKey) => void;
}) {
  const t = theme("dark");
  const [seg, setSeg] = useState<"team" | "refills">("team");

  return (
    <>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 22px 110px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <Wordmark mode="dark" size={17} />
        </div>

        <h1
          className={austin.className}
          style={{
            fontSize: 36,
            fontWeight: 500,
            color: t.text,
            letterSpacing: -0.6,
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          Your care team.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: t.muted,
            marginTop: 10,
            marginBottom: 22,
            lineHeight: 1.45,
          }}
        >
          Expert support, coordinated for you.
        </p>

        <SegmentedControl seg={seg} setSeg={setSeg} />

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <ProviderCard
            initials="SS"
            tint="#E8C5B0"
            name="Dr. Sarah Smith"
            role="Primary Care"
            meta="May 21 at 10:00 AM"
            metaIcon="calendar"
            metaColor={T.green}
          />
          <ProviderCard
            initials="JL"
            tint="#C8B5E0"
            name="Dr. Jessica Lee"
            role="OB-GYN"
            meta="Jun 12"
            metaIcon="calendar"
          />
          <ProviderCard
            initials="MC"
            tint="#A6C8E8"
            name="Dr. Michael Chen"
            role="Therapist"
            meta="No upcoming visits"
            metaIcon="chat"
          />
          <ProviderCard
            initials="PP"
            tint="#E0B0BC"
            name="Dr. Priya Patel"
            role="Dermatologist"
            meta="Apr 10"
            metaIcon="calendar"
          />
        </div>
      </div>
      <BottomNav mode="dark" active={tab} setActive={setTab} />
    </>
  );
}

function SegmentedControl({
  seg,
  setSeg,
}: {
  seg: "team" | "refills";
  setSeg: (s: "team" | "refills") => void;
}) {
  return (
    <div
      style={{
        background: "rgba(11,37,69,0.7)",
        border: "1px solid rgba(46,140,255,0.15)",
        borderRadius: 14,
        padding: 4,
        display: "flex",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {(["team", "refills"] as const).map((s) => {
        const active = seg === s;
        const label = s === "team" ? "Care team" : "Refills";
        return (
          <button
            key={s}
            onClick={() => setSeg(s)}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              background: active ? T.white : "transparent",
              color: active ? T.lightText : T.darkMuted,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 200ms",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ProviderCard({
  initials,
  tint,
  name,
  role,
  meta,
  metaIcon,
  metaColor,
}: {
  initials: string;
  tint: string;
  name: string;
  role: string;
  meta: string;
  metaIcon: "calendar" | "chat";
  metaColor?: string;
}) {
  return (
    <button
      type="button"
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: "rgba(11,37,69,0.7)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: "1px solid rgba(46,140,255,0.12)",
        borderRadius: 20,
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(46,140,255,0.08)",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          background: `linear-gradient(135deg, ${tint}, ${tint}aa)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: T.lightText,
          fontSize: 17,
          fontWeight: 600,
          flexShrink: 0,
          letterSpacing: 0.5,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className={austin.className}
          style={{
            fontSize: 17,
            fontWeight: 500,
            color: T.darkText,
            letterSpacing: -0.1,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12.5, color: T.darkMuted, marginTop: 2 }}>
          {role}
        </div>
        <div
          style={{
            fontSize: 12,
            color: metaColor ?? T.darkMuted,
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: metaColor ? 600 : 400,
          }}
        >
          {metaIcon === "calendar" ? (
            <CalendarSmallIcon color={metaColor ?? T.darkMuted} />
          ) : (
            <ChatBubbleIcon color={T.darkMuted} />
          )}
          {meta}
        </div>
      </div>
      <span
        style={{
          color: T.darkMuted,
          fontSize: 18,
          fontWeight: 300,
          opacity: 0.7,
        }}
      >
        ›
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bottom navigation — Home / Timeline / Insights / Kate / You
// ─────────────────────────────────────────────────────────────────

type NavKey = "home" | "timeline" | "insights" | "kate" | "you";

function BottomNav({
  mode,
  active,
  setActive,
}: {
  mode: Mode;
  active: NavKey;
  setActive: (k: NavKey) => void;
}) {
  const t = theme(mode);
  const items: { key: NavKey; label: string; icon: React.ReactNode }[] = [
    { key: "home", label: "Home", icon: <HomeIcon /> },
    { key: "timeline", label: "Timeline", icon: <TimelineIcon /> },
    { key: "insights", label: "Insights", icon: <InsightsIcon /> },
    { key: "kate", label: "Kate", icon: <SparkleIcon /> },
    { key: "you", label: "You", icon: <PersonIcon /> },
  ];
  return (
    <nav
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background:
          mode === "light"
            ? "rgba(255,255,255,0.85)"
            : "rgba(8,26,51,0.85)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        borderTop: `1px solid ${t.border}`,
        padding: "10px 4px 28px",
        display: "flex",
      }}
    >
      {items.map((it) => {
        const isActive = it.key === active;
        const color = isActive
          ? T.electric
          : mode === "light"
          ? T.lightMuted
          : T.darkMuted;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => setActive(it.key)}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              padding: "6px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              color,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              {React.cloneElement(it.icon as React.ReactElement<{ color?: string }>, { color })}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────

function HomeIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-9z" />
    </svg>
  );
}

function TimelineIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={4} width={18} height={18} rx={3} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={2} x2={8} y2={6} />
      <line x1={16} y1={2} x2={16} y2={6} />
      <path d="M8 14h2M14 14h2M8 18h2" />
    </svg>
  );
}

function InsightsIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <line x1={4} y1={20} x2={4} y2={12} />
      <line x1={10} y1={20} x2={10} y2={6} />
      <line x1={16} y1={20} x2={16} y2={14} />
      <line x1={22} y1={20} x2={22} y2={9} />
    </svg>
  );
}

function PersonIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}

function SparkleIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M12 2 L13.6 9.6 L21 11.5 L13.6 13.4 L12 21 L10.4 13.4 L3 11.5 L10.4 9.6 Z" />
      <path d="M19 3 L19.7 5.4 L22 6 L19.7 6.6 L19 9 L18.3 6.6 L16 6 L18.3 5.4 Z" opacity={0.7} />
    </svg>
  );
}

function CalendarPlusIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={5} width={18} height={16} rx={2.5} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={3} x2={8} y2={7} />
      <line x1={16} y1={3} x2={16} y2={7} />
      <line x1={12} y1={13} x2={12} y2={18} />
      <line x1={9.5} y1={15.5} x2={14.5} y2={15.5} />
    </svg>
  );
}

function CalendarSmallIcon({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={5} width={18} height={16} rx={2.5} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={3} x2={8} y2={7} />
      <line x1={16} y1={3} x2={16} y2={7} />
    </svg>
  );
}

function ChatBubbleIcon({ color }: { color: string }) {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}
