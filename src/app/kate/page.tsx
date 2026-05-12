"use client";

/**
 * /kate — full-page Kate chat surface.
 *
 * Different from the floating KateChatButton in two ways:
 *   1. It IS the page (not an overlay), so it gets BrandShell chrome
 *      and the bottom nav is visible the whole time.
 *   2. Kate opens proactively with what-to-do-next suggestions
 *      instead of waiting for the user to ask.
 *
 * Backed by the same /api/kate/chat endpoint the floating widget uses.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "../../lib/api";
import BrandShell from "../../components/brand/BrandShell";
import { GlassCard } from "../../components/brand/cards";
import { T } from "../../components/brand";
import { CalendarPlus, FileText, Stethoscope, HelpCircle, Sparkles, Send } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

// Proactive opener removed — the dead-end "Hey, here's what I'm
// thinking about for you today" with nothing after it confused users.
// Kate now waits for the user to ask (via the prompt chips or the
// message box) and answers in context.

const QUICK_PROMPTS = [
  { label: "What should I focus on?", prompt: "What are the most important things I should do for my health right now?", icon: HelpCircle },
  { label: "What's due next?", prompt: "What appointments or follow-ups are coming due or ready to schedule?", icon: CalendarPlus },
  { label: "Prep for my next visit", prompt: "Help me prepare for my next upcoming appointment.", icon: Stethoscope },
  { label: "Summarize my care", prompt: "Give me a quick summary of my providers, recent visits, and what's coming up.", icon: FileText },
  { label: "What's missing from my care?", prompt: "Based on my age and history, what preventive care am I missing? Be specific.", icon: Sparkles },
  { label: "How is my health trending?", prompt: "How am I doing overall? What's my health score and what's driving it?", icon: Sparkles },
];

export default function KatePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Inference-layer state: contextual opener + chips driven by the
  // user's current situation. Falls back to QUICK_PROMPTS when the
  // call fails or returns nothing.
  type InferredChip = { id: string; label: string; intent: string };
  const [inferredGreeting, setInferredGreeting] = useState<string | null>(null);
  const [inferredChips, setInferredChips] = useState<InferredChip[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // No proactive opener — Kate waits for the user to ask. Quick
  // prompts above the message box give the user a one-tap entry.
  useEffect(() => {
    if (hasOpened) return;
    setHasOpened(true);
    apiFetch("/api/kate/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const msg = json?.state?.message;
        if (typeof msg === "string" && msg.trim()) setInferredGreeting(msg.trim());
        if (typeof json?.conversationId === "string") setConversationId(json.conversationId);
        const chips = json?.state?.chips;
        if (Array.isArray(chips)) {
          setInferredChips(
            chips
              .filter((c: unknown): c is InferredChip =>
                typeof c === "object" && c !== null
                && typeof (c as { id?: unknown }).id === "string"
                && typeof (c as { label?: unknown }).label === "string"
                && typeof (c as { intent?: unknown }).intent === "string"
              )
              .slice(0, 6)
          );
        }
      })
      .catch(() => {});
  }, [hasOpened]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const res = await apiFetch("/api/kate/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, page: "/kate" }),
      });
      if (!res.ok || !res.body) {
        setMessages([...next, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages([...next, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: assistantContent }]);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "Sorry, I couldn't connect. Try again." }]);
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming]);

  // Inference chip → structured /respond turn. Tapping a chip routes
  // through the rule layer with conversation history as context, gets
  // back Kate's next message + a refreshed chip set. Free-form typing
  // continues to use `send` above (streaming /chat).
  const sendChipIntent = useCallback(
    async (chip: InferredChip) => {
      if (streaming) return;
      const userMsg: Message = { role: "user", content: chip.label };
      const baseline: Message[] = inferredGreeting
        ? [{ role: "assistant", content: inferredGreeting }]
        : [];
      const after = [...baseline, ...messages, userMsg];
      setMessages(after);
      setStreaming(true);
      try {
        const res = await apiFetch("/api/kate/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            chipIntent: chip.intent,
            chipLabel: chip.label,
          }),
        });
        const data = await res.json();
        if (!data?.ok || !data?.state?.message) {
          setMessages([...after, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
          return;
        }
        if (typeof data.conversationId === "string") setConversationId(data.conversationId);
        setMessages([...after, { role: "assistant", content: data.state.message }]);
        const nextChips = data.state?.chips;
        if (Array.isArray(nextChips)) {
          setInferredChips(
            nextChips
              .filter((c: unknown): c is InferredChip =>
                typeof c === "object" && c !== null
                && typeof (c as { id?: unknown }).id === "string"
                && typeof (c as { label?: unknown }).label === "string"
                && typeof (c as { intent?: unknown }).intent === "string"
              )
              .slice(0, 6)
          );
        } else {
          setInferredChips([]);
        }
      } catch {
        setMessages([...after, { role: "assistant", content: "Sorry, I couldn't connect. Try again." }]);
      } finally {
        setStreaming(false);
      }
    },
    [streaming, inferredGreeting, conversationId, messages]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <BrandShell contentMaxWidth={760}>
      <div style={{ paddingTop: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: T.lightMuted, marginBottom: 6 }}>
          Ask Kate anything
        </div>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: -0.5,
            lineHeight: 1.05,
            margin: 0,
            color: T.lightText,
            fontFamily: "var(--font-fraunces, serif)",
          }}
        >
          What&rsquo;s on your mind?
        </h1>
      </div>

      {/* Inference-layer opener — shows Kate's contextual read of the
          current situation before the user asks anything. Only renders
          before the first message exchange, same as QUICK_PROMPTS. */}
      {inferredGreeting && messages.length === 0 && !streaming && (
        <div
          style={{
            background: "rgba(22,119,255,0.06)",
            border: `1px solid rgba(22,119,255,0.18)`,
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 16,
            fontSize: 14,
            lineHeight: 1.5,
            color: T.lightText,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.electric, marginBottom: 6 }}>
            Kate&rsquo;s read
          </div>
          {inferredGreeting}
        </div>
      )}

      {/* Inference-driven chips when the state layer produced any —
          they reflect what Kate actually sees, not just generic prompts.
          When empty, fall back to the static QUICK_PROMPTS below. */}
      {inferredChips.length > 0 && messages.length <= 1 && !streaming && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {inferredChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => sendChipIntent(chip)}
              disabled={streaming}
              style={{
                background: T.white,
                border: `1px solid ${T.lightBorder}`,
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: T.lightText,
                cursor: streaming ? "default" : "pointer",
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Quick-prompt grid — only shows before the user has sent
          their first message, gives Kate's "ideas" without burning
          tokens. Disappears once the conversation is underway. */}
      {inferredChips.length === 0 && messages.length <= 1 && !streaming && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {QUICK_PROMPTS.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => send(q.prompt)}
                disabled={streaming}
                style={{
                  background: T.white,
                  border: `1px solid ${T.lightBorder}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: streaming ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  color: T.lightText,
                  transition: "border-color 150ms",
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: "rgba(22,119,255,0.10)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} color={T.electric} />
                </span>
                {q.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Conversation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>{m.content}</Bubble>
        ))}
        {streaming && messages[messages.length - 1]?.role !== "assistant" && (
          <TypingIndicator />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — pinned-feel; sits inline above the bottom nav. */}
      <form
        onSubmit={handleSubmit}
        style={{
          position: "sticky",
          bottom: 90,
          background: T.lightBg,
          paddingBottom: 12,
          borderTop: `1px solid ${T.lightBorder}`,
          paddingTop: 12,
        }}
      >
        <GlassCard padding={6}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Message Kate…"
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 14.5,
                color: T.lightText,
                padding: "8px 10px",
                fontFamily: "inherit",
                maxHeight: 120,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: "none",
                background: input.trim() && !streaming ? T.electric : T.lightBorder,
                color: T.white,
                cursor: input.trim() && !streaming ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 150ms",
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </GlassCard>
      </form>
    </BrandShell>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "84%",
          padding: "11px 14px",
          fontSize: 14.5,
          lineHeight: 1.5,
          borderRadius: isUser ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
          background: isUser ? T.electric : T.white,
          color: isUser ? T.white : T.lightText,
          border: isUser ? "none" : `1px solid ${T.lightBorder}`,
          boxShadow: isUser
            ? "0 4px 14px rgba(22,119,255,0.20)"
            : "0 2px 8px rgba(7,24,50,0.04)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div
        style={{
          padding: "12px 14px",
          background: T.white,
          border: `1px solid ${T.lightBorder}`,
          borderRadius: "20px 20px 20px 6px",
          display: "flex",
          gap: 4,
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
        background: T.lightMuted,
        display: "inline-block",
        animation: "typing-bounce 1.2s infinite",
        animationDelay: delay,
      }}
    />
  );
}
