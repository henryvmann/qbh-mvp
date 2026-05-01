"use client";

/**
 * /dashboard-preview-v5 — "Kate IS the Today screen" sandbox.
 *
 * Layout:
 *   1. Compact status band at the very top (state text + score + delta).
 *   2. Kate hero — large avatar, name, "Active Now" indicator under her.
 *   3. Conversation thread below, like iMessage. Kate's opener, then any
 *      replies. Quick-reply chips render under her latest message.
 *   4. Text input pinned at the bottom for free-form typing.
 *   5. Three-tab bottom nav. Switching tabs leaves the chat — Today is
 *      the only Kate-led screen.
 *
 * Static mockup. Quick-reply chips are wired so you can feel the loop;
 * typing in the input + sending appends a user bubble + a stub Kate
 * reply so the texting feel is real.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

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
  active: "#3FBE6F", // active-now glow
};

type Tab = "today" | "timeline" | "you";
type Sender = "kate" | "user";
type Bubble = {
  id: string;
  sender: Sender;
  text: React.ReactNode;
  // Quick replies attached to this bubble; only the latest Kate bubble
  // shows chips, but we store them per-bubble so flow is reproducible.
  chips?: { label: string; onClick: () => void; primary?: boolean }[];
};

export default function DashboardPreviewV5() {
  const [tab, setTab] = useState<Tab>("today");
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
        {tab === "today" && <TodayChatScreen />}
        {tab === "timeline" && <TimelineScreen />}
        {tab === "you" && <YouScreen />}
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
        height: "100vh",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: C.bone,
        boxShadow: "0 24px 80px rgba(15,23,33,0.12)",
        position: "relative",
        overflow: "hidden",
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
          flexShrink: 0,
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
// TODAY — the Kate chat screen
// ─────────────────────────────────────────────────────────────────

// API response shapes for the wire-up
type ApiKateChip = { id: string; label: string; intent: string; primary?: boolean };
type ApiKateState = {
  bucket: string;
  tone: string;
  daysSinceSignup: number;
  confidence: string;
  message: string;
  items: { id: string; type: string; title: string; detail: string; urgency: string }[];
  chips: ApiKateChip[];
  status: { stateText: string; score: number | null; deltaText: string | null };
  meta: { generatedAt: string; rulesVersion: string; voiceVersion: string };
};

function TodayChatScreen() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [kateTyping, setKateTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [statusState, setStatusState] = useState<ApiKateState["status"]>({
    stateText: "",
    score: null,
    deltaText: null,
  });
  const [apiError, setApiError] = useState<string | null>(null);

  function bid() {
    return `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function addBubble(b: Bubble) {
    setBubbles((prev) => [...prev, b]);
  }

  function userSays(text: string) {
    addBubble({ id: bid(), sender: "user", text });
  }

  // Render an API-returned KateState as a bubble with working chips
  // that POST back through /api/kate/respond.
  function bubbleFromState(state: ApiKateState): Bubble {
    return {
      id: bid(),
      sender: "kate",
      text: <KateMarkdown text={state.message} />,
      chips: state.chips.map((c) => ({
        label: c.label,
        primary: c.primary,
        onClick: async () => {
          userSays(c.label);
          setKateTyping(true);
          try {
            const res = await fetch("/api/kate/respond", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                conversationId,
                chipIntent: c.intent,
                chipLabel: c.label,
              }),
            });
            const data = await res.json();
            if (data?.ok && data.state) {
              if (data.conversationId) setConversationId(data.conversationId);
              addBubble(bubbleFromState(data.state));
            } else {
              addBubble({
                id: bid(),
                sender: "kate",
                text: <>I hit a snag pulling that up. Give me a sec.</>,
              });
            }
          } catch {
            addBubble({
              id: bid(),
              sender: "kate",
              text: <>Network hiccup — try again in a moment.</>,
            });
          } finally {
            setKateTyping(false);
          }
        },
      })),
    };
  }

  // Initial load — fetch Kate's opening from the API.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/kate/state", { credentials: "include" });
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 401) {
          setApiError("Sign in to see live Kate. Showing demo conversation instead.");
          setBubbles(demoFallbackBubbles(handleDemoChip));
          return;
        }
        if (data?.ok && data.state) {
          if (data.conversationId) setConversationId(data.conversationId);
          setStatusState(data.state.status ?? statusState);
          setBubbles([bubbleFromState(data.state)]);
        } else {
          setApiError("Couldn't reach Kate. Showing demo conversation.");
          setBubbles(demoFallbackBubbles(handleDemoChip));
        }
      } catch {
        if (!cancelled) {
          setApiError("Couldn't reach Kate. Showing demo conversation.");
          setBubbles(demoFallbackBubbles(handleDemoChip));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Demo fallback chip handler — purely client-side stub for unauthed
  // viewers. Mirrors the old hardcoded experience.
  function handleDemoChip(label: string) {
    userSays(label);
    setKateTyping(true);
    setTimeout(() => {
      setKateTyping(false);
      addBubble({
        id: bid(),
        sender: "kate",
        text: <>Got it.</>,
      });
    }, 700);
  }

  // Auto-scroll on new bubble
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [bubbles, kateTyping]);

  // ---- demo fallback (unauthed) ----------------------------------
  function demoFallbackBubbles(onChipDemo: (label: string) => void): Bubble[] {
    return [
      {
        id: "b-1",
        sender: "kate",
        text: (
          <>
            Hey — I&rsquo;ve got a couple of things for you today.
            <ul style={{ margin: "8px 0 4px", paddingLeft: 18, lineHeight: 1.55 }}>
              <li>
                <strong>Dr. Smith follow-up</strong> — last seen 11 months ago.
              </li>
              <li>
                <strong>Levothyroxine refill</strong> — runs out Friday.
              </li>
            </ul>
            Want me to handle it?
          </>
        ),
        chips: [
          { label: "Handle it", primary: true, onClick: () => onChipDemo("Handle it") },
          { label: "Tell me more", onClick: () => onChipDemo("Tell me more") },
          { label: "Not now", onClick: () => onChipDemo("Not now") },
        ],
      },
    ];
  }

  // ---- send (text input) -----------------------------------------
  async function send() {
    const t = draft.trim();
    if (!t) return;
    userSays(t);
    setDraft("");
    setKateTyping(true);
    try {
      const res = await fetch("/api/kate/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId, typedText: t }),
      });
      const data = await res.json();
      if (data?.ok && data.state) {
        if (data.conversationId) setConversationId(data.conversationId);
        addBubble(bubbleFromState(data.state));
      } else if (res.status === 401) {
        addBubble({
          id: bid(),
          sender: "kate",
          text: <>(Demo mode — sign in to actually chat with me.)</>,
        });
      } else {
        addBubble({
          id: bid(),
          sender: "kate",
          text: <>I hit a snag. Try again in a sec.</>,
        });
      }
    } catch {
      addBubble({
        id: bid(),
        sender: "kate",
        text: <>Network hiccup — try again in a moment.</>,
      });
    } finally {
      setKateTyping(false);
    }
  }

  // Latest Kate bubble's chips (only show on the most recent Kate message)
  const lastKateIdx = (() => {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      if (bubbles[i].sender === "kate") return i;
    }
    return -1;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* 1. Status band (top) */}
      <StatusBand status={statusState} />

      {/* 2. Kate hero — avatar + name + Active Now */}
      <KateHero />

      {apiError && (
        <div
          style={{
            background: "rgba(230,193,90,0.18)",
            color: "#85651A",
            fontSize: 11,
            textAlign: "center",
            padding: "6px 14px",
          }}
        >
          {apiError}
        </div>
      )}

      {/* 3. Conversation thread */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 16px 12px",
          background: C.bone,
        }}
      >
        {bubbles.map((b, i) => (
          <BubbleRow
            key={b.id}
            bubble={b}
            showChips={i === lastKateIdx && b.sender === "kate"}
          />
        ))}
        {kateTyping && <TypingIndicator />}
      </div>

      {/* 4. Input bar */}
      <ChatInput
        draft={draft}
        setDraft={setDraft}
        onSend={send}
      />
    </div>
  );
}

