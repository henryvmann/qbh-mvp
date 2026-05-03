"use client";

/**
 * /dashboard-preview-v6 — Brand chrome + chat-led model.
 *
 * Combines the Quarterback Health brand (wordmark, Fraunces serif,
 * electric blue, glassmorphism, light + dark modes) from the latest
 * spec with the "Kate IS the Today screen" chat model.
 *
 * Structure:
 *   1. Top app bar — Quarterback Health wordmark + light/dark toggle.
 *   2. Active band — Kate avatar, "Kate is active", green dot, score
 *      delta on the right. Acts as the status header.
 *   3. Conversation thread — Kate's bubbles use glass cards, user
 *      bubbles use electric-blue. Action chips (Approve & handle)
 *      embed in Kate's bubble as the primary CTA.
 *   4. Suggested replies row above keyboard.
 *   5. Chat input — pinned bottom.
 *   6. 3-tab bottom nav (Today / Timeline / You). Today is the only
 *      Kate-led screen; the other two are flat utility surfaces.
 *
 * Live /api/kate wiring is preserved from v5. Falls back to a static
 * demo conversation when unauthed.
 */

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Inter, Fraunces } from "next/font/google";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const austin = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"] });

// ─────────────────────────────────────────────────────────────────
// Brand tokens
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

type Mode = "light" | "dark";

function theme(mode: Mode) {
  const dark = mode === "dark";
  return {
    bg: dark ? T.navy : T.lightBg,
    surface: dark ? T.cardNavy : T.white,
    glassBg: dark ? "rgba(11,37,69,0.65)" : "rgba(255,255,255,0.85)",
    border: dark ? "rgba(46,140,255,0.14)" : T.lightBorder,
    text: dark ? T.darkText : T.lightText,
    muted: dark ? T.darkMuted : T.lightMuted,
    inputBg: dark ? "rgba(11,37,69,0.7)" : T.white,
    inputBorder: dark ? "rgba(201,214,234,0.18)" : T.lightBorder,
    shadow: dark
      ? "0 8px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(46,140,255,0.08)"
      : "0 4px 18px rgba(7,24,50,0.06)",
    threadBg: dark ? T.navy : T.lightBg,
  };
}

type Tab = "today" | "timeline" | "you";
type Sender = "kate" | "user";
type ChipIntent = "handle" | "elaborate" | "defer" | "thanks" | "custom";

type BubbleChip = {
  label: string;
  intent: ChipIntent;
  onClick: () => void;
  primary?: boolean;
};

type NextStep = {
  eyebrow: string;       // "NEXT STEP"
  title: string;         // "Annual physical"
  provider?: string;     // "Dr. Smith"
  when?: string;         // "May 21 at 10:00 AM"
  subtitle?: string;     // "Stay on track with preventive care."
};

type Bubble = {
  id: string;
  sender: Sender;
  text: React.ReactNode;
  chips?: BubbleChip[];
  // When set, the bubble renders as a structured Next Step card
  // (calendar tile + eyebrow + Austin title + provider + date row +
  // subtitle + stacked CTAs) instead of a plain text bubble.
  nextStep?: NextStep;
};

// ─────────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────────

