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

  if (loading || insights.length === 0) return null;

  if (minimized) {
    return (
      <div className="mt-6 px-7">
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 text-xs font-medium text-[#5C6B5C] hover:underline"
        >
          <Lightbulb size={14} strokeWidth={1.5} color="#5C6B5C" />
          Kate has {insights.length} insight{insights.length !== 1 ? "s" : ""} for you
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 px-7">
      <style jsx>{`
        @keyframes insightSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes insightFadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-10px);
          }
        }
        @keyframes pulsingDot {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
          >
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
              <text x="7" y="11" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="system-ui" fill="#D8E8F5">K</text>
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#7A7F8A]">
            Kate&apos;s Insights
          </span>
          {/* Pulsing dot for unread insights */}
          {insights.length > 0 && (
            <span
              className="inline-block h-2 w-2 rounded-full bg-[#5C6B5C]"
              style={{ animation: "pulsingDot 2s ease-in-out infinite" }}
            />
          )}
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="text-xs text-[#B0B4BC] hover:text-[#7A7F8A]"
        >
          Minimize
        </button>
      </div>

      <div className="space-y-2.5">
        {insights.map((insight, index) => {
          const isDismissing = dismissingIds.has(insight.id);

          return (
            <div
              key={insight.id}
              onClick={() => handleInsightAction(insight)}
              className={`rounded-xl bg-white border border-[#EBEDF0] border-l-[3px] ${priorityBorder[insight.priority] || ""} p-4 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md`}
              style={{
                animation: isDismissing
                  ? "insightFadeOut 0.3s ease-out forwards"
                  : `insightSlideIn 0.3s ease-out ${index * 100}ms both`,
                transform: "translateY(0)",
              }}
              onMouseEnter={(e) => {
                if (!isDismissing) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isDismissing) {
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">
                  {(() => {
                    const IconComp = insightIconMap[insight.type] || Lightbulb;
                    return <IconComp size={18} strokeWidth={1.5} color={priorityColor[insight.priority] || "#5C6B5C"} />;
                  })()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1A1D2E]">
                    {insight.title}
                  </div>
                  <div className="mt-1 text-xs text-[#7A7F8A] leading-relaxed">
                    {insight.body}
                  </div>
                  {/* Handle and Dismiss buttons */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInsightAction(insight);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95"
                      style={{ backgroundColor: "#5C6B5C" }}
                    >
                      {insight.action_label || "Handle"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissInsight(insight.id);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#7A7F8A] transition hover:bg-[#F0F2F5]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