/**
 * Lightweight markdown renderer for Kate's messages — handles:
 *   - **bold**
 *   - leading "• " or "- " bullet lines
 *   - blank-line paragraph breaks
 * Anything else passes through as text. Templates and the LLM voice
 * both stay within these patterns.
 */
function KateMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bulletGroup: string[] = [];

  function flushBullets() {
    if (bulletGroup.length === 0) return;
    blocks.push(
      <ul key={`u-${blocks.length}`} style={{ margin: "6px 0", paddingLeft: 18, lineHeight: 1.55 }}>
        {bulletGroup.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>
    );
    bulletGroup = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("•") || trimmed.startsWith("- ")) {
      bulletGroup.push(trimmed.replace(/^[•\-]\s*/, ""));
      continue;
    }
    flushBullets();
    if (trimmed === "") {
      blocks.push(<div key={`s-${blocks.length}`} style={{ height: 8 }} />);
    } else {
      blocks.push(
        <div key={`p-${blocks.length}`}>{renderInline(trimmed)}</div>
      );
    }
  }
  flushBullets();
  return <>{blocks}</>;
}

function renderInline(s: string): React.ReactNode {
  // **bold** → <strong>
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return <span key={i}>{p}</span>;
  });
}

// ─────────────────────────────────────────────────────────────────
// Status band — compact, sits above Kate
// ─────────────────────────────────────────────────────────────────