export default function DashboardPreviewV6() {
  const [mode, setMode] = useState<Mode>("light");
  const [tab, setTab] = useState<Tab>("today");
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
        {tab === "today" && <TodayChat mode={mode} />}
        {tab === "timeline" && <TimelineScreen mode={mode} />}
        {tab === "you" && <YouScreen mode={mode} />}
        <BottomNav mode={mode} tab={tab} setTab={setTab} />
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
      {(["light", "dark"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => setMode(m)}
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
              textTransform: "capitalize",
            }}
          >
            {m}
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
        height: 820,
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
// Wordmark
// ─────────────────────────────────────────────────────────────────

function Wordmark({ mode, size = 17 }: { mode: Mode; size?: number }) {
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
      <span style={{ color: mode === "light" ? T.lightText : T.darkText }}>
        Quarterback
      </span>{" "}
      <span style={{ color: T.electric }}>Health</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// TODAY — Kate chat
// ─────────────────────────────────────────────────────────────────

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

function TodayChat({ mode }: { mode: Mode }) {
  const t = theme(mode);
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

  function bubbleFromState(state: ApiKateState): Bubble {
    // If Kate has a "handle" CTA paired with a primary item, render as
    // a structured Next Step card. Pull what we can from items[0].
    const handleChip = state.chips.find((c) => c.intent === "handle");
    const item = state.items[0];
    const nextStep: NextStep | undefined =
      handleChip && item
        ? {
            eyebrow: "NEXT STEP",
            title: item.title,
            subtitle: item.detail,
          }
        : undefined;
    return {
      id: bid(),
      sender: "kate",
      text: <KateMarkdown text={state.message} />,
      nextStep,
      chips: state.chips.map((c) => ({
        label: c.label,
        intent: (c.intent as ChipIntent) || "custom",
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/kate/state", { credentials: "include" });
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 401) {
          setApiError("Demo mode — sign in for live Kate.");
          setBubbles(demoFallbackBubbles(handleDemoChip));
          return;
        }
        if (data?.ok && data.state) {
          if (data.conversationId) setConversationId(data.conversationId);
          setStatusState(data.state.status ?? statusState);
          setBubbles([bubbleFromState(data.state)]);
        } else {
          setApiError("Demo mode — couldn't reach Kate.");
          setBubbles(demoFallbackBubbles(handleDemoChip));
        }
      } catch {
        if (!cancelled) {
          setApiError("Demo mode — couldn't reach Kate.");
          setBubbles(demoFallbackBubbles(handleDemoChip));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDemoChip(label: string) {
    userSays(label);
    setKateTyping(true);
    setTimeout(() => {
      setKateTyping(false);
      addBubble({ id: bid(), sender: "kate", text: <>Got it. I&rsquo;ll handle it from here.</> });
    }, 700);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [bubbles, kateTyping]);

  function demoFallbackBubbles(onChipDemo: (label: string) => void): Bubble[] {
    return [
      {
        id: "b-1",
        sender: "kate",
        text: <>Hey — here&rsquo;s your next step.</>,
        nextStep: {
          eyebrow: "NEXT STEP",
          title: "Annual physical",
          provider: "Dr. Smith",
          when: "May 21 at 10:00 AM",
          subtitle: "Stay on track with preventive care.",
        },
        chips: [
          { label: "Approve & handle", intent: "handle", primary: true, onClick: () => onChipDemo("Approve & handle") },
          { label: "Review first", intent: "elaborate", onClick: () => onChipDemo("Review first") },
          { label: "Not now", intent: "defer", onClick: () => onChipDemo("Not now") },
        ],
      },
    ];
  }

  async function send() {
    const txt = draft.trim();
    if (!txt) return;
    userSays(txt);
    setDraft("");
    setKateTyping(true);
    try {
      const res = await fetch("/api/kate/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId, typedText: txt }),
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

  const lastKateIdx = (() => {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      if (bubbles[i].sender === "kate") return i;
    }
    return -1;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <TopAppBar mode={mode} />
      <ActiveBand mode={mode} statusState={statusState} />

      {apiError && (
        <div
          style={{
            background:
              mode === "light"
                ? "rgba(22,119,255,0.08)"
                : "rgba(46,140,255,0.12)",
            color: mode === "light" ? T.lightMuted : T.darkMuted,
            fontSize: 11,
            textAlign: "center",
            padding: "6px 14px",
          }}
        >
          {apiError}
        </div>
      )}

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 18px 14px",
          background: t.threadBg,
        }}
      >
        {bubbles.map((b, i) => (
          <BubbleRow
            key={b.id}
            mode={mode}
            bubble={b}
            showChips={i === lastKateIdx && b.sender === "kate"}
          />
        ))}
        {kateTyping && <TypingIndicator mode={mode} />}
      </div>

      {!kateTyping && lastKateIdx >= 0 && (() => {
        const last = bubbles[lastKateIdx];
        // If the last bubble rendered as a Next Step card, both
        // handle + elaborate chips already live inside it. Keep
        // only "defer"/"thanks"/"custom" chips above the keyboard.
        const skip = last.nextStep
          ? new Set<ChipIntent>(["handle", "elaborate"])
          : new Set<ChipIntent>(["handle"]);
        const chips = (last.chips ?? []).filter((c) => !skip.has(c.intent));
        return <SuggestedReplies mode={mode} chips={chips} />;
      })()}

      <ChatInput mode={mode} draft={draft} setDraft={setDraft} onSend={send} />
    </div>
  );
}

function TopAppBar({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "6px 22px 10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: t.bg,
      }}
    >
      <Wordmark mode={mode} size={18} />
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          overflow: "hidden",
          border: `1.5px solid ${t.border}`,
        }}
      >
        <Image
          src="/kate-avatar.png"
          alt="You"
          width={32}
          height={32}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </div>
  );
}

function ActiveBand({
  mode,
  statusState,
}: {
  mode: Mode;
  statusState: ApiKateState["status"];
}) {
  const t = theme(mode);
  const stateText = statusState.stateText || "Monitoring and ready to help.";
  return (
    <div
      style={{
        flexShrink: 0,
        margin: "0 18px 10px",
        padding: "12px 14px",
        background: t.glassBg,
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        boxShadow: t.shadow,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            overflow: "hidden",
          }}
        >
          <Image
            src="/kate-avatar.png"
            alt="Kate"
            width={38}
            height={38}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <span
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 11,
            height: 11,
            borderRadius: 6,
            background: T.green,
            boxShadow: `0 0 0 2.5px ${
              mode === "light" ? T.white : T.cardNavy
            }`,
            display: "block",
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
            color: t.text,
          }}
        >
          Kate is active
        </div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 1 }}>
          {stateText}
        </div>
      </div>
      {statusState.score !== null && (
        <ScorePill mode={mode} value={statusState.score} delta={statusState.deltaText} />
      )}
    </div>
  );
}

