"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { Send, CalendarPlus, FileText, Stethoscope, HelpCircle } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const QUICK_ACTIONS = [
  { label: "Book an appointment", prompt: "I need to book an appointment", icon: CalendarPlus },
  { label: "Summarize my plan", prompt: "Can you summarize my current health plan and what's pending?", icon: FileText },
  { label: "Prep for my next visit", prompt: "Help me prepare for my next upcoming appointment", icon: Stethoscope },
  { label: "What should I do next?", prompt: "What are the most important things I should do for my health right now?", icon: HelpCircle },
];

export default function KateChatButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (open && !hasGreeted && messages.length === 0) {
      setHasGreeted(true);
    }
  }, [open, hasGreeted, messages.length]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    try {
      const res = await apiFetch("/api/kate/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, page: pathname }),
      });

      if (!res.ok || !res.body) {
        setMessages([...newMessages, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I couldn't connect. Try again." }]);
    } finally {
      setStreaming(false);
    }
  }, [input, messages, streaming, pathname]);

  const sendQuickAction = useCallback(async (prompt: string) => {
    if (streaming) return;
    const userMsg: Message = { role: "user", content: prompt };
    const newMessages = [userMsg];
    setMessages(newMessages);
    setStreaming(true);

    try {
      const res = await apiFetch("/api/kate/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, page: pathname }),
      });

      if (!res.ok || !res.body) {
        setMessages([...newMessages, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I couldn't connect. Try again." }]);
    } finally {
      setStreaming(false);
    }
  }, [streaming, pathname]);

  // Listen for kate-quick-action events from other components
  useEffect(() => {
    function handleQuickAction(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) {
        setOpen(true);
        setTimeout(() => {
          sendQuickAction(detail.message);
        }, 100);
      }
    }
    window.addEventListener("kate-quick-action", handleQuickAction);
    return () => window.removeEventListener("kate-quick-action", handleQuickAction);
  }, [sendQuickAction]);

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Chat panel */}
      <div
        className={`fixed bottom-20 right-5 z-50 w-[380px] max-h-[520px] flex flex-col rounded-2xl border border-[#EBEDF0] bg-white shadow-2xl transition-all duration-300 ${
          open
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#EBEDF0]">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <text
                  x="7" y="11" textAnchor="middle" fontSize="12"
                  fontWeight="700" fontFamily="system-ui, sans-serif" fill="#D8E8F5"
                >K</text>
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-[#1A1D2E]">Kate</div>
              <div className="text-[10px] text-[#B0B4BC]">Your health assistant</div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-[#7A7F8A] hover:bg-[#F0F2F5]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: 360 }}>
          {messages.length === 0 && (
            <div className="py-4">
              <div className="text-sm text-[#1A1D2E] font-medium">
                Anything I can help you with today?
              </div>
              <div className="mt-1 text-xs text-[#7A7F8A]">
                Ask me anything, or try one of these:
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendQuickAction(action.prompt)}
                    disabled={streaming}
                    className="flex items-center gap-1.5 rounded-lg border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-1.5 text-xs text-[#1A1D2E] hover:bg-[#E8EBF0] transition disabled:opacity-50"
                  >
                    <action.icon size={13} strokeWidth={1.5} color="#5C6B5C" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-[#5C6B5C] text-white rounded-br-md"
                    : "bg-[#F0F2F5] text-[#1A1D2E] rounded-bl-md"
                }`}
              >
                {msg.content ? (
                  <div
                    className="whitespace-pre-wrap [&>p]:mb-2 [&>p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br />"),
                    }}
                  />
                ) : (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#5C6B5C] border-t-transparent" />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#EBEDF0] px-4 py-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask Kate anything..."
              disabled={streaming}
              className="flex-1 rounded-xl bg-[#F0F2F5] px-3.5 py-2.5 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C] disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
            >
              <Send size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating K button + label */}
      <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2" data-wizard="kate-chat">
        {!open && (
          <div className="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-[#1A1D2E] shadow-md border border-[#EBEDF0]">
            Let&apos;s chat
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition hover:brightness-95 active:scale-95 overflow-hidden"
          style={{
            boxShadow: "0 6px 20px rgba(74,90,74,0.4)",
          }}
        >
          {open ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </div>
          ) : (
            <img src="/kate-avatar.png" alt="Kate" className="h-14 w-14 rounded-full object-cover" />
          )}
        </button>
      </div>
    </>
  );
}
