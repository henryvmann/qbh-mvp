"use client";

/**
 * /insights — Kate's read on the user's health data. Distinct from
 * /goals (what to work on, the user's choices) — the reviewer was
 * specific that these should NOT be conflated.
 *
 * Insights pull from kate_insights, which is generated daily from:
 *   - upcoming appointments (prep cards)
 *   - care gaps (missing provider types, overdue cadence)
 *   - patterns across visit history + lab/document data when present
 *   - encouragements
 *
 * Goals stay on /goals. This page reads, doesn't write — the user
 * can dismiss insights but doesn't author them.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import { T } from "../../components/brand";
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

export default function InsightsPage() {
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
      // Optimistic — if the server fails, the insight will reappear
      // on next refresh, which is acceptable for this surface.
    }
  }

  // Sort high → medium → low so the most actionable cards land first.
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
  const sorted = [...insights].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );

  return (
    <PageShell maxWidth="max-w-2xl">
      <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 60 }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: T.lightText, marginBottom: 8 }}>
              Insights
            </h1>
            <p style={{ color: T.lightMuted, fontSize: 16, lineHeight: 1.5, maxWidth: 520 }}>
              Kate's read on your week — appointments to prep for, gaps in
              your care, patterns in your visits and records. Tap into any
              one, or swipe it away.
            </p>
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
              padding: "8px 12px",
              background: "rgba(22,119,255,0.08)",
              color: T.electric,
              border: `1px solid ${T.lightBorder}`,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: refreshing ? "default" : "pointer",
              opacity: refreshing ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        {loading ? (
          <div style={{ color: T.lightMuted, fontSize: 14 }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              border: `1px dashed ${T.lightBorder}`,
              borderRadius: 14,
              padding: 32,
              textAlign: "center",
              color: T.lightMuted,
              fontSize: 14,
            }}
          >
            <Sparkles size={28} color={T.lightMuted} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 600, color: T.lightText, marginBottom: 4 }}>
              All clear right now
            </div>
            Kate's not seeing anything that needs your attention. Refresh later for a new read.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sorted.map((ins) => {
              const Icon = TYPE_ICON[ins.type] ?? Lightbulb;
              return (
                <div
                  key={ins.id}
                  style={{
                    background: PRIORITY_BG[ins.priority],
                    border: `1px solid ${PRIORITY_BORDER[ins.priority]}`,
                    borderRadius: 16,
                    padding: 16,
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
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          background: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: PRIORITY_ACCENT[ins.priority],
                          border: `1px solid ${PRIORITY_BORDER[ins.priority]}`,
                        }}
                      >
                        <Icon size={16} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: T.lightText, marginBottom: 2 }}>
                          {ins.title}
                        </div>
                        <div style={{ fontSize: 13.5, color: T.lightMuted, lineHeight: 1.5 }}>
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
        )}

      </div>
    </PageShell>
  );
}