function ScorePill({
  mode,
  value,
  delta,
}: {
  mode: Mode;
  value: number;
  delta: string | null;
}) {
  const t = theme(mode);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        flexShrink: 0,
        padding: "4px 10px",
        background:
          mode === "light"
            ? "rgba(22,119,255,0.08)"
            : "rgba(46,140,255,0.15)",
        borderRadius: 12,
      }}
    >
      <span
        className={austin.className}
        style={{
          fontSize: 18,
          fontWeight: 500,
          color: t.text,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {delta && (
        <span
          style={{
            fontSize: 10,
            color: T.green,
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          {delta}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bubbles
// ─────────────────────────────────────────────────────────────────

function BubbleRow({
  mode,
  bubble,
  showChips,
}: {
  mode: Mode;
  bubble: Bubble;
  showChips: boolean;
}) {
  const isUser = bubble.sender === "user";
  const t = theme(mode);

  // Structured Next Step card (replaces flat bubble for the opening
  // recommendation). Stacks Approve & handle + Review first inside.
  if (bubble.nextStep && showChips) {
    const handleChip = (bubble.chips ?? []).find((c) => c.intent === "handle");
    const reviewChip = (bubble.chips ?? []).find((c) => c.intent === "elaborate");
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginTop: 8 }}>
        <NextStepBubble
          mode={mode}
          step={bubble.nextStep}
          handleChip={handleChip}
          reviewChip={reviewChip}
        />
      </div>
    );
  }

  const actionChips = showChips
    ? (bubble.chips ?? []).filter((c) => c.intent === "handle")
    : [];

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
          maxWidth: "84%",
          background: isUser ? T.electric : t.glassBg,
          color: isUser ? T.white : t.text,
          borderRadius: isUser ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
          padding: "12px 15px",
          fontSize: 14.5,
          lineHeight: 1.45,
          backdropFilter: isUser ? undefined : "blur(18px) saturate(140%)",
          WebkitBackdropFilter: isUser ? undefined : "blur(18px) saturate(140%)",
          border: isUser ? "none" : `1px solid ${t.border}`,
          boxShadow: isUser
            ? mode === "light"
              ? "0 6px 18px rgba(22,119,255,0.28)"
              : "0 6px 22px rgba(46,140,255,0.4)"
            : t.shadow,
        }}
      >
        {bubble.text}
        {actionChips.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {actionChips.map((c, i) => (
              <ActionCard key={i} mode={mode} chip={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NextStepBubble({
  mode,
  step,
  handleChip,
  reviewChip,
}: {
  mode: Mode;
  step: NextStep;
  handleChip?: BubbleChip;
  reviewChip?: BubbleChip;
}) {
  const t = theme(mode);
  return (
    <div
      style={{
        width: "100%",
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
            {step.eyebrow}
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
            {step.title}
          </div>
          {step.provider && (
            <div
              style={{
                fontSize: 13.5,
                color: t.text,
                marginTop: 6,
                fontWeight: 500,
              }}
            >
              {step.provider}
            </div>
          )}
          {step.when && (
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
              {step.when}
            </div>
          )}
          {step.subtitle && (
            <p
              style={{
                fontSize: 13,
                color: t.muted,
                marginTop: 10,
                lineHeight: 1.45,
              }}
            >
              {step.subtitle}
            </p>
          )}
        </div>
      </div>

      {(handleChip || reviewChip) && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {handleChip && (
            <button
              type="button"
              onClick={handleChip.onClick}
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
              {handleChip.label} <span style={{ fontSize: 16 }}>→</span>
            </button>
          )}
          {reviewChip && (
            <button
              type="button"
              onClick={reviewChip.onClick}
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
              {reviewChip.label}
            </button>
          )}
        </div>
      )}
    </div>
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

function CalendarSmallIcon({ color }: { color: string }) {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={5} width={18} height={16} rx={2.5} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={3} x2={8} y2={7} />
      <line x1={16} y1={3} x2={16} y2={7} />
    </svg>
  );
}

function ActionCard({ mode, chip }: { mode: Mode; chip: BubbleChip }) {
  return (
    <button
      onClick={chip.onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        background: T.electric,
        color: T.white,
        border: "none",
        borderRadius: 12,
        padding: "12px 14px",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        boxShadow:
          mode === "light"
            ? "0 4px 14px rgba(22,119,255,0.3)"
            : "0 4px 16px rgba(46,140,255,0.45)",
      }}
    >
      <span>{chip.label}</span>
      <span aria-hidden style={{ fontSize: 16, opacity: 0.9 }}>→</span>
    </button>
  );
}

function SuggestedReplies({
  mode,
  chips,
}: {
  mode: Mode;
  chips: BubbleChip[];
}) {
  const t = theme(mode);
  if (chips.length === 0) return null;
  return (
    <div
      style={{
        flexShrink: 0,
        background: t.bg,
        padding: "8px 16px 0",
        display: "flex",
        gap: 8,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {chips.map((c, i) => (
        <button
          key={i}
          onClick={c.onClick}
          style={{
            flexShrink: 0,
            background: t.glassBg,
            color: t.text,
            border: `1px solid ${t.border}`,
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function TypingIndicator({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <div style={{ display: "flex", marginTop: 8, alignItems: "center" }}>
      <div
        style={{
          background: t.glassBg,
          border: `1px solid ${t.border}`,
          borderRadius: "20px 20px 20px 6px",
          padding: "10px 14px",
          display: "flex",
          gap: 4,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        <Dot mode={mode} delay="0s" />
        <Dot mode={mode} delay="0.18s" />
        <Dot mode={mode} delay="0.36s" />
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

function Dot({ mode, delay }: { mode: Mode; delay: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        background: mode === "light" ? T.lightMuted : T.darkMuted,
        display: "inline-block",
        animation: `typing-bounce 1.2s infinite`,
        animationDelay: delay,
      }}
    />
  );
}

function ChatInput({
  mode,
  draft,
  setDraft,
  onSend,
}: {
  mode: Mode;
  draft: string;
  setDraft: (s: string) => void;
  onSend: () => void;
}) {
  const t = theme(mode);
  return (
    <div
      style={{
        flexShrink: 0,
        background: t.bg,
        borderTop: `1px solid ${t.border}`,
        padding: "10px 16px 12px",
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
          height: 42,
          borderRadius: 21,
          border: `1px solid ${t.inputBorder}`,
          background: t.inputBg,
          padding: "0 16px",
          fontSize: 14,
          color: t.text,
          outline: "none",
        }}
      />
      <button
        onClick={onSend}
        disabled={!draft.trim()}
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          border: "none",
          background: draft.trim() ? T.electric : t.inputBorder,
          color: T.white,
          fontSize: 18,
          fontWeight: 600,
          cursor: draft.trim() ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: draft.trim()
            ? mode === "light"
              ? "0 4px 12px rgba(22,119,255,0.3)"
              : "0 4px 14px rgba(46,140,255,0.4)"
            : "none",
        }}
      >
        ↑
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Markdown
// ─────────────────────────────────────────────────────────────────

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
      blocks.push(<div key={`p-${blocks.length}`}>{renderInline(trimmed)}</div>);
    }
  }
  flushBullets();
  return <>{blocks}</>;
}

function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return <span key={i}>{p}</span>;
  });
}

// ─────────────────────────────────────────────────────────────────
// Other tabs (utility surfaces)
// ─────────────────────────────────────────────────────────────────

function TimelineScreen({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: t.bg,
        padding: "8px 22px 100px",
      }}
    >
      <TopAppBar mode={mode} />
      <h1
        className={austin.className}
        style={{
          fontSize: 30,
          fontWeight: 500,
          color: t.text,
          margin: "12px 0 4px",
          letterSpacing: -0.5,
          lineHeight: 1.05,
        }}
      >
        Timeline
      </h1>
      <p style={{ fontSize: 13, color: t.muted, margin: "0 0 18px" }}>
        Everything Kate&rsquo;s tracking, in order.
      </p>

      <SectionLabel mode={mode}>This week</SectionLabel>
      <TimelineCard mode={mode} icon="🩺" title="Annual physical with Dr. Smith" sub="Wed, May 21 · 10:00 AM" badge="Scheduled" tone="good" />
      <TimelineCard mode={mode} icon="🧪" title="Blood work" sub="Results came in this morning" badge="Looks normal" tone="good" />

      <SectionLabel mode={mode}>Handled this month</SectionLabel>
      <TimelineCard mode={mode} icon="💊" title="Levothyroxine refill" sub="Auto-managed — arrives Thursday" badge="Done" tone="muted" />
      <TimelineCard mode={mode} icon="📞" title="Insurance pre-auth" sub="Kate called Cigna for you" badge="Done" tone="muted" />
    </div>
  );
}

function YouScreen({ mode }: { mode: Mode }) {
  const t = theme(mode);
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: t.bg,
        padding: "8px 22px 100px",
      }}
    >
      <TopAppBar mode={mode} />
      <h1
        className={austin.className}
        style={{
          fontSize: 30,
          fontWeight: 500,
          color: t.text,
          margin: "12px 0 4px",
          letterSpacing: -0.5,
          lineHeight: 1.05,
        }}
      >
        You
      </h1>
      <p style={{ fontSize: 13, color: t.muted, margin: "0 0 18px" }}>
        Your account and care setup.
      </p>

      <SectionLabel mode={mode}>Care</SectionLabel>
      <SettingsRow mode={mode} icon="👥" title="Care recipients" sub="You + 2 others" />
      <SettingsRow mode={mode} icon="🩺" title="Providers" sub="6 on your team" />
      <SettingsRow mode={mode} icon="🗓" title="Calendar" sub="Google · connected" />
      <SettingsRow mode={mode} icon="📄" title="Documents & labs" sub="3 recent" />

      <SectionLabel mode={mode}>Account</SectionLabel>
      <SettingsRow mode={mode} icon="💳" title="Plan & billing" sub="Family · $49/mo" />
      <SettingsRow mode={mode} icon="🔔" title="Notifications" sub="Quiet 9pm – 7am" />
      <SettingsRow mode={mode} icon="🔒" title="Privacy & data" sub="You control everything" />
    </div>
  );
}

function SectionLabel({ mode, children }: { mode: Mode; children: React.ReactNode }) {
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
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function TimelineCard({
  mode,
  icon,
  title,
  sub,
  badge,
  tone,
}: {
  mode: Mode;
  icon: string;
  title: string;
  sub: string;
  badge: string;
  tone: "good" | "muted";
}) {
  const t = theme(mode);
  const badgeColors: Record<string, { bg: string; fg: string }> = {
    good: {
      bg: mode === "light" ? "rgba(39,196,107,0.14)" : "rgba(39,196,107,0.22)",
      fg: T.green,
    },
    muted: {
      bg: mode === "light" ? "rgba(7,24,50,0.06)" : "rgba(201,214,234,0.12)",
      fg: t.muted,
    },
  };
  const bc = badgeColors[tone];
  return (
    <div
      style={{
        background: t.glassBg,
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: 14,
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: t.shadow,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background:
            mode === "light"
              ? "rgba(22,119,255,0.08)"
              : "rgba(46,140,255,0.15)",
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
        <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text }}>{title}</div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{sub}</div>
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

function SettingsRow({
  mode,
  icon,
  title,
  sub,
}: {
  mode: Mode;
  icon: string;
  title: string;
  sub: string;
}) {
  const t = theme(mode);
  return (
    <div
      style={{
        background: t.glassBg,
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: "13px 16px",
        marginTop: 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: t.shadow,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          background:
            mode === "light"
              ? "rgba(22,119,255,0.08)"
              : "rgba(46,140,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text }}>{title}</div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 1 }}>{sub}</div>
      </div>
      <span style={{ color: t.muted, fontSize: 18 }}>›</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bottom navigation — 3 tabs
// ─────────────────────────────────────────────────────────────────

function BottomNav({
  mode,
  tab,
  setTab,
}: {
  mode: Mode;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const t = theme(mode);
  const items: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "today", label: "Today", icon: <SparkleIcon /> },
    { key: "timeline", label: "Timeline", icon: <TimelineIcon /> },
    { key: "you", label: "You", icon: <PersonIcon /> },
  ];
  return (
    <nav
      style={{
        flexShrink: 0,
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
        const active = tab === it.key;
        const color = active
          ? T.electric
          : mode === "light"
          ? T.lightMuted
          : T.darkMuted;
        return (
          <button
            key={it.key}
            onClick={() => setTab(it.key)}
            type="button"
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
            <span style={{ fontSize: 11, fontWeight: 600 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────

function SparkleIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M12 2 L13.6 9.6 L21 11.5 L13.6 13.4 L12 21 L10.4 13.4 L3 11.5 L10.4 9.6 Z" />
      <path d="M19 3 L19.7 5.4 L22 6 L19.7 6.6 L19 9 L18.3 6.6 L16 6 L18.3 5.4 Z" opacity={0.7} />
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

function PersonIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}
