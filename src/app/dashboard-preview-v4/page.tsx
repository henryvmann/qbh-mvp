"use client";

/**
 * /dashboard-preview-v4 — Visual treatment from the ChatGPT mockup,
 * structure from our prior discussion (Kate-as-leader at the top,
 * 3-tab bottom nav, no "What matters now" pill, no 5th tab).
 *
 * What we lifted from the mockup:
 *   - Serif headline + sans body typographic pairing
 *   - Bone/cream light surface and deep-navy dark surface
 *   - Open minimalist ring (single accent dot, no fill)
 *   - Bright blue primary CTA + outlined secondary
 *   - Sparkle iconography on Kate's surfaces
 *   - Two-stage action pattern (Approve & handle / Review first)
 *   - The four-column trust footer + tagline
 *
 * What we kept from our discussion:
 *   - Kate's avatar + line live at the TOP of every screen as the page's
 *     lead, not as a corner badge or bottom strip
 *   - Three tabs only: Today / Timeline / You
 *   - Settings/care/billing collapse under the You tab
 */

import Image from "next/image";
import { useState } from "react";

type Mode = "light" | "dark";
type Tab = "today" | "timeline" | "you";

export default function DashboardPreviewV4() {
  const [tab, setTab] = useState<Tab>("today");
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#EFEAE0",
        padding: "32px 24px 64px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        <PhoneFrameWithLabel label="LIGHT MODE" mode="light" tab={tab} setTab={setTab} />
        <PhoneFrameWithLabel label="DARK MODE" mode="dark" tab={tab} setTab={setTab} />
      </div>
      <FooterTrustRow />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Phone frame
// ─────────────────────────────────────────────────────────────────

function PhoneFrameWithLabel({
  label,
  mode,
  tab,
  setTab,
}: {
  label: string;
  mode: Mode;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 1.2,
          color: "#3A3530",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>{mode === "light" ? "☀" : "☾"}</span>
        <span>{label}</span>
      </div>
      <PhoneFrame mode={mode} tab={tab} setTab={setTab} />
    </div>
  );
}

function PhoneFrame({
  mode,
  tab,
  setTab,
}: {
  mode: Mode;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const isDark = mode === "dark";
  const phoneBg = isDark
    ? "linear-gradient(180deg, #0B1B33 0%, #0E243F 100%)"
    : "#F4ECDF";
  const textPrimary = isDark ? "#FFFFFF" : "#1A1F2A";
  const textSecondary = isDark ? "rgba(255,255,255,0.7)" : "#5A6478";
  const navy = isDark ? "#0B1B33" : "#0F2A44";
  const blue = "#2F66FF";
  const blueSoft = isDark ? "rgba(78,131,255,0.18)" : "rgba(78,131,255,0.12)";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,42,68,0.06)";
  const ringTrack = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,42,68,0.10)";
  const ringDot = isDark ? "#7AA8FF" : "#2F66FF";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 380,
        aspectRatio: "9 / 19.5",
        borderRadius: 56,
        background: "#0A0A0A",
        padding: 8,
        boxShadow: "0 30px 80px rgba(15,23,33,0.18)",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 48,
          background: phoneBg,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <StatusBar isDark={isDark} />

        {/* App header — small wordmark + Kate avatar in the corner.
            (Kate's voice still leads the page, but as the headline
            below — same as the mockup's pattern.) */}
        <div
          style={{
            padding: "4px 24px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily:
                "'Source Serif Pro', 'Georgia', 'Times New Roman', serif",
              fontSize: 17,
              fontWeight: 500,
              color: textPrimary,
              letterSpacing: -0.2,
            }}
          >
            Quarterback Health
          </span>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: isDark
                ? "0 0 0 1px rgba(255,255,255,0.16)"
                : "0 0 0 1px rgba(15,42,68,0.08)",
            }}
          >
            <Image
              src="/kate-avatar.png"
              alt="Kate"
              width={36}
              height={36}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>

        {/* Body — scrollable area, padded so the bottom nav doesn't clip */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 24px 96px",
          }}
        >
          {tab === "today" && (
            <TodayBody
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              navy={navy}
              blue={blue}
              blueSoft={blueSoft}
              cardBg={cardBg}
              cardBorder={cardBorder}
              ringTrack={ringTrack}
              ringDot={ringDot}
            />
          )}
          {tab === "timeline" && (
            <TimelineBody
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              cardBg={cardBg}
              cardBorder={cardBorder}
              blue={blue}
            />
          )}
          {tab === "you" && (
            <YouBody
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              cardBg={cardBg}
              cardBorder={cardBorder}
              blue={blue}
              blueSoft={blueSoft}
              navy={navy}
            />
          )}
        </main>

        <BottomNav
          isDark={isDark}
          tab={tab}
          setTab={setTab}
          textSecondary={textSecondary}
          blue={blue}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Status bar (cosmetic)
