"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { apiFetch } from "../../lib/api";

const PAGE_PROMPTS: Record<string, string> = {
  "/providers": "Looking at the user's providers page. Give ONE brief, contextual observation (1 sentence max). Examples: note a missing provider type, mention if someone is overdue, or encourage them if they're on track. Be specific to their actual data.",
  "/visits": "Looking at the user's visits page. Give ONE brief observation (1 sentence). Examples: mention an upcoming appointment to prep for, note how long since their last visit, or suggest booking if overdue.",
  "/goals": "Looking at the user's goals page. Give ONE brief motivational observation (1 sentence). Reference their actual goals or suggest one based on their providers.",
  "/timeline": "Looking at the user's health timeline. Give ONE brief observation connecting their health story (1 sentence). Reference real providers or visits.",
  "/settings": "Looking at the user's settings. Give ONE brief suggestion (1 sentence) about what to update or complete in their profile.",
  "/calendar-view": "Looking at the user's calendar. Give ONE brief observation (1 sentence) about their upcoming schedule or suggest connecting a calendar if not connected.",
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
    const cacheKey = `kate_page_insight_${pathname}`;
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
        // Take only the first sentence
        const firstSentence = text.split(/[.!?]\s/)[0] + (text.match(/[.!?]/) ? text.match(/[.!?]/)![0] : ".");
        const clean = firstSentence.slice(0, 200);
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
