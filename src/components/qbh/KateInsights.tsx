"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { ClipboardList, Search, Star, Zap, Lightbulb, Link2 } from "lucide-react";

type Insight = {
  id: string;
  type: string;
  title: string;
  body: string;
  action_label?: string | null;
  action_href?: string | null;
  priority: "high" | "medium" | "low";
  generated_at: string;
};

const priorityColor: Record<string, string> = {
  high: "#C03020",
  medium: "#5C6B5C",
  low: "#2A6090",
};

const insightIconMap: Record<string, React.ComponentType<any>> = {
  upcoming_prep: ClipboardList,
  care_gap: Search,
  encouragement: Star,
  action_needed: Zap,
  tip: Lightbulb,
  connection: Link2,
};

const priorityBorder: Record<string, string> = {
  high: "border-l-[#C03020]",
  medium: "border-l-[#5C6B5C]",
  low: "border-l-[#B0D0E8]",
};

/** Map insight type to a relevant Kate chat prompt */
function getChatPrompt(insight: Insight): string {
  const base = encodeURIComponent(insight.title);
  switch (insight.type) {
    case "upcoming_prep":
      return `/kate?prompt=Help me prepare for: ${base}`;
    case "care_gap":
      return `/kate?prompt=Tell me more about this care gap: ${base}`;
    case "action_needed":
      return `/kate?prompt=What should I do about: ${base}`;
    case "tip":
      return `/kate?prompt=Expand on this tip: ${base}`;
    case "encouragement":
      return `/kate?prompt=Tell me more about: ${base}`;
    case "connection":
      return `/kate?prompt=Help me with: ${base}`;
    default:
      return `/kate?prompt=Tell me more about: ${base}`;
  }
}

export default function KateInsights() {
  const router = useRouter();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const [hasBeenSeen, setHasBeenSeen] = useState(false);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await apiFetch("/api/kate/insights");
      const data = await res.json();
      if (data?.ok && data.insights?.length > 0) {
        setInsights(data.insights);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  async function dismissInsight(insightId: string) {
    // Start fade-out animation
    setDismissingIds((prev) => new Set(prev).add(insightId));

    // Wait for animation to finish
    setTimeout(() => {
      setInsights((prev) => prev.filter((i) => i.id !== insightId));
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(insightId);
        return next;
      });
    }, 300);

    await apiFetch("/api/kate/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insight_id: insightId, action: "dismiss" }),
    }).catch(() => {});
  }

  function handleInsightAction(insight: Insight) {
    if (insight.action_href) {
      router.push(insight.action_href);
    } else {
      router.push(getChatPrompt(insight));
    }
  }

  const [currentIndex, setCurrentIndex] = useState(0);

  if (loading || insights.length === 0) return null;

  const currentInsight = insights[currentIndex];
  if (!currentInsight) return null;

  if (minimized) {
    return (
      <div className="mt-4 px-7">
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 rounded-full bg-white border border-[#EBEDF0] px-4 py-2 text-xs font-medium text-[#5C6B5C] shadow-sm hover:shadow transition"
        >
          <Lightbulb size={14} strokeWidth={1.5} color="#5C6B5C" />
          Kate has a suggestion
        </button>
      </div>
    );
  }

  const IconComp = insightIconMap[currentInsight.type] || Lightbulb;
  const iconColor = priorityColor[currentInsight.priority] || "#5C6B5C";

  function handleNext() {
    dismissInsight(currentInsight.id);
    if (currentIndex < insights.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setMinimized(true);
    }
  }

  return (
    <div className="mt-4 px-7">
      <style jsx>{`
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        className="rounded-2xl bg-white border border-[#EBEDF0] shadow-md overflow-hidden cursor-pointer transition hover:shadow-lg"
        style={{ animation: "floatIn 0.5s ease-out both" }}
        onClick={() => handleInsightAction(currentInsight)}
      >
        {/* Thin color bar at top */}
        <div className="h-1" style={{ backgroundColor: iconColor }} />

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${iconColor}15` }}>
              <IconComp size={16} strokeWidth={1.5} color={iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#1A1D2E]">{currentInsight.title}</div>
              <div className="mt-1 text-xs text-[#7A7F8A] leading-relaxed">{currentInsight.body}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleInsightAction(currentInsight); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95"
                style={{ backgroundColor: "#5C6B5C" }}
              >
                {currentInsight.action_label || "Handle"}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#7A7F8A] hover:bg-[#F0F2F5] transition"
              >
                {currentIndex < insights.length - 1 ? "Next" : "Dismiss"}
              </button>
            </div>
            {insights.length > 1 && (
              <span className="text-[10px] text-[#B0B4BC]">
                {currentIndex + 1} of {insights.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