// ─────────────────────────────────────────────────────────────────

function StatusBar({ isDark }: { isDark: boolean }) {
  const c = isDark ? "#FFFFFF" : "#1A1F2A";
  return (
    <div
      style={{
        height: 50,
        padding: "12px 28px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 14,
        fontWeight: 600,
        color: c,
      }}
    >
      <span>9:41</span>
      <span
        style={{
          width: 90,
          height: 28,
          background: "#000",
          borderRadius: 14,
        }}
      />
      <span style={{ display: "flex", alignItems: "center", gap: 4, opacity: 0.85 }}>
        <span style={{ fontSize: 11 }}>•••</span>
        <span style={{ fontSize: 12 }}>◐</span>
        <span
          style={{
            display: "inline-block",
            width: 22,
            height: 11,
            borderRadius: 3,
            border: `1px solid ${c}`,
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 1,
              background: c,
              borderRadius: 1,
            }}
          />
        </span>
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TODAY tab body
// ─────────────────────────────────────────────────────────────────

function TodayBody({
  isDark,
  textPrimary,
  textSecondary,
  navy,
  blue,
  blueSoft,
  cardBg,
  cardBorder,
  ringTrack,
  ringDot,
}: {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  navy: string;
  blue: string;
  blueSoft: string;
  cardBg: string;
  cardBorder: string;
  ringTrack: string;
  ringDot: string;
}) {
  return (
    <>
      {/* HERO — Kate's voice as the page's lead. Serif headline = her line. */}
      <section style={{ marginTop: 8, paddingBottom: 28 }}>
        <h1
          style={{
            fontFamily:
              "'Source Serif Pro', 'Georgia', 'Times New Roman', serif",
            fontSize: 30,
            lineHeight: 1.15,
            fontWeight: 500,
            color: textPrimary,
            margin: 0,
            letterSpacing: -0.4,
          }}
        >
          You&rsquo;re in a good place.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: textSecondary,
            margin: "10px 0 0",
            lineHeight: 1.45,
          }}
        >
          Your health is steady and improving.
        </p>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontFamily:
                    "'Source Serif Pro', 'Georgia', serif",
                  fontSize: 56,
                  fontWeight: 400,
                  color: textPrimary,
                  lineHeight: 1,
                }}
              >
                82
              </span>
              <span style={{ fontSize: 18, color: "#4FBE6E", fontWeight: 600 }}>↑</span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: textSecondary,
                marginTop: 4,
              }}
            >
              +6 pts from last week
            </div>
          </div>

          <OpenRing track={ringTrack} dot={ringDot} />
        </div>
      </section>

      {/* Soft divider */}
      <div
        style={{
          height: 1,
          background: cardBorder,
          margin: "0 0 22px",
        }}
      />

      {/* PRIMARY ACTION — Kate's recommended next step.
          The "Approve & handle" / "Review first" two-stage pattern is
          the visual that makes "Handle it" feel safe rather than
          presumptuous: she's about to do it; you can stop her or tweak. */}
      <h2
        style={{
          fontFamily:
            "'Source Serif Pro', 'Georgia', serif",
          fontSize: 22,
          lineHeight: 1.25,
          fontWeight: 500,
          color: textPrimary,
          margin: 0,
          letterSpacing: -0.3,
        }}
      >
        I found one thing that
        <br />
        will keep you on track.
      </h2>
      <p
        style={{
          fontSize: 13,
          color: textSecondary,
          margin: "8px 0 16px",
          lineHeight: 1.45,
        }}
      >
        I&rsquo;ll take care of it. You stay in control.
      </p>

      <div
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 22,
          padding: 18,
          boxShadow: isDark
            ? "none"
            : "0 4px 14px rgba(15,23,33,0.04)",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: blueSoft,
              color: blue,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <CalendarIcon />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily:
                  "'Source Serif Pro', 'Georgia', serif",
                fontSize: 19,
                fontWeight: 500,
                color: textPrimary,
                lineHeight: 1.2,
              }}
            >
              Annual physical
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <span style={{ fontSize: 13, color: textSecondary }}>
                Dr. Smith
              </span>
              <RecBadge blue={blue} blueSoft={blueSoft} />
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 12,
            color: textSecondary,
          }}
        >
          <SmallCalIcon />
          <span>Next available: May 21 at 10:00 AM</span>
        </div>

        <p
          style={{
            fontSize: 13,
            color: textSecondary,
            margin: "12px 0 0",
            lineHeight: 1.5,
          }}
        >
          Helps catch issues early and keeps you ahead.
        </p>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            style={{
              height: 48,
              borderRadius: 14,
              background: isDark ? blue : navy,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            Approve & handle
            <SparkleIcon />
          </button>
          <button
            style={{
              height: 46,
              borderRadius: 14,
              background: "transparent",
              color: textPrimary,
              fontSize: 14,
              fontWeight: 600,
              border: `1px solid ${cardBorder}`,
              cursor: "pointer",
            }}
          >
            Review first
          </button>
        </div>
      </div>

      {/* "Everything else is on track" — calm reassurance row */}
      <button
        style={{
          marginTop: 14,
          width: "100%",
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 16,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            background: "rgba(79,190,110,0.16)",
            color: "#4FBE6E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <CheckIcon />
        </div>
        <div style={{ textAlign: "left", flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
            Everything else is on track
          </div>
          <div style={{ fontSize: 12, color: textSecondary, marginTop: 1 }}>
            I&rsquo;m monitoring 12 areas of your care.
          </div>
        </div>
        <span style={{ color: textSecondary, fontSize: 18 }}>›</span>
      </button>
    </>
  );
}

function OpenRing({ track, dot }: { track: string; dot: string }) {
  // Open ring with a single accent dot on the perimeter — the
  // mockup's most distinctive visual. No filled progress arc.
  const size = 132;
  const r = 58;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="ringGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor={dot} stopOpacity={0.0} />
          <stop offset="80%" stopColor={dot} stopOpacity={0.05} />
          <stop offset="100%" stopColor={dot} stopOpacity={0.0} />
        </radialGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r + 4} fill="url(#ringGlow)" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={track}
        strokeWidth={2.2}
      />
      <circle cx={size / 2 + r} cy={size / 2} r={5.5} fill={dot} />
    </svg>
  );
}

function RecBadge({ blue, blueSoft }: { blue: string; blueSoft: string }) {
  return (
    <span
      style={{
        background: blueSoft,
        color: blue,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
      }}
    >
      Recommended
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// TIMELINE tab body
// ─────────────────────────────────────────────────────────────────

function TimelineBody({
  textPrimary,
  textSecondary,
  cardBg,
  cardBorder,
  blue,
}: {
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  cardBorder: string;
  blue: string;
}) {
  return (
    <>
      <h1
        style={{
          fontFamily:
            "'Source Serif Pro', 'Georgia', serif",
          fontSize: 28,
          fontWeight: 500,
          color: textPrimary,
          letterSpacing: -0.3,
          margin: "8px 0 6px",
        }}
      >
        You stayed steady this week.
      </h1>
      <p style={{ fontSize: 13, color: textSecondary, margin: "0 0 22px" }}>
        Two things landed without you thinking about them.
      </p>

      <SectionTitle textSecondary={textSecondary}>This week</SectionTitle>
      <TimelineRow
        icon={<DocIcon />}
        title="Dr. Echelman annual"
        sub="Wed, May 21 · 2:00 PM"
        badge="Scheduled"
        badgeColor="#4FBE6E"
        cardBg={cardBg}
        cardBorder={cardBorder}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
      />
      <TimelineRow
        icon={<LabIcon />}
        title="Blood work"
        sub="Results came in this morning"
        badge="Looks normal"
        badgeColor="#4FBE6E"
        cardBg={cardBg}
        cardBorder={cardBorder}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
      />

      <SectionTitle textSecondary={textSecondary}>Handled this month</SectionTitle>
      <TimelineRow
        icon={<RxIcon />}
        title="Levothyroxine refill"
        sub="Auto-managed — arrives Thursday"
        badge="Done"
        badgeColor={blue}
        cardBg={cardBg}
        cardBorder={cardBorder}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        muted
      />
      <TimelineRow
        icon={<PhoneIcon />}
        title="Insurance pre-auth follow-up"
        sub="I called Cigna for you"
        badge="Done"
        badgeColor={blue}
        cardBg={cardBg}
        cardBorder={cardBorder}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        muted
      />
    </>
  );
}

function TimelineRow({
  icon,
  title,
  sub,
  badge,
  badgeColor,
  cardBg,
  cardBorder,
  textPrimary,
  textSecondary,
  muted = false,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  badge: string;
  badgeColor: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 16,
        padding: 14,
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: muted ? 0.85 : 1,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: "rgba(47,102,255,0.10)",
          color: "#2F66FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{title}</div>
        <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>{sub}</div>
      </div>
      <span
        style={{
          background: badgeColor + "22",
          color: badgeColor,
          fontSize: 11,
          fontWeight: 600,
          padding: "4px 9px",
          borderRadius: 999,
          flexShrink: 0,
        }}
      >
        {badge}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// YOU tab body
// ─────────────────────────────────────────────────────────────────

function YouBody({
  textPrimary,
  textSecondary,
  cardBg,
  cardBorder,
  blue,
  blueSoft,
  navy,
}: {
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  cardBorder: string;
  blue: string;
  blueSoft: string;
  navy: string;
}) {
  return (
    <>
      <h1
        style={{
          fontFamily:
            "'Source Serif Pro', 'Georgia', serif",
          fontSize: 28,
          fontWeight: 500,
          color: textPrimary,
          letterSpacing: -0.3,
          margin: "8px 0 6px",
        }}
      >
        You&rsquo;re set up well.
      </h1>
      <p style={{ fontSize: 13, color: textSecondary, margin: "0 0 22px" }}>
        Nothing here needs your attention.
      </p>

      <SectionTitle textSecondary={textSecondary}>Care</SectionTitle>
      <SettingRow icon={<PeopleIcon />} title="Care recipients" sub="You + 2 others" cardBg={cardBg} cardBorder={cardBorder} textPrimary={textPrimary} textSecondary={textSecondary} blueSoft={blueSoft} blue={blue} />
      <SettingRow icon={<DocIcon />} title="Providers" sub="6 on your team" cardBg={cardBg} cardBorder={cardBorder} textPrimary={textPrimary} textSecondary={textSecondary} blueSoft={blueSoft} blue={blue} />
      <SettingRow icon={<CalendarIcon />} title="Calendar" sub="Google · connected" cardBg={cardBg} cardBorder={cardBorder} textPrimary={textPrimary} textSecondary={textSecondary} blueSoft={blueSoft} blue={blue} />

      <SectionTitle textSecondary={textSecondary}>Account</SectionTitle>
      <SettingRow icon={<CardIcon />} title="Plan & billing" sub="Family · $49/mo" cardBg={cardBg} cardBorder={cardBorder} textPrimary={textPrimary} textSecondary={textSecondary} blueSoft={blueSoft} blue={blue} />
      <SettingRow icon={<BellIcon />} title="Notifications" sub="Quiet 9pm – 7am" cardBg={cardBg} cardBorder={cardBorder} textPrimary={textPrimary} textSecondary={textSecondary} blueSoft={blueSoft} blue={blue} />
      <SettingRow icon={<LockIcon />} title="Privacy & data" sub="You control everything" cardBg={cardBg} cardBorder={cardBorder} textPrimary={textPrimary} textSecondary={textSecondary} blueSoft={blueSoft} blue={blue} />

      <div
        style={{
          marginTop: 22,
          background: blueSoft,
          borderRadius: 18,
          padding: 18,
        }}
      >
        <div
          style={{
            fontFamily:
              "'Source Serif Pro', 'Georgia', serif",
            fontSize: 18,
            fontWeight: 500,
            color: navy,
            marginBottom: 4,
          }}
        >
          Your data is yours.
        </div>
        <div style={{ fontSize: 13, color: textSecondary, lineHeight: 1.5 }}>
          QBH works for you. Nothing leaves without your say-so.
        </div>
      </div>
    </>
  );
}

function SettingRow({
  icon,
  title,
  sub,
  cardBg,
  cardBorder,
  textPrimary,
  textSecondary,
  blueSoft,
  blue,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  blueSoft: string;
  blue: string;
}) {
  return (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 14,
        padding: "12px 14px",
        marginTop: 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: blueSoft,
          color: blue,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{title}</div>
        <div style={{ fontSize: 12, color: textSecondary }}>{sub}</div>
      </div>
      <span style={{ color: textSecondary, fontSize: 18 }}>›</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bottom nav — three tabs only
// ─────────────────────────────────────────────────────────────────

function BottomNav({
  isDark,
  tab,
  setTab,
  textSecondary,
  blue,
}: {
  isDark: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
  textSecondary: string;
  blue: string;
}) {
  const items: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "today", label: "Today", icon: <HomeIcon /> },
    { key: "timeline", label: "Timeline", icon: <TimelineIcon /> },
    { key: "you", label: "You", icon: <PersonIcon /> },
  ];
  return (
    <nav
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: isDark ? "rgba(11,27,51,0.92)" : "rgba(244,236,223,0.92)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderTop: isDark
          ? "1px solid rgba(255,255,255,0.06)"
          : "1px solid rgba(15,42,68,0.06)",
        padding: "10px 0 26px",
        display: "flex",
      }}
    >
      {items.map((it) => {
        const active = tab === it.key;
        const color = active ? blue : textSecondary;
        return (
          <button
            key={it.key}
            onClick={() => setTab(it.key)}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              padding: "6px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              color,
              cursor: "pointer",
            }}
          >
            <span style={{ width: 22, height: 22 }}>{it.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────
// Trust footer (lifted from the mockup's marketing strip)
// ─────────────────────────────────────────────────────────────────

function FooterTrustRow() {
  return (
    <div style={{ maxWidth: 1100, margin: "44px auto 0" }}>
      <div
        style={{
          background: "#F7F4ED",
          border: "1px solid rgba(15,42,68,0.06)",
          borderRadius: 18,
          padding: "22px 26px",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
        }}
      >
        <TrustCol
          icon={<PeopleIcon />}
          title="You stay in control."
          body="We recommend. You decide. We handle the rest."
        />
        <TrustCol
          icon={<ShieldIcon />}
          title="Expert support."
          body="Real clinicians. Real time. Always in your corner."
        />
        <TrustCol
          icon={<SparkleIcon />}
          title="Fewer headaches."
          body="We coordinate, follow up, and keep everything moving."
        />
        <TrustCol
          icon={<TrendIcon />}
          title="Better outcomes."
          body="Smarter care. Early action. Stronger results."
        />
      </div>
      <div
        style={{
          textAlign: "center",
          fontFamily:
            "'Source Serif Pro', 'Georgia', serif",
          fontSize: 18,
          color: "#1A1F2A",
          marginTop: 22,
        }}
      >
        Better care. Less stress. More control.{" "}
        <span style={{ color: "#2F66FF" }}>That&rsquo;s QBH.</span>
      </div>
    </div>
  );
}

function TrustCol({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 12,
          background: "rgba(47,102,255,0.10)",
          color: "#2F66FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2A" }}>{title}</div>
        <div
          style={{
            fontSize: 12,
            color: "#5A6478",
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Misc UI bits
// ─────────────────────────────────────────────────────────────────

function SectionTitle({
  children,
  textSecondary,
}: {
  children: React.ReactNode;
  textSecondary: string;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: textSecondary,
        marginTop: 24,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Inline icons (so we don't pull in lucide for a sandbox)
// ─────────────────────────────────────────────────────────────────

const stroke = (s = 2) => ({
  fill: "none",
  stroke: "currentColor",
  strokeWidth: s,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

function CalendarIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...stroke(2)}>
      <rect x={3} y={5} width={18} height={16} rx={3} />
      <path d="M3 9h18M8 3v4M16 3v4" />
      <circle cx={16} cy={14} r={1.5} fill="currentColor" />
    </svg>
  );
}
function SmallCalIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" {...stroke(2)}>
      <rect x={3} y={5} width={18} height={16} rx={2} />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...stroke(2.5)}>
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" {...stroke(2)}>
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...stroke(1.8)}>
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-3v-7H8v7H5a2 2 0 0 1-2-2v-9z" />
    </svg>
  );
}
function TimelineIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...stroke(1.8)}>
      <rect x={3} y={5} width={18} height={16} rx={2} />
      <path d="M3 10h18M8 3v4M16 3v4M7 14h6M7 17h10" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...stroke(1.8)}>
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...stroke(2)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
function LabIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...stroke(2)}>
      <path d="M9 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-10V3" />
      <path d="M8 3h8" />
    </svg>
  );
}
function RxIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...stroke(2)}>
      <rect x={3} y={3} width={18} height={18} rx={3} />
      <path d="M8 8h4a2 2 0 0 1 0 4H8m0 0v6m0-6l4 6" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...stroke(2)}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.92.36 1.82.7 2.69a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6 6l1.39-1.39a2 2 0 0 1 2.11-.45c.87.34 1.77.57 2.69.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...stroke(2)}>
      <circle cx={9} cy={8} r={3.5} />
      <path d="M2 21c0-3.5 3.1-6 7-6s7 2.5 7 6" />
      <circle cx={17} cy={9} r={2.5} />
      <path d="M22 20c0-2.5-2-4.5-5-4.5" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...stroke(2)}>
      <rect x={3} y={6} width={18} height={12} rx={2} />
      <path d="M3 10h18M7 15h3" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...stroke(2)}>
      <path d="M6 8a6 6 0 0 1 12 0c0 6 3 7 3 7H3s3-1 3-7" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...stroke(2)}>
      <rect x={4} y={11} width={16} height={10} rx={2} />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...stroke(2)}>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...stroke(2)}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}
