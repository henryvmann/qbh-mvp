"use client";

/**
 * /dashboard-preview-v3 — Kate-as-leader, conversation-first phone sandbox.
 *
 * Kate doesn't sit in a band labeling herself. She opens an actual
 * conversation: avatar + opening line that names the specific things
 * she's seeing right now, with three response chips so the user can
 * say "handle it / tell me more / not now" in one tap. An "Ask Kate"
 * input is pinned up top for when the user wants to drive.
 *
 * Three tabs only (Today / Timeline / You). State strip below the
 * conversation is compact and supporting — Kate leads.
 *
 * Static mockup — chips are wired so you can feel the response loop
 * but nothing talks to a backend.
 */

import Image from "next/image";
import { useState } from "react";

// Brand palette (project_brand.md "deep blue" set)
const C = {
  deepBlue: "#0F2A44",
  primaryBlue: "#2F5DBC",
  skyBlue: "#A7C7E7",
  bone: "#F7F8FA",
  softGray: "#E6EAF0",
  textGray: "#5A6675",
  olive: "#7ABA6B",
  gold: "#E6C15A",
  white: "#FFFFFF",
  ink: "#0F1721",
};

type Tab = "today" | "timeline" | "you";
type KateState = "opening" | "handling" | "elaborating" | "deferred";

export default function DashboardPreviewV3() {
  const [tab, setTab] = useState<Tab>("today");
  const [kateState, setKateState] = useState<KateState>("opening");
  const [askOpen, setAskOpen] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bone,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif",
        color: C.ink,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <PhoneFrame>
        {/* Header — wordmark + Ask Kate input pill. The input is the
            "user can drive" affordance; tap to expand into a fuller
            chat surface (stubbed in this mockup). */}
        <Header onAsk={() => setAskOpen((v) => !v)} askOpen={askOpen} />

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 18px 100px",
            background: C.bone,
          }}
        >
          {/* Kate's opening conversation lives at the top of every tab.
              Same Kate, different opener per tab. */}
          {tab === "today" && (
            <KateConversation
              state={kateState}
              setState={setKateState}
            />
          )}
          {tab === "timeline" && <KateRecap />}
          {tab === "you" && <KateAtRest />}

          {/* Tab body content sits BELOW Kate's conversation. */}
          <div style={{ marginTop: 22 }}>
            {tab === "today" && <TodayBody />}
            {tab === "timeline" && <TimelineBody />}
            {tab === "you" && <YouBody />}
          </div>
        </main>

        <TabBar tab={tab} setTab={setTab} />
      </PhoneFrame>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Phone frame
// ─────────────────────────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: "0 auto",
        width: "100%",
        maxWidth: 420,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: C.bone,
        boxShadow: "0 24px 80px rgba(15,23,33,0.12)",
        position: "relative",
      }}
    >
      <div
        style={{
          height: 44,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 14,
          fontWeight: 600,
          color: C.ink,
          background: C.bone,
        }}
      >
        <span>9:41</span>
        <span style={{ display: "flex", gap: 6, opacity: 0.8 }}>
          <span>•••</span>
          <span>◐</span>
          <span>▮</span>
        </span>
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Header — logo + "Ask Kate" input pill
// ─────────────────────────────────────────────────────────────────

