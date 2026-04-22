"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { apiFetch } from "../../lib/api";

const PAGE_PROMPTS: Record<string, string> = {
  "/providers": "You are on the providers page. In EXACTLY one short sentence (under 15 words), note something about their providers. Do NOT elaborate.",
  "/visits": "You are on the visits page. In EXACTLY one short sentence (under 15 words), note something about their visits. Do NOT elaborate.",
  "/goals": "You are on the goals page. In EXACTLY one short sentence (under 15 words), give a motivational nudge. Do NOT elaborate.",
  "/timeline": "You are on the timeline page. In EXACTLY one short sentence (under 15 words), connect something in their health story. Do NOT elaborate.",
  "/settings": "You are on settings. In EXACTLY one short sentence (under 15 words), suggest what to update. Do NOT elaborate.",
  "/calendar-view": "You are on the calendar. In EXACTLY one short sentence (under 15 words), note something about their schedule. Do NOT elaborate.",
  "/dashboard": "",
};

export default function KatePageInsight() {
  const pathname = usePathname();
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const prompt = PAGE_PROMPTS[pathname];
    if (!prompt) return;

    // Don't re-fetch on every render
    const cacheKey = `kate_page_insight_v3_${pathname}`;
    // Clear old cache keys
    try { sessionStorage.removeItem(`kate_page_insight_${pathname}`); } catch {}
    try { sessionStorage.removeItem(`kate_page_insight_v2_${pathname}`); } catch {}
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setInsight(cached);
      return;
    }

    setLoading(true);
    apiFetch("/api/kate/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        page: pathname,
      }),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
        }
        // Use the full response — don't truncate
        const clean = text.trim();
        setInsight(clean);
        sessionStorage.setItem(cacheKey, clean);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pathname]);

  if (!insight || dismissed || loading) return null;

  return (
    <div className="mt-6 mb-2 rounded-2xl bg-[#5C6B5C]/5 border border-[#5C6B5C]/10 px-5 py-4">
      <div className="flex items-start gap-3">
        <Image
          src="/kate-avatar.png"
          alt="Kate"
          width={28}
          height={28}
          className="rounded-full shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#1A1D2E] leading-relaxed">{insight}</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-[#B0B4BC] hover:text-[#7A7F8A]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