function StatusBand({
  status,
}: {
  status: { stateText: string; score: number | null; deltaText: string | null };
}) {
  const stateText = status.stateText || "You're in a good place.";
  return (
    <div
      style={{
        background: C.bone,
        padding: "4px 18px 12px",
        borderBottom: `1px solid ${C.softGray}`,
        flexShrink: 0,
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
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: C.textGray,
            }}
          >
            Today
          </div>
          <div
            style={{
              fontFamily: "'Source Serif Pro', Georgia, serif",
              fontSize: 19,
              fontWeight: 500,
              color: C.ink,
              marginTop: 2,
            }}
          >
            {stateText}
          </div>
        </div>
        {status.score !== null && (
          <ScorePill value={status.score} deltaText={status.deltaText} />
        )}
      </div>
    </div>
  );
}

function ScorePill({ value, deltaText }: { value: number; deltaText: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: C.white,
        border: `1px solid ${C.softGray}`,
        borderRadius: 999,
        padding: "8px 14px",
      }}
    >
      <OpenRing />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span
          style={{
            fontFamily: "'Source Serif Pro', Georgia, serif",
            fontSize: 18,
            fontWeight: 500,
            color: C.ink,
          }}
        >
          {value}
        </span>
        {deltaText && (
          <span style={{ fontSize: 10, color: C.olive, fontWeight: 600 }}>
            {deltaText}
          </span>
        )}
      </div>
    </div>
  );
}

