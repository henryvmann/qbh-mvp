"use client";

/**
 * Multi-card insights list — Kate's read on the user's week. Used at
 * the top of /goals as the canonical "what Kate's noticing" surface.
 * The standalone /insights route redirects here.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { T } from "../brand";
import { Lightbulb, Calendar, AlertCircle, Heart, Sparkles, Link2, X, RefreshCw } from "lucide-react";

type Insight = {
  id: string;
  type: string;
  title: string;
  body: string;
  action_label: string | null;
  action_href: string | null;
  priority: "high" | "medium" | "low";
  generated_at: string;
};

const TYPE_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  upcoming_prep: Calendar,
  care_gap: AlertCircle,
  encouragement: Heart,
  action_needed: AlertCircle,
  tip: Lightbulb,
  connection: Link2,
};

const PRIORITY_BG: Record<Insight["priority"], string> = {
  high: "rgba(224,64,48,0.06)",
  medium: "rgba(22,119,255,0.06)",
  low: "rgba(39,196,107,0.06)",
};
const PRIORITY_BORDER: Record<Insight["priority"], string> = {
  high: "rgba(224,64,48,0.20)",
  medium: "rgba(22,119,255,0.18)",
  low: "rgba(39,196,107,0.18)",
};
const PRIORITY_ACCENT: Record<Insight["priority"], string> = {
  high: T.red,
  medium: T.electric,
  low: T.green,
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export default function KateInsightsList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);

  const refresh = useCallback(async () => {
    const r = await apiFetch("/api/kate/insights");
    if (r.status === 401) {
      router.push("/login");
      return;
    }
    const j = await r.json().catch(() => ({}));
    if (j?.ok) setInsights(j.insights ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function dismiss(id: string) {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    try {
      await apiFetch("/api/kate/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insight_id: id, action: "dismiss" }),
      });
    } catch {
      // Optimistic — if the server fails the insight will reappear on next refresh.
    }
  }

  const sorted = [...insights].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );

  if (loading) return null;
  if (sorted.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: T.electric,
              marginBottom: 2,
            }}
          >
            Kate&rsquo;s read on your week
          </div>
          <div style={{ fontSize: 13, color: T.lightMuted }}>
            Patterns and prep she&rsquo;s noticed. Tap one, or swipe it away.
          </div>
        </div>
        <button
          onClick={() => {
            setRefreshing(true);
            refresh();
          }}
          disabled={refreshing}
          aria-label="Refresh insights"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            background: "rgba(22,119,255,0.08)",
            color: T.electric,
            border: `1px solid ${T.lightBorder}`,
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            cursor: refreshing ? "default" : "pointer",
            opacity: refreshing ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((ins) => {
          const Icon = TYPE_ICON[ins.type] ?? Lightbulb;
          return (
            <div
              key={ins.id}
              style={{
                background: PRIORITY_BG[ins.priority],
                border: `1px solid ${PRIORITY_BORDER[ins.priority]}`,
                borderRadius: 16,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      flexShrink: 0,
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      background: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: PRIORITY_ACCENT[ins.priority],
                      border: `1px solid ${PRIORITY_BORDER[ins.priority]}`,
                    }}
                  >
                    <Icon size={15} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.lightText, marginBottom: 2 }}>
                      {ins.title}
                    </div>
                    <div style={{ fontSize: 13, color: T.lightMuted, lineHeight: 1.5 }}>
                      {ins.body}
                    </div>
                  </div>
                </div>
                <button
                  aria-label="Dismiss"
                  onClick={() => dismiss(ins.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: T.lightMuted,
                    cursor: "pointer",
                    padding: 4,
                    flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              {ins.action_label && ins.action_href && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Link
                    href={ins.action_href}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "6px 12px",
                      background: PRIORITY_ACCENT[ins.priority],
                      color: "white",
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    {ins.action_label}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
