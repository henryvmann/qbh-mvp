"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../../lib/api";

type Insight = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  action?: { label: string; href: string };
};

type KateWidgetProps = {
  userId: string;
};

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function computeInsights(data: {
  snapshots: any[];
  discoverySummary: { chargesAnalyzed: number };
  hasGoogleCalendarConnection: boolean;
}): Insight[] {
  const insights: Insight[] = [];
  const { snapshots, discoverySummary, hasGoogleCalendarConnection } = data;

  let overdueCount = 0;

  // 1. Overdue providers
  for (const s of snapshots) {
    if (s.followUpNeeded) {
      overdueCount++;
      let detail = "Time to schedule a follow-up.";
      if (s.lastVisitDate) {
        const months = monthsAgo(s.lastVisitDate);
        if (months > 0) {
          detail = `Last visit was ${months} month${months === 1 ? "" : "s"} ago. Time to schedule.`;
        }
      }
      insights.push({
        id: `overdue-${s.provider.id}`,
        icon: "⏰",
        title: `Overdue: ${s.provider.name}`,
        detail,
        priority: "high",
        action: { label: "View provider", href: "/dashboard" },
      });
    }
  }

  // 2. Upcoming appointments (BOOKED)
  for (const s of snapshots) {
    if (s.booking_state?.status === "BOOKED") {
      insights.push({
        id: `booked-${s.provider.id}`,
        icon: "📅",
        title: `Upcoming: ${s.provider.name}`,
        detail: s.booking_state.displayTime || "Appointment scheduled",
        priority: "medium",
      });
    }
  }

  // 3. In-progress bookings
  for (const s of snapshots) {
    if (s.booking_state?.status === "IN_PROGRESS") {
      insights.push({
        id: `inprogress-${s.provider.id}`,
        icon: "📞",
        title: `Booking in progress: ${s.provider.name}`,
        detail: "QB is working on scheduling this",
        priority: "medium",
      });
    }
  }

  // 4. Calendar not connected
  if (!hasGoogleCalendarConnection) {
    insights.push({
      id: "calendar-connect",
      icon: "🔗",
      title: "Connect your calendar",
      detail: "I can find free times in your schedule for appointments",
      priority: "medium",
      action: { label: "Connect", href: "/calendar-connect" },
    });
  }

  // 5. All caught up
  const allBooked = snapshots.length > 0 && snapshots.every(
    (s) => !s.followUpNeeded || s.booking_state?.status === "BOOKED"
  );
  if (overdueCount === 0 && allBooked && snapshots.length > 0) {
    insights.push({
      id: "all-caught-up",
      icon: "✨",
      title: "You're all caught up!",
      detail: "All your providers are current. I'll let you know if anything comes up.",
      priority: "low",
    });
  }

  // 6. Provider count summary
  if (snapshots.length > 0) {
    insights.push({
      id: "provider-summary",
      icon: "👥",
      title: `${snapshots.length} providers tracked`,
      detail: `${discoverySummary.chargesAnalyzed} charges analyzed from your records`,
      priority: "low",
    });
  }

  // Sort by priority
  insights.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return insights;
}

function monthsAgo(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return (
    (now.getFullYear() - then.getFullYear()) * 12 +
    (now.getMonth() - then.getMonth())
  );
}

export default function KateWidget({ userId }: KateWidgetProps) {
  const [open, setOpen] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(true);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/dashboard/data");
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const json = await res.json();
      if (json?.ok) {
        setInsights(computeInsights(json));
      }
    } catch {
      // silently fail — widget is supplementary
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  if (!authed) return null;

  const hasHighPriority = insights.some((i) => i.priority === "high");

  return (
    <>
      {/* Overlay to close panel when clicking outside */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="fixed bottom-6 right-6 z-50">
        {/* Expanded panel */}
        <div
          className={`absolute bottom-16 right-0 w-[360px] max-h-[480px] flex flex-col rounded-2xl border border-white/[0.08] bg-[#1A1D23] shadow-2xl transition-all duration-300 ${
            open
              ? "translate-y-0 opacity-100 pointer-events-auto"
              : "translate-y-4 opacity-0 pointer-events-none"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="text-base font-semibold text-[#F0F2F5]">Kate</h3>
              <p className="text-xs text-[#8A9BAE]">
                Here&apos;s what I&apos;m seeing
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-[#8A9BAE] hover:bg-white/5 hover:text-[#F0F2F5]"
              aria-label="Close Kate panel"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Insights list */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#7BA59A] border-t-transparent" />
              </div>
            ) : insights.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#8A9BAE]">
                No insights yet. Check back soon!
              </p>
            ) : (
              insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`rounded-xl bg-white/5 border border-white/[0.08] p-4 backdrop-blur-sm ${
                    insight.priority === "high" ? "border-l-2 border-l-amber-400" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-lg leading-none mt-0.5 shrink-0">
                      {insight.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#F0F2F5]">
                        {insight.title}
                      </div>
                      <div className="mt-1 text-xs text-[#8A9BAE]">
                        {insight.detail}
                      </div>
                      {insight.action && (
                        <a
                          href={insight.action.href}
                          className="mt-2 inline-block text-xs font-medium text-[#7BA59A] hover:underline"
                        >
                          {insight.action.label} &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Floating avatar button */}
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#7BA59A] shadow-lg transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#7BA59A]/50 focus:ring-offset-2 focus:ring-offset-[#1A1D23]"
          aria-label="Open Kate insights"
        >
          <span className="text-xl font-bold text-white leading-none">K</span>
          {/* Red notification dot */}
          {hasHighPriority && !open && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-500" />
            </span>
          )}
        </button>
      </div>
    </>
  );
}
