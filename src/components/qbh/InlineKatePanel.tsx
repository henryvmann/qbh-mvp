"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { T } from "../brand";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  /** Provider this conversation is anchored to. Used to seed Kate's
   *  first message with concrete context ("I see your provider X..."). */
  provider: { id: string; name: string };
  /** Optional human-readable "last seen" descriptor — used in the
   *  greeting so Kate's opener mentions actual recency. */
  recencyHint?: string | null;
  /** Initial canned message Kate auto-sends on open. If omitted, an
   *  appropriate default is generated from the provider name + recency. */
  initialPrompt?: string;
  onClose: () => void;
};

// Compact in-place Kate chat panel that lives inside a host card on the
// dashboard. Replaces the prior "Tell me what would help" → /kate
// navigation: the user stays in context and Kate opens with a concrete,
// provider-anchored greeting instead of a blank chat surface.
export default function InlineKatePanel({ provider, recencyHint, initialPrompt, onClose }: Props) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentOpenerRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = useCallback(
    async (text: string, isOpener = false) => {
      const userMsg: Message = { role: "user", content: text };
      const baseline = isOpener ? [] : messages;
      const newMessages = isOpener ? [userMsg] : [...baseline, userMsg];
      if (!isOpener) setMessages(newMessages);
      // Opener doesn't render as a user bubble — it's an implicit context
      // setup. Kate's response is what the user sees first.
      const visibleStart = isOpener ? [] : newMessages;
      if (isOpener) setMessages([{ role: "assistant", content: "" }]);
      setStreaming(true);
      try {
        const res = await apiFetch("/api/kate/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages, page: pathname }),
        });
        if (!res.ok || !res.body) {
          setMessages([...visibleStart, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        setMessages([...visibleStart, { role: "assistant", content: "" }]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          setMessages([...visibleStart, { role: "assistant", content: assistantContent }]);
        }
      } catch {
        setMessages([...visibleStart, { role: "assistant", content: "Sorry, I couldn't connect. Try again." }]);
      } finally {
        setStreaming(false);
      }
    },
    [messages, pathname]
  );

  // Fire the opener exactly once when the panel mounts. Kate gets a
  // primed first user message that anchors her response to the provider
  // (and how long it's been), so she doesn't start cold.
  useEffect(() => {
    if (sentOpenerRef.current) return;
    sentOpenerRef.current = true;
    const opener =
      initialPrompt ||
      (recencyHint
        ? `I'd like help with my appointment for ${provider.name}. It's been ${recencyHint}. What would make this easier?`
        : `I'd like help with ${provider.name}. What would make this easier?`);
    send(opener, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    send(text);
  }

  return (
    <div
      style={{
        marginTop: 12,
        background: "white",
        border: `1px solid ${T.lightBorder}`,
        borderRadius: 14,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.lightMuted }}>
          Kate · {provider.name}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Kate"
          style={{
            background: "transparent",
            border: "none",
            color: T.lightMuted,
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ×
        </button>
      </div>

      <div
        ref={scrollRef}
        style={{
          maxHeight: 260,
          minHeight: 80,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingRight: 2,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "8px 12px",
              borderRadius: 14,
              background: m.role === "user" ? T.electric : "#F0F2F5",
              color: m.role === "user" ? T.white : T.lightText,
              fontSize: 13,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              borderBottomRightRadius: m.role === "user" ? 4 : 14,
              borderBottomLeftRadius: m.role === "assistant" ? 4 : 14,
            }}
          >
            {m.content ? (
              <span
                dangerouslySetInnerHTML={{
                  __html: m.content
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\n/g, "<br/>"),
                }}
              />
            ) : (
              <span
                aria-label="Kate is typing"
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: `2px solid ${T.electric}`,
                  borderTopColor: "transparent",
                  animation: "qbh-spin 0.9s linear infinite",
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask Kate anything..."
          disabled={streaming}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 10,
            border: `1px solid ${T.lightBorder}`,
            background: "#F8F9FB",
            fontSize: 13,
            color: T.lightText,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: T.electric,
            color: T.white,
            fontSize: 13,
            fontWeight: 600,
            cursor: !input.trim() || streaming ? "not-allowed" : "pointer",
            opacity: !input.trim() || streaming ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>

      <style jsx>{`
        @keyframes qbh-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