function Header({ onAsk, askOpen }: { onAsk: () => void; askOpen: boolean }) {
  return (
    <div
      style={{
        background: C.bone,
        padding: "6px 18px 14px",
        borderBottom: askOpen ? `1px solid ${C.softGray}` : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: "'Source Serif Pro', Georgia, serif",
            fontSize: 16,
            fontWeight: 500,
            color: C.ink,
          }}
        >
          Quarterback Health
        </span>
        <button
          aria-label="Notifications"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: "none",
            background: C.white,
            color: C.deepBlue,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 1px 4px rgba(15,23,33,0.06)`,
            cursor: "pointer",
          }}
        >
          ♡
        </button>
      </div>

      {/* The "Ask Kate" pinned input. Tappable; expands into a chat
          stub below to show the affordance is real. */}
      <button
        onClick={onAsk}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 22,
          border: `1px solid ${C.softGray}`,
          background: C.white,
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <Image
          src="/kate-avatar.png"
          alt="Kate"
          width={26}
          height={26}
          style={{ borderRadius: 13, flexShrink: 0 }}
        />
        <span style={{ flex: 1, fontSize: 14, color: C.textGray }}>
          Ask Kate or tell her what to handle…
        </span>
        <span
          style={{
            color: C.deepBlue,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          ↑
        </span>
      </button>

      {askOpen && (
        <div
          style={{
            marginTop: 10,
            background: C.white,
            border: `1px solid ${C.softGray}`,
            borderRadius: 14,
            padding: 14,
            fontSize: 13,
            color: C.textGray,
            lineHeight: 1.4,
          }}
        >
          Anything specific on your mind? You can also try:
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <SuggestionChip label="Find me a dermatologist" />
            <SuggestionChip label="What's on my schedule?" />
            <SuggestionChip label="Summarize my labs" />
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionChip({ label }: { label: string }) {
  return (
    <span
      style={{
        background: C.bone,
        border: `1px solid ${C.softGray}`,
        borderRadius: 999,
        padding: "6px 12px",
        fontSize: 12,
        color: C.deepBlue,
      }}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Kate's opening conversation (Today)
// ─────────────────────────────────────────────────────────────────

function KateConversation({
  state,
  setState,
}: {
  state: KateState;
  setState: (s: KateState) => void;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      {/* Kate's opening line — natural, conversational, names the things */}
      <KateMessageBlock>
        {state === "opening" && (
          <>
            Hey — I&rsquo;ve got a couple of things for you today.
            <ul style={{ margin: "10px 0 6px", paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
              <li>
                <strong>Dr. Smith follow-up</strong> — last seen 11 months ago.
              </li>
              <li>
                <strong>Levothyroxine refill</strong> — runs out Friday.
              </li>
            </ul>
            Want me to handle it?
          </>
        )}
        {state === "handling" && (
          <>
            On it. I&rsquo;ll start with Dr. Smith — looking at this week first.
            The refill goes through automatically; I&rsquo;ll let you know when
            it&rsquo;s on its way.
          </>
        )}
        {state === "elaborating" && (
          <>
            Sure — here&rsquo;s what I&rsquo;m seeing:
            <div
              style={{
                marginTop: 10,
                background: C.bone,
                border: `1px solid ${C.softGray}`,
                borderRadius: 12,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.5,
                color: C.textGray,
              }}
            >
              <strong style={{ color: C.ink }}>Dr. Smith</strong> — your annual
              physical was 11 months ago. Insurance covers another visit any time
              now; offices usually book 2–3 weeks out so this is the moment.
              <br />
              <br />
              <strong style={{ color: C.ink }}>Levothyroxine</strong> — pharmacy
              shows last fill on Apr 1 at 30 days. Refill is auto-eligible; I can
              put it through and ship to your usual CVS.
            </div>
          </>
        )}
        {state === "deferred" && (
          <>No worries. I&rsquo;ll check back tomorrow morning.</>
        )}
      </KateMessageBlock>

      {/* Response chips — three options, one tap to advance */}
      {state === "opening" && (
        <ChipRow>
          <ResponseChip
            label="Handle it"
            primary
            onClick={() => setState("handling")}
          />
          <ResponseChip
            label="Tell me more"
            onClick={() => setState("elaborating")}
          />
          <ResponseChip label="Not now" onClick={() => setState("deferred")} />
        </ChipRow>
      )}

      {state === "elaborating" && (
        <ChipRow>
          <ResponseChip
            label="Handle both"
            primary
            onClick={() => setState("handling")}
          />
          <ResponseChip
            label="Just the refill"
            onClick={() => setState("handling")}
          />
          <ResponseChip label="Hold off" onClick={() => setState("deferred")} />
        </ChipRow>
      )}

      {state === "handling" && (
        <ChipRow>
          <ResponseChip
            label="Sounds good"
            primary
            onClick={() => setState("opening")}
          />
        </ChipRow>
      )}

      {state === "deferred" && (
        <ChipRow>
          <ResponseChip
            label="Actually, let&rsquo;s do it"
            onClick={() => setState("opening")}
          />
        </ChipRow>
      )}
    </div>
  );
}

function KateMessageBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          overflow: "hidden",
          flexShrink: 0,
          boxShadow: `0 0 0 2px ${C.softGray}`,
        }}
      >
        <Image
          src="/kate-avatar.png"
          alt="Kate"
          width={40}
          height={40}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div
        style={{
          flex: 1,
          background: C.white,
          borderRadius: 18,
          padding: 14,
          fontSize: 15,
          lineHeight: 1.5,
          color: C.ink,
          boxShadow: "0 4px 14px rgba(15,23,33,0.05)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: C.textGray,
            marginBottom: 6,
          }}
        >
          Kate
        </div>
        {children}
      </div>
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 10,
        marginLeft: 52, // align with Kate's bubble (avatar 40 + gap 12)
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {children}
    </div>
  );
}

function ResponseChip({
  label,
  primary = false,
  onClick,
}: {
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: label }}
      style={{
        background: primary ? C.deepBlue : C.white,
        color: primary ? C.white : C.deepBlue,
        border: primary ? "none" : `1px solid ${C.softGray}`,
        borderRadius: 999,
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    />
  );
}

// Other tabs: Kate has a different posture
function KateRecap() {
  return (
    <div style={{ marginTop: 14 }}>
      <KateMessageBlock>
        Here&rsquo;s how the week shaped up. You stayed steady, and I took care
        of two things in the background.
      </KateMessageBlock>
    </div>
  );
}

function KateAtRest() {
  return (
    <div style={{ marginTop: 14 }}>
      <KateMessageBlock>
        You&rsquo;re set up well. Anything in here you want to adjust?
      </KateMessageBlock>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TODAY body — supporting context BELOW Kate's conversation
// ─────────────────────────────────────────────────────────────────

function TodayBody() {
  return (
    <>
      <SectionLabel>Where you are</SectionLabel>
      <StateCard />
      <SectionLabel>Coming up</SectionLabel>
      <UpcomingMini
        items={[
          {
            icon: "🩺",
            title: "Dr. Echelman annual",
            sub: "Wed, May 21 · 2:00 PM",
            badge: "Scheduled",
            tone: "good",
          },
          {
            icon: "🧪",
            title: "Blood work",
            sub: "Results came in this morning",
            badge: "Looks normal",
            tone: "good",
          },
        ]}
      />
    </>
  );
}

function StateCard() {
  return (
    <div
      style={{
        background: C.white,
        borderRadius: 18,
        padding: 16,
        boxShadow: "0 4px 14px rgba(15,23,33,0.05)",
        marginTop: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Source Serif Pro', Georgia, serif",
              fontSize: 20,
              fontWeight: 500,
              color: C.ink,
              lineHeight: 1.2,
            }}
          >
            You&rsquo;re in a good place.
          </div>
          <div style={{ fontSize: 12, color: C.textGray, marginTop: 2 }}>
            Up 6 from last week.
          </div>
        </div>
        <ReadinessRing value={82} />
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${C.softGray}`,
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <MiniRing label="Preventive" value={75} color={C.olive} />
        <MiniRing label="Mental" value={60} color={C.primaryBlue} />
        <MiniRing label="Energy" value={85} color={C.gold} />
        <MiniRing label="Follow-up" value={40} color={C.skyBlue} />
      </div>
    </div>
  );
}