function OpenRing() {
  // Mini open ring — same visual idea as the mockup, scaled down.
  const r = 11;
  return (
    <svg width={28} height={28} viewBox="0 0 28 28">
      <circle cx={14} cy={14} r={r} fill="none" stroke={C.softGray} strokeWidth={1.5} />
      <circle cx={14 + r} cy={14} r={2.4} fill={C.deepBlue} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// Kate hero — avatar + name + Active Now
// ─────────────────────────────────────────────────────────────────

function KateHero() {
  return (
    <div
      style={{
        background: C.bone,
        padding: "14px 18px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            overflow: "hidden",
            boxShadow: `0 0 0 3px ${C.white}, 0 0 0 4px ${C.softGray}`,
          }}
        >
          <Image
            src="/kate-avatar.png"
            alt="Kate"
            width={64}
            height={64}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        {/* Active-now dot — pulsing */}
        <span
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: C.active,
            boxShadow: `0 0 0 3px ${C.bone}`,
            display: "block",
          }}
        />
        <style>{`
          @keyframes pulseGlow {
            0% { box-shadow: 0 0 0 3px ${C.bone}, 0 0 0 4px rgba(63,190,111,0.45); }
            70% { box-shadow: 0 0 0 3px ${C.bone}, 0 0 0 10px rgba(63,190,111,0); }
            100% { box-shadow: 0 0 0 3px ${C.bone}, 0 0 0 4px rgba(63,190,111,0); }
          }
        `}</style>
      </div>

      <div
        style={{
          marginTop: 8,
          fontFamily: "'Source Serif Pro', Georgia, serif",
          fontSize: 18,
          fontWeight: 500,
          color: C.ink,
        }}
      >
        Kate
      </div>
      <div
        style={{
          marginTop: 2,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: C.active,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: C.active,
            display: "inline-block",
            animation: "blink 1.6s ease-in-out infinite",
          }}
        />
        Active now
        <style>{`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.45; }
          }
        `}</style>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bubbles + typing
// ─────────────────────────────────────────────────────────────────

function BubbleRow({ bubble, showChips }: { bubble: Bubble; showChips: boolean }) {
  const isUser = bubble.sender === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginTop: 8,
      }}
    >
      <div
        style={{
          maxWidth: "82%",
          background: isUser ? C.deepBlue : C.white,
          color: isUser ? C.white : C.ink,
          borderRadius: isUser ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
          padding: "11px 14px",
          fontSize: 14.5,
          lineHeight: 1.45,
          boxShadow: isUser ? "none" : "0 2px 10px rgba(15,23,33,0.05)",
        }}
      >
        {bubble.text}
      </div>
      {showChips && bubble.chips && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-start",
          }}
        >
          {bubble.chips.map((c, i) => (
            <button
              key={i}
              onClick={c.onClick}
              style={{
                background: c.primary ? C.deepBlue : C.white,
                color: c.primary ? C.white : C.deepBlue,
                border: c.primary ? "none" : `1px solid ${C.softGray}`,
                borderRadius: 999,
                padding: "9px 15px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", marginTop: 8, alignItems: "center" }}>
      <div
        style={{
          background: C.white,
          borderRadius: "20px 20px 20px 6px",
          padding: "10px 14px",
          display: "flex",
          gap: 4,
          boxShadow: "0 2px 10px rgba(15,23,33,0.05)",
        }}
      >
        <Dot delay="0s" />
        <Dot delay="0.18s" />
        <Dot delay="0.36s" />
      </div>
      <style>{`
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        background: C.textGray,
        display: "inline-block",
        animation: `typing-bounce 1.2s infinite`,
        animationDelay: delay,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Chat input
// ─────────────────────────────────────────────────────────────────

function ChatInput({
  draft,
  setDraft,
  onSend,
}: {
  draft: string;
  setDraft: (s: string) => void;
  onSend: () => void;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        background: C.bone,
        borderTop: `1px solid ${C.softGray}`,
        padding: "10px 14px 12px",
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSend();
        }}
        placeholder="Message Kate…"
        style={{
          flex: 1,
          height: 40,
          borderRadius: 20,
          border: `1px solid ${C.softGray}`,
          background: C.white,
          padding: "0 14px",
          fontSize: 14,
          color: C.ink,
          outline: "none",
        }}
      />
      <button
        onClick={onSend}
        disabled={!draft.trim()}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          border: "none",
          background: draft.trim() ? C.deepBlue : C.softGray,
          color: C.white,
          fontSize: 16,
          cursor: draft.trim() ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ↑
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Other tabs (Kate is NOT here — these are utility surfaces).
// A small "talk to Kate" launcher floats at the bottom-right so the
// user can always start a conversation; tapping it would route back
// to Today in the real app.
// ─────────────────────────────────────────────────────────────────

function TimelineScreen() {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: C.bone,
        padding: "8px 18px 100px",
        position: "relative",
      }}
    >
      <h1
        style={{
          fontFamily: "'Source Serif Pro', Georgia, serif",
          fontSize: 26,
          fontWeight: 500,
          color: C.ink,
          margin: "12px 0 4px",
          letterSpacing: -0.3,
        }}
      >
        Timeline
      </h1>
      <p style={{ fontSize: 13, color: C.textGray, margin: "0 0 16px" }}>
        Everything Kate&rsquo;s tracking, in order.
      </p>

      <SegmentControl />

      <SectionLabel>This week</SectionLabel>
      <TimelineCard icon="🩺" title="Dr. Echelman annual" sub="Wed, May 21 · 2:00 PM" badge="Scheduled" tone="good" />
      <TimelineCard icon="🧪" title="Blood work" sub="Results came in this morning" badge="Looks normal" tone="good" />

      <SectionLabel>Handled this month</SectionLabel>
      <TimelineCard icon="💊" title="Levothyroxine refill" sub="Auto-managed — arrives Thursday" badge="Done" tone="muted" />
      <TimelineCard icon="📞" title="Insurance pre-auth follow-up" sub="Kate called Cigna for you" badge="Done" tone="muted" />
      <TimelineCard icon="📅" title="Pediatric well-visit moved" sub="Pushed to June 4" badge="Done" tone="muted" />

      <KateLauncher />
    </div>
  );
}

function YouScreen() {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: C.bone,
        padding: "8px 18px 100px",
        position: "relative",
      }}
    >
      <h1
        style={{
          fontFamily: "'Source Serif Pro', Georgia, serif",
          fontSize: 26,
          fontWeight: 500,
          color: C.ink,
          margin: "12px 0 4px",
          letterSpacing: -0.3,
        }}
      >
        You
      </h1>
      <p style={{ fontSize: 13, color: C.textGray, margin: "0 0 16px" }}>
        Your account and care setup.
      </p>

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

      <KateLauncher />
    </div>
  );
}

function KateLauncher() {
  // Floating button on non-Today screens to start a Kate conversation
  // anywhere. Clicking would route to Today in the real app; here it's
  // a hint that she's always reachable.
  return (
    <div
      style={{
        position: "fixed",
        bottom: 96,
        right: 22,
        zIndex: 5,
      }}
    >
      <button
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          border: "none",
          background: C.white,
          boxShadow: "0 8px 24px rgba(15,23,33,0.16)",
          cursor: "pointer",
          padding: 0,
          position: "relative",
          overflow: "hidden",
        }}
        title="Talk to Kate"
      >
        <Image
          src="/kate-avatar.png"
          alt="Kate"
          width={56}
          height={56}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <span
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            width: 12,
            height: 12,
            borderRadius: 6,
            background: C.active,
            boxShadow: `0 0 0 2px ${C.white}`,
          }}
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared (timeline + settings UI lifted from v3)
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
// Bottom tab bar
// ─────────────────────────────────────────────────────────────────

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "today", label: "Today", icon: "◐" },
    { key: "timeline", label: "Timeline", icon: "▤" },
    { key: "you", label: "You", icon: "◯" },
  ];
  return (
    <nav
      style={{
        flexShrink: 0,
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
