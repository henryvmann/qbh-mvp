"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../../components/qbh/TopNav";
import { apiFetch } from "../../lib/api";
import { Rocket, Building2, CalendarCheck, BarChart3, Target, Link as LinkIcon, Star, Trophy, Check } from "lucide-react";

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
  icon: IconComp,
  title,
  description,
  earned,
}: {
  icon: React.ComponentType<any>;
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
      <IconComp size={24} strokeWidth={1.5} color={earned ? "#5C6B5C" : "#B0B4BC"} />
      <div>
        <div className={`text-sm font-semibold ${earned ? "text-[#1A1D2E]" : "text-[#B0B4BC]"}`}>
          {title}
        </div>
        <div className="text-xs text-[#7A7F8A]">{description}</div>
      </div>
      {earned && (
        <span className="ml-auto">
          <Check size={16} strokeWidth={2} color="#5C6B5C" />
        </span>
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
    { icon: Rocket, title: "Getting Started", description: "Created your account", earned: true },
    { icon: Building2, title: "Provider Tracker", description: "Added your first provider", earned: data.providerCount > 0 },
    { icon: CalendarCheck, title: "First Booking", description: "Booked your first appointment", earned: data.bookedCount > 0 },
    { icon: BarChart3, title: "Health Historian", description: "5+ past visits tracked", earned: data.visitCount >= 5 },
    { icon: Target, title: "Goal Setter", description: "Set your first health goal", earned: data.goalsTotal > 0 },
    { icon: LinkIcon, title: "Connected", description: "Connected your calendar", earned: data.calendarConnected },
    { icon: Star, title: "On Track", description: "All providers current", earned: data.overdueCount === 0 && data.providerCount > 0 },
    { icon: Trophy, title: "Health Champion", description: "10+ providers tracked", earned: data.providerCount >= 10 },
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
        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatCard value={data.providerCount} label="Providers" color="#5C6B5C" />
          <StatCard value={data.bookedCount} label="Appointments" color="#2A6090" />
          <StatCard value={data.visitCount} label="Past Visits" color="#5C4A8A" />
        </div>

        {/* Kate's Health Summary */}
        <div className="mt-6 rounded-2xl bg-[#5C6B5C]/5 border border-[#5C6B5C]/10 p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-[#5C6B5C] mb-3">
            Your Health Summary
          </div>
          <div className="space-y-2 text-sm text-[#1A1D2E]">
            {data.providerCount === 0 ? (
              <p>You haven&apos;t added any providers yet. Start building your care team to get the most out of Quarterback.</p>
            ) : (
              <>
                <p>
                  You have <strong>{data.providerCount - data.pharmacyCount}</strong> provider{data.providerCount - data.pharmacyCount !== 1 ? "s" : ""} on your care team
                  {data.pharmacyCount > 0 ? ` and ${data.pharmacyCount} pharmac${data.pharmacyCount !== 1 ? "ies" : "y"}` : ""}.
                  {data.overdueCount > 0
                    ? ` ${data.overdueCount} ${data.overdueCount === 1 ? "is" : "are"} overdue for a visit.`
                    : " Everyone is current."}
                </p>
                {data.bookedCount > 0 && (
                  <p>You have <strong>{data.bookedCount}</strong> upcoming appointment{data.bookedCount !== 1 ? "s" : ""} scheduled.</p>
                )}
                {data.visitCount > 0 && (
                  <p>Kate has tracked <strong>{data.visitCount}</strong> past visit{data.visitCount !== 1 ? "s" : ""} across your providers.</p>
                )}
                {!data.calendarConnected && (
                  <p>Connect your calendar so Kate can check for scheduling conflicts.</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Achievements — grouped: Earned first, then Outstanding */}
        {(() => {
          const earned = achievements.filter((a) => a.earned);
          const outstanding = achievements.filter((a) => !a.earned);
          const actionLinks: Record<string, string> = {
            "First Booking": "/providers",
            "Health Historian": "/visits",
            "Goal Setter": "/goals",
            "Connected": "/calendar-connect",
            "On Track": "/providers",
            "Health Champion": "/providers?add=true",
          };

          return (
            <>
              {earned.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#5C6B5C] mb-3">
                    Earned — {earned.length} of {achievements.length}
                  </div>
                  <div className="space-y-2">
                    {earned.map((a) => (
                      <AchievementBadge key={a.title} icon={a.icon} title={a.title} description={a.description} earned />
                    ))}
                  </div>
                </div>
              )}

              {outstanding.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC] mb-3">
                    Still To Earn
                  </div>
                  <div className="space-y-2">
                    {outstanding.map((a) => (
                      <div key={a.title} className="flex items-center gap-3">
                        <div className="flex-1">
                          <AchievementBadge icon={a.icon} title={a.title} description={a.description} earned={false} />
                        </div>
                        {actionLinks[a.title] && (
                          <a
                            href={actionLinks[a.title]}
                            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                            style={{ backgroundColor: "#5C6B5C" }}
                          >
                            Go
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </main>
  );
}
