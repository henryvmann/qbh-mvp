"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type Goal = {
  id: string;
  title: string;
  status: "overdue" | "needs_attention" | "upcoming" | "pending";
  detail: string;
  category: string;
};

const statusConfig: Record<
  Goal["status"],
  { label: string; bgClass: string; textClass: string; ringClass: string }
> = {
  overdue: {
    label: "Overdue",
    bgClass: "bg-red-500/15",
    textClass: "text-red-400",
    ringClass: "ring-red-500/30",
  },
  needs_attention: {
    label: "Needs attention",
    bgClass: "bg-amber-500/15",
    textClass: "text-amber-400",
    ringClass: "ring-amber-500/30",
  },
  upcoming: {
    label: "Upcoming",
    bgClass: "bg-[#7BA59A]/15",
    textClass: "text-[#7BA59A]",
    ringClass: "ring-[#7BA59A]/30",
  },
  pending: {
    label: "Pending",
    bgClass: "bg-white/8",
    textClass: "text-[#8A9BAE]",
    ringClass: "ring-white/10",
  },
};

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/goals/data")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) setGoals(json.goals);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <main className="min-h-screen bg-[#1E2228]" />;
  }

  const grouped = {
    overdue: goals.filter((g) => g.status === "overdue"),
    needs_attention: goals.filter((g) => g.status === "needs_attention"),
    upcoming: goals.filter((g) => g.status === "upcoming"),
    pending: goals.filter((g) => g.status === "pending"),
  };

  const allSections: { key: Goal["status"]; title: string; items: Goal[] }[] = [
    { key: "overdue", title: "Overdue", items: grouped.overdue },
    {
      key: "needs_attention",
      title: "Needs Attention",
      items: grouped.needs_attention,
    },
    { key: "upcoming", title: "Upcoming", items: grouped.upcoming },
    { key: "pending", title: "Pending", items: grouped.pending },
  ];
  const sections = allSections.filter((s) => s.items.length > 0);

  return (
    <main className="min-h-screen bg-[#1E2228] text-[#F0F2F5]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-[#F0F2F5]">
              Goals
            </h1>
            <p className="mt-2 max-w-2xl text-base text-[#8A9BAE]">
              Goals help QBH prioritize what matters most, then connect those
              priorities to scheduling, follow-ups, and care coordination.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/8 bg-white/5 px-4 py-2 text-sm font-medium text-[#8A9BAE] shadow-sm hover:bg-[#162030]"
          >
            Back to Dashboard
          </Link>
        </div>

        {goals.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-white/5 p-6 ring-1 ring-[rgba(255,255,255,0.08)]">
            <div className="font-semibold text-[#F0F2F5]">
              No goals right now
            </div>
            <p className="mt-2 text-sm text-[#8A9BAE]">
              As QBH discovers providers and tracks visits, goals will appear
              here automatically.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {sections.map((section) => (
              <section key={section.key}>
                <h2 className="mb-4 font-serif text-xl text-[#F0F2F5]">
                  {section.title}
                </h2>
                <div className="space-y-4">
                  {section.items.map((goal) => {
                    const cfg = statusConfig[goal.status];
                    return (
                      <div
                        key={goal.id}
                        className="rounded-2xl bg-white/5 p-5 ring-1 ring-[rgba(255,255,255,0.08)]"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="font-semibold text-[#F0F2F5]">
                            {goal.title}
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cfg.bgClass} ${cfg.textClass} ${cfg.ringClass}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-[#8A9BAE]">
                          {goal.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