function ReadinessRing({ value }: { value: number }) {
  const r = 30;
  return (
    <svg width={76} height={76} viewBox="0 0 76 76">
      <circle cx={38} cy={38} r={r} fill="none" stroke={C.softGray} strokeWidth={2} />
      <circle cx={38 + r} cy={38} r={4.5} fill={C.deepBlue} />
      <text
        x={38}
        y={43}
        textAnchor="middle"
        fontSize={20}
        fontFamily="'Source Serif Pro', Georgia, serif"
        fontWeight={500}
        fill={C.ink}
      >
        {value}
      </text>
    </svg>
  );
}

function MiniRing({ label, value, color }: { label: string; value: number; color: string }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
      <svg width={36} height={36} viewBox="0 0 36 36">
        <circle cx={18} cy={18} r={r} fill="none" stroke={C.softGray} strokeWidth={3} />
        <circle
          cx={18}
          cy={18}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div style={{ fontSize: 10, color: C.textGray, marginTop: 4, textAlign: "center" }}>
        {label}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TIMELINE body
// ─────────────────────────────────────────────────────────────────

function TimelineBody() {
  return (
    <>
      <SegmentControl />
      <SectionLabel>This week</SectionLabel>
      <TimelineCard
        icon="🩺"
        title="Dr. Echelman annual"
        sub="Wed, May 21 · 2:00 PM"
        badge="Scheduled"
        tone="good"
      />
      <TimelineCard
        icon="🧪"
        title="Blood work"
        sub="Results came in this morning"
        badge="Looks normal"
        tone="good"
      />
      <SectionLabel>Handled this month</SectionLabel>
      <TimelineCard
        icon="💊"
        title="Levothyroxine refill"
        sub="Auto-managed — arrives Thursday"
        badge="Done"
        tone="muted"
      />
      <TimelineCard
        icon="📞"
        title="Insurance pre-auth follow-up"
        sub="Kate called Cigna for you"
        badge="Done"
        tone="muted"
      />
    </>
  );
}

function SegmentControl() {
  const segs = ["Upcoming", "Past", "All"];
  return (
    <div
      style={{
        background: C.white,
        borderRadius: 12,
        padding: 4,
        display: "flex",
        boxShadow: `inset 0 0 0 1px ${C.softGray}`,
        marginTop: 4,
      }}
    >
      {segs.map((s, i) => (
        <button
          key={s}
          style={{
            flex: 1,
            padding: "10px 0",
            border: "none",
            background: i === 0 ? C.deepBlue : "transparent",
            color: i === 0 ? C.white : C.textGray,
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function TimelineCard({
  icon,
  title,
  sub,
  badge,
  tone,
}: {
  icon: string;
  title: string;
  sub: string;
  badge: string;
  tone: "good" | "muted" | "fair";
}) {
  const badgeColors: Record<string, { bg: string; fg: string }> = {
    good: { bg: "rgba(122,186,107,0.16)", fg: "#3F7B33" },
    muted: { bg: C.bone, fg: C.textGray },
    fair: { bg: "rgba(230,193,90,0.18)", fg: "#85651A" },
  };
  const bc = badgeColors[tone];
  return (
    <div
      style={{
        background: C.white,
        borderRadius: 16,
        padding: 14,
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 12px rgba(15,23,33,0.04)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: C.bone,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{title}</div>
        <div style={{ fontSize: 12, color: C.textGray, marginTop: 2 }}>{sub}</div>
      </div>
      <span
        style={{
          background: bc.bg,
          color: bc.fg,
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
  );
}

function UpcomingMini({
  items,
}: {
  items: { icon: string; title: string; sub: string; badge: string; tone: "good" | "muted" | "fair" }[];
}) {
  return (
    <>
      {items.map((it, i) => (
        <TimelineCard key={i} {...it} />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// YOU body
// ─────────────────────────────────────────────────────────────────

function YouBody() {
  return (
    <>
      <ProfileBlock />
      <SectionLabel>Care</SectionLabel>
      <SettingsRow icon="👥" title="Care recipients" sub="You + 2 others" />
      <SettingsRow icon="🩺" title="Providers" sub="6 on your team" />
      <SettingsRow icon="🗓" title="Calendar" sub="Google · connected" />
      <SettingsRow icon="📄" title="Documents & labs" sub="3 recent" />
      <SectionLabel>Account</SectionLabel>
      <SettingsRow icon="💳" title="Plan & billing" sub="Family · $49/mo" />
      <SettingsRow icon="🔔" title="Notifications" sub="Quiet 9pm – 7am" />
      <SettingsRow icon="🔒" title="Privacy & data" sub="You control everything" />
      <div
        style={{
          marginTop: 22,
          background: "rgba(167,199,231,0.22)",
          borderRadius: 16,
          padding: 18,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: C.deepBlue, marginBottom: 4 }}>
          Your data is yours.
        </div>
        <div style={{ fontSize: 13, color: C.textGray, lineHeight: 1.5 }}>
          QBH works for you. Nothing leaves without your say-so.
        </div>
      </div>
    </>
  );
}

function ProfileBlock() {
  return (
    <div
      style={{
        background: C.white,
        borderRadius: 18,
        padding: 18,
        marginTop: 6,
        boxShadow: "0 6px 18px rgba(15,23,33,0.06)",
        display: "flex",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: C.deepBlue,
          color: C.white,
          fontSize: 22,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        H
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>Henry Mann</div>
        <div style={{ fontSize: 13, color: C.textGray }}>QBH member · since Apr 2026</div>
      </div>
    </div>
  );
}

function SettingsRow({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div
      style={{
        background: C.white,
        borderRadius: 14,
        padding: "14px 16px",
        marginTop: 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 2px 8px rgba(15,23,33,0.04)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          background: C.bone,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{title}</div>
        <div style={{ fontSize: 12, color: C.textGray, marginTop: 1 }}>{sub}</div>
      </div>
      <span style={{ color: C.textGray, fontSize: 18 }}>›</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        color: C.textGray,
        marginTop: 22,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "today", label: "Today", icon: "◐" },
    { key: "timeline", label: "Timeline", icon: "▤" },
    { key: "you", label: "You", icon: "◯" },
  ];
  return (
    <nav
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        background: C.white,
        borderTop: `1px solid ${C.softGray}`,
        padding: "8px 0 28px",
        display: "flex",
        boxShadow: "0 -4px 24px rgba(15,23,33,0.04)",
      }}
    >
      {tabs.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              padding: "8px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              color: active ? C.deepBlue : C.textGray,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
