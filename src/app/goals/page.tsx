"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import HandleItButton from "../../components/qbh/HandleItButton";

/* ---------- types ---------- */

type GoalCategory =
  | "overdue"
  | "preventive"
  | "medications"
  | "upcoming"
  | "setup";

type Goal = {
  id: string;
  title: string;
  category: GoalCategory;
  progress: number;
  detail: string;
  providerName?: string;
  providerId?: string;
};

type UserGoal = {
  id: string;
  title: string;
  progress: number;
};

/* ---------- category config ---------- */

const categoryConfig: Record<
  GoalCategory,
  { label: string; sectionTitle: string; color: string }
> = {
  overdue: {
    label: "Overdue",
    sectionTitle: "Overdue Care",
    color: "#E04030",
  },
  preventive: {
    label: "Preventive",
    sectionTitle: "Preventive Care",
    color: "#7BA59A",
  },
  medications: {
    label: "Medications",
    sectionTitle: "Medications",
    color: "#9078C8",
  },
  upcoming: {
    label: "Upcoming",
    sectionTitle: "Upcoming",
    color: "#E2F0A0",
  },
  setup: {
    label: "Setup",
    sectionTitle: "Setup",
    color: "#B0D4F0",
  },
};

const categoryOrder: GoalCategory[] = [
  "overdue",
  "preventive",
  "medications",
  "upcoming",
  "setup",
];

/* ---------- Mini arc gauge ---------- */

function MiniGauge({ value, color }: { value: number; color: string }) {
  const r = 30;
  const circ = Math.PI * r;
  const filled = (Math.min(Math.max(value, 0), 100) / 100) * circ;
  return (
    <svg width={80} height={45} viewBox="0 0 80 45">
      <path
        d="M 5 40 A 30 30 0 0 1 75 40"
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 5 40 A 30 30 0 0 1 75 40"
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        className="transition-all duration-700"
      />
      <text
        x={40}
        y={35}
        textAnchor="middle"
        fill="#F0F2F5"
        fontSize={14}
        fontWeight="300"
      >
        {value}%
      </text>
    </svg>
  );
}

/* ---------- Hero arc gauge ---------- */

function HeroGauge({ score }: { score: number }) {
  const r = 80;
  const circ = Math.PI * r;
  const filled = (Math.min(Math.max(score, 0), 100) / 100) * circ;

  let color = "#7BA59A"; // sage (high)
  if (score < 40) color = "#E04030"; // coral (low)
  else if (score < 70) color = "#C8D84A"; // lime-ish (medium)

  return (
    <div className="flex flex-col items-center">
      <svg width={200} height={115} viewBox="0 0 200 115">
        <path
          d="M 10 105 A 80 80 0 0 1 190 105"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <path
          d="M 10 105 A 80 80 0 0 1 190 105"
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          className="transition-all duration-1000"
        />
        <text
          x={100}
          y={85}
          textAnchor="middle"
          fill="#F0F2F5"
          fontSize={40}
          fontWeight="300"
        >
          {score}%
        </text>
        <text
          x={100}
          y={108}
          textAnchor="middle"
          fill="#8A9BAE"
          fontSize={13}
          fontWeight="400"
        >
          Health Score
        </text>
      </svg>
    </div>
  );
}

