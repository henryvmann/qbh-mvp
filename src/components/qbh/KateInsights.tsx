"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

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

const priorityIcon: Record<string, string> = {
  upcoming_prep: "📋",
  care_gap: "🔍",
  encouragement: "🌟",
  action_needed: "⚡",
  tip: "💡",
  connection: "🔗",
};

const priorityBorder: Record<string, string> = {
  high: "border-l-[#C03020]",
  medium: "border-l-[#5C6B5C]",
  low: "border-l-[#B0D0E8]",
};

export default function KateInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);

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
    setInsights((prev) => prev.filter((i) => i.id !== insightId));
    await apiFetch("/api/kate/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insight_id: insightId, action: "dismiss" }),
    }).catch(() => {});
  }

  if (loading || insights.length === 0) return null;

  if (minimized) {
    return (
      <div className="mt-6 px-7">
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 text-xs font-medium text-[#5C6B5C] hover:underline"
        >
          <span>💡</span>
          Kate has {insights.length} insight{insights.length !== 1 ? "s" : ""} for you
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 px-7">
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
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="text-xs text-[#B0B4BC] hover:text-[#7A7F8A]"
        >
          Minimize
        </button>
      </div>

      <div className="space-y-2.5">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`rounded-xl bg-white border border-[#EBEDF0] border-l-[3px] ${priorityBorder[insight.priority] || ""} p-4 shadow-sm`}
          >
            <div className="flex items-start gap-3">
              <span className="text-base mt-0.5 shrink-0">
                {priorityIcon[insight.type] || "💡"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#1A1D2E]">
                  {insight.title}
                </div>
                <div className="mt-1 text-xs text-[#7A7F8A] leading-relaxed">
                  {insight.body}
                </div>
                {insight.action_label && insight.action_href && (
                  <Link
                    href={insight.action_href}
                    className="mt-2 inline-block text-xs font-semibold text-[#5C6B5C] hover:underline"
                  >
                    {insight.action_label} →
                  </Link>
                )}
              </div>
              <button
                onClick={() => dismissInsight(insight.id)}
                className="shrink-0 rounded p-1 text-[#B0B4BC] hover:text-[#7A7F8A] hover:bg-[#F0F2F5]"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
