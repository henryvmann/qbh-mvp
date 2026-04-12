"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../../components/qbh/TopNav";
import { apiFetch } from "../../lib/api";

type AnalyticsData = {
  providerCount: number;
  pharmacyCount: number;
  bookedCount: number;
  overdueCount: number;
  visitCount: number;
  goalsOnTrack: number;
  goalsTotal: number;
  healthScore: number;
  daysSinceSignup: number;
  calendarConnected: boolean;
};

function StatCard({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-5 min-h-[110px]">
      <div className="text-3xl font-extralight" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-xs font-semibold" style={{ color: `${color}CC` }}>
        {label}
      </div>
    </div>
  );
}

function AchievementBadge({
  icon,
  title,
  description,
  earned,
}: {
  icon: string;
  title: string;
  description: string;
  earned: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-4 transition ${
        earned
          ? "bg-white border-[#5C6B5C]/20 shadow-sm"
          : "bg-[#F0F2F5] border-[#EBEDF0] opacity-50"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <div className={`text-sm font-semibold ${earned ? "text-[#1A1D2E]" : "text-[#B0B4BC]"}`}>
          {title}
        </div>
        <div className="text-xs text-[#7A7F8A]">{description}</div>
      </div>
      {earned && (
        <span className="ml-auto text-xs font-semibold text-[#5C6B5C]">✓</span>
      )}
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-[#EBEDF0]">
      <div
        className="h-2 rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/dashboard/data").then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      }),
      apiFetch("/api/goals/data").then((r) => r.json()).catch(() => null),
    ]).then(([dashData, goalsData]) => {
      if (!dashData?.ok) return;

      const snapshots = dashData.snapshots || [];
      const goals = goalsData?.goals || [];

      const pharmacyCount = snapshots.filter((s: any) => s.provider.provider_type === "pharmacy").length;
      const nonPharmacy = snapshots.filter((s: any) => s.provider.provider_type !== "pharmacy");
      const overdueCount = nonPharmacy.filter((s: any) => s.followUpNeeded).length;
      const bookedCount = nonPharmacy.filter((s: any) => s.booking_state?.status === "BOOKED").length;

      // Estimate days since signup from oldest visit or just default
      const daysSinceSignup = 30; // TODO: pull from app_users.created_at

      setData({
        providerCount: snapshots.length,
        pharmacyCount,
        bookedCount,
        overdueCount,
        visitCount: nonPharmacy.reduce((sum: number, s: any) => sum + (s.visitCount || 0), 0),
        goalsOnTrack: goals.filter((g: any) => g.progress >= 50).length,
        goalsTotal: goals.length,
        healthScore: goalsData?.healthScore || 0,
        daysSinceSignup,
        calendarConnected: dashData.hasGoogleCalendarConnection,
      });
    }).finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  if (!data) return null;

  const achievements = [
    { icon: "🚀", title: "Getting Started", description: "Created your account", earned: true },
    { icon: "🏥", title: "Provider Tracker", description: "Added your first provider", earned: data.providerCount > 0 },
    { icon: "📅", title: "First Booking", description: "Booked your first appointment", earned: data.bookedCount > 0 },
    { icon: "📊", title: "Health Historian", description: "5+ past visits tracked", earned: data.visitCount >= 5 },
    { icon: "🎯", title: "Goal Setter", description: "Set your first health goal", earned: data.goalsTotal > 0 },
    { icon: "🔗", title: "Connected", description: "Connected your calendar", earned: data.calendarConnected },
    { icon: "⭐", title: "On Track", description: "All providers current", earned: data.overdueCount === 0 && data.providerCount > 0 },
    { icon: "🏆", title: "Health Champion", description: "10+ providers tracked", earned: data.providerCount >= 10 },
  ];

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <TopNav />
      <div className="mx-auto max-w-2xl px-6 pt-8 pb-20">
        <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E]">
          Your Progress
        </h1>
        <p className="mt-1 text-sm text-[#7A7F8A]">
          Track your health journey and celebrate milestones
        </p>

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <StatCard value={data.providerCount} label="Providers" color="#5C6B5C" />
          <StatCard value={data.bookedCount} label="Appointments" color="#2A6090" />
          <StatCard value={data.visitCount} label="Past Visits" color="#5C4A8A" />
          <StatCard value={`${data.healthScore}%`} label="Health Score" color={data.healthScore >= 70 ? "#5C6B5C" : data.healthScore >= 40 ? "#B8A020" : "#C03020"} />
        </div>

        {/* Goals progress */}
        <div className="mt-6 rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-[#1A1D2E]">Goals Progress</div>
            <span className="text-xs text-[#7A7F8A]">
              {data.goalsOnTrack} of {data.goalsTotal} on track
            </span>
          </div>
          <ProgressBar value={data.goalsOnTrack} max={data.goalsTotal || 1} color="#5C6B5C" />

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-[#1A1D2E]">Care Coverage</div>
            <span className="text-xs text-[#7A7F8A]">
              {data.providerCount - data.overdueCount} of {data.providerCount - data.pharmacyCount} current
            </span>
          </div>
          <ProgressBar
            value={data.providerCount - data.pharmacyCount - data.overdueCount}
            max={data.providerCount - data.pharmacyCount || 1}
            color="#2A6090"
          />
        </div>

        {/* Achievements */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC]">
              Achievements
            </div>
            <span className="text-xs text-[#7A7F8A]">
              {earnedCount} of {achievements.length} earned
            </span>
          </div>
          <div className="space-y-2">
            {achievements.map((a) => (
              <AchievementBadge
                key={a.title}
                icon={a.icon}
                title={a.title}
                description={a.description}
                earned={a.earned}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