/* ---------- page ---------- */

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userGoals, setUserGoals] = useState<UserGoal[]>([]);
  const [healthScore, setHealthScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newGoalText, setNewGoalText] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ title: string; detail: string }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fetchGoals = useCallback(() => {
    apiFetch("/api/goals/data")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) {
          setGoals(json.goals ?? []);
          setUserGoals(json.userGoals ?? []);
          setHealthScore(json.healthScore ?? 0);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  async function handleAddGoal() {
    const title = newGoalText.trim();
    if (!title || addingGoal) return;
    setAddingGoal(true);
    try {
      const res = await apiFetch("/api/goals/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = await res.json();
      if (json?.ok) {
        setNewGoalText("");
        fetchGoals();
      }
    } finally {
      setAddingGoal(false);
    }
  }

  async function handleGetSuggestions() {
    const input = newGoalText.trim();
    if (!input || loadingSuggestions) return;
    setLoadingSuggestions(true);
    setAiSuggestions([]);
    try {
      const res = await apiFetch("/api/goals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const json = await res.json();
      if (json?.ok && json.goals) {
        setAiSuggestions(json.goals);
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function handleAddSuggestion(title: string) {
    setAddingGoal(true);
    try {
      const res = await apiFetch("/api/goals/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = await res.json();
      if (json?.ok) {
        setAiSuggestions((prev) => prev.filter((s) => s.title !== title));
        fetchGoals();
      }
    } finally {
      setAddingGoal(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#1E2228]" />;
  }

  // Group goals by category
  const grouped = new Map<GoalCategory, Goal[]>();
  for (const g of goals) {
    const list = grouped.get(g.category) ?? [];
    list.push(g);
    grouped.set(g.category, list);
  }

  const sections = categoryOrder
    .filter((cat) => (grouped.get(cat)?.length ?? 0) > 0)
    .map((cat) => ({
      category: cat,
      config: categoryConfig[cat],
      items: grouped.get(cat)!,
    }));

  const onTrackCount = goals.filter((g) => g.progress >= 50).length;

  return (
    <main className="min-h-screen bg-[#1E2228] text-[#F0F2F5]">
      <div className="mx-auto max-w-2xl px-5 pt-8 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-[#8A9BAE] hover:bg-white/10 transition"
          >
            <svg
              width={18}
              height={18}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="font-serif text-2xl tracking-tight text-[#F0F2F5]">
            Goals
          </h1>
        </div>

        {/* Hero Health Score */}
        <div className="rounded-2xl bg-white/5 backdrop-blur p-6 ring-1 ring-white/[0.08] mb-6">
          <HeroGauge score={healthScore} />
          <p className="text-center text-sm text-[#8A9BAE] mt-2">
            {onTrackCount} of {goals.length} goals on track
          </p>
        </div>

        {/* Goal sections */}
        {goals.length === 0 && userGoals.length === 0 ? (
          <div className="rounded-2xl bg-white/5 backdrop-blur p-6 ring-1 ring-white/[0.08]">
            <div className="font-semibold text-[#F0F2F5]">
              No goals right now
            </div>
            <p className="mt-2 text-sm text-[#8A9BAE]">
              As QBH discovers providers and tracks visits, goals will appear
              here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.category}>
                <h2
                  className="mb-3 text-sm font-semibold uppercase tracking-wider"
                  style={{ color: section.config.color }}
                >
                  {section.config.sectionTitle}
                </h2>
                <div className="space-y-3">
                  {section.items.map((goal) => (
                    <div
                      key={goal.id}
                      className="rounded-2xl bg-white/5 backdrop-blur p-5 ring-1 ring-white/[0.08]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg font-semibold text-[#F0F2F5]">
                              {goal.title}
                            </span>
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0"
                              style={{
                                backgroundColor: `${section.config.color}20`,
                                color: section.config.color,
                              }}
                            >
                              {section.config.label}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm text-[#8A9BAE]">
                            {goal.detail}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <MiniGauge
                            value={goal.progress}
                            color={section.config.color}
                          />
                        </div>
                      </div>

                      {/* Handle It button for overdue goals with no progress */}
                      {goal.category === "overdue" &&
                        goal.progress === 0 &&
                        goal.providerId && (
                          <HandleItButton
                            providerId={goal.providerId}
                            providerName={goal.providerName}
                            label="Let Kate handle it"
                          />
                        )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* User goals */}
        {userGoals.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8A9BAE]">
              Your Goals
            </h2>
            <div className="space-y-3">
              {userGoals.map((ug) => (
                <div
                  key={ug.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 backdrop-blur p-5 ring-1 ring-white/[0.08]"
                >
                  <span className="text-[#F0F2F5] font-medium">{ug.title}</span>
                  <MiniGauge value={ug.progress} color="#8A9BAE" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Add custom goal */}
        <div className="mt-8 rounded-2xl bg-white/5 backdrop-blur p-5 ring-1 ring-white/[0.08]">
          <h3 className="text-base font-semibold text-[#F0F2F5] mb-1">
            What&apos;s important to you?
          </h3>
          <p className="text-sm text-[#8A9BAE] mb-4">
            Tell us what you want to work on and Kate will suggest specific goals.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={newGoalText}
              onChange={(e) => { setNewGoalText(e.target.value); setAiSuggestions([]); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGetSuggestions();
              }}
              placeholder="e.g., I want to be more proactive about my health"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[#F0F2F5] placeholder:text-[#8A9BAE]/50 outline-none focus:border-[#7BA59A]/50 focus:ring-1 focus:ring-[#7BA59A]/30 transition"
            />
            <button
              type="button"
              onClick={handleGetSuggestions}
              disabled={loadingSuggestions || !newGoalText.trim()}
              className="rounded-xl bg-[#7BA59A] px-5 py-2.5 text-sm font-semibold text-[#1E2228] shadow-sm transition hover:brightness-[0.95] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loadingSuggestions ? "Thinking..." : "Get suggestions"}
            </button>
          </div>

          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7BA59A]">
                Kate suggests
              </p>
              {aiSuggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/[0.06]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#F0F2F5]">{s.title}</p>
                    <p className="mt-1 text-xs text-[#8A9BAE]">{s.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddSuggestion(s.title)}
                    disabled={addingGoal}
                    className="shrink-0 rounded-lg bg-[#7BA59A]/20 px-3 py-1.5 text-xs font-semibold text-[#7BA59A] transition hover:bg-[#7BA59A]/30 disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick add without AI */}
          {aiSuggestions.length === 0 && newGoalText.trim() && !loadingSuggestions && (
            <button
              type="button"
              onClick={handleAddGoal}
              disabled={addingGoal}
              className="mt-3 text-xs text-[#8A9BAE] underline underline-offset-4 hover:text-[#F0F2F5]"
            >
              Or just add &ldquo;{newGoalText.trim()}&rdquo; as a goal directly
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
