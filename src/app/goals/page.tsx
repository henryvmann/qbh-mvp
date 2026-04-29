"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import BestNextStep from "../../components/qbh/BestNextStep";
import HandleItButton from "../../components/qbh/HandleItButton";
import NextSteps from "../../components/qbh/NextSteps";

/* ---------- helpers ---------- */

const PROVIDER_TYPE_KEYWORDS = [
  "dentist", "dental", "eye", "optometrist", "ophthalmologist", "vision",
  "dermatologist", "dermatology", "skin", "obgyn", "ob-gyn", "gynecologist",
  "cardiologist", "cardiology", "orthopedic", "physical therapy", "therapist",
  "psychiatrist", "psychologist", "mental health", "counselor",
  "allergist", "ent", "ear nose", "podiatrist", "foot", "urologist",
  "endocrinologist", "gastroenterologist", "neurologist", "pulmonologist",
  "rheumatologist", "oncologist",
];

function getGoalLink(goal: { title: string; category: string; providerId?: string }): { href: string; label: string } | null {
  const t = goal.title.toLowerCase();

  // Profile-related goals
  if (t.includes("profile") || t.includes("health profile") || t.includes("complete your") || t.includes("update your info")) {
    return { href: "/settings", label: "Go to profile" };
  }

  // Calendar-related goals
  if (t.includes("calendar") || t.includes("connect your calendar")) {
    return { href: "/calendar-connect", label: "Connect calendar" };
  }

  // If it has a providerId, link to providers page
  if (goal.providerId) {
    return { href: "/providers", label: "View providers" };
  }

  // If it mentions a provider type, link to provider search
  if (PROVIDER_TYPE_KEYWORDS.some((kw) => t.includes(kw))) {
    return { href: "/providers?add=true", label: "Find providers" };
  }

  // Booking-related
  if (t.includes("book") || t.includes("schedule") || t.includes("appointment")) {
    return { href: "/providers?add=true", label: "Find providers" };
  }

  return null;
}

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
  dismissKey?: string;
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
    color: "#5C6B5C",
  },
  medications: {
    label: "Medications",
    sectionTitle: "Medications",
    color: "#9078C8",
  },
  upcoming: {
    label: "Upcoming",
    sectionTitle: "Upcoming",
    color: "#B8C840",
  },
  setup: {
    label: "Setup",
    sectionTitle: "Setup",
    color: "#6A9DC0",
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
        stroke="rgba(0,0,0,0.08)"
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
        fill="#1A1D2E"
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

  let color = "#5C6B5C"; // sage (high)
  if (score < 40) color = "#E04030"; // coral (low)
  else if (score < 70) color = "#C8D84A"; // lime-ish (medium)

  return (
    <div className="flex flex-col items-center">
      <svg width={200} height={115} viewBox="0 0 200 115">
        <path
          d="M 10 105 A 80 80 0 0 1 190 105"
          fill="none"
          stroke="rgba(0,0,0,0.06)"
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
          fill="#1A1D2E"
          fontSize={40}
          fontWeight="300"
        >
          {score}%
        </text>
        <text
          x={100}
          y={108}
          textAnchor="middle"
          fill="#7A7F8A"
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
  const [kateResponse, setKateResponse] = useState<string | null>(null);
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
    setKateResponse(null);
    try {
      const res = await apiFetch("/api/goals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const json = await res.json();
      if (json?.ok) {
        if (json.goals) setAiSuggestions(json.goals);
        if (json.response) setKateResponse(json.response);
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
    return <PageShell><div /></PageShell>;
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
    <PageShell>
      
      <div className="mx-auto max-w-2xl px-5 pt-8 pb-20">
        <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E] mb-4">
          Goals
        </h1>

        <div className="mt-4" />

        {goals.length === 0 && (
          <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-6 text-center">
            <p className="text-lg font-light text-[#1A1D2E]">No goals set yet</p>
            <p className="mt-1 text-sm text-[#7A7F8A]">Tell Kate what you want to work on below and she&apos;ll help you get organized.</p>
          </div>
        )}

        {/* What's important to you */}
        <div data-tour="goals-input" className="mb-6 rounded-2xl bg-white shadow-sm p-5 border border-[#EBEDF0]">
          <h3 className="text-base font-semibold text-[#1A1D2E] mb-1">
            What&apos;s important to you?
          </h3>
          <p className="text-sm text-[#7A7F8A] mb-4">
            Enter a goal and Kate will help you track it, or describe a health area and she&apos;ll suggest specific goals.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newGoalText}
              onChange={(e) => { setNewGoalText(e.target.value); setAiSuggestions([]); setKateResponse(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.shiftKey) { handleAddGoal(); }
                else if (e.key === "Enter") { handleGetSuggestions(); }
              }}
              placeholder="e.g., Find a cardiologist, or: I want to focus on heart health"
              className="flex-1 rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-4 py-2.5 text-sm text-[#1A1D2E] placeholder:text-[#7A7F8A]/50 outline-none focus:border-[#5C6B5C]/50 focus:ring-1 focus:ring-[#5C6B5C]/30 transition"
            />
            <button
              type="button"
              onClick={handleAddGoal}
              disabled={addingGoal || !newGoalText.trim()}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold border border-[#5C6B5C] text-[#5C6B5C] transition hover:bg-[#5C6B5C]/10 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {addingGoal ? "Adding..." : "Add Goal"}
            </button>
            <button
              type="button"
              onClick={handleGetSuggestions}
              disabled={loadingSuggestions || !newGoalText.trim()}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[0.95] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
            >
              {loadingSuggestions ? "Thinking..." : "Get Suggestions"}
            </button>
          </div>

          {/* Kate's response */}
          {kateResponse && (
            <div className="mt-4 rounded-xl bg-[#5C6B5C]/10 border border-[#5C6B5C]/20 p-4">
              <p className="text-sm text-[#1A1D2E]">{kateResponse}</p>
            </div>
          )}

          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5C6B5C]">
                Kate Suggests
              </p>
              {aiSuggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-xl bg-[#F0F2F5] p-4 border border-[#EBEDF0]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1A1D2E]">{s.title}</p>
                    <p className="mt-1 text-xs text-[#7A7F8A]">{s.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddSuggestion(s.title)}
                    disabled={addingGoal}
                    className="shrink-0 rounded-lg bg-[#5C6B5C]/15 px-3 py-1.5 text-xs font-semibold text-[#5C6B5C] transition hover:bg-[#5C6B5C]/25 disabled:opacity-50"
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
              className="mt-3 text-xs text-[#7A7F8A] underline underline-offset-4 hover:text-[#1A1D2E]"
            >
              Or just add &ldquo;{newGoalText.trim()}&rdquo; as a goal directly
            </button>
          )}
        </div>

        {/* Goal sections */}
        {goals.length === 0 && userGoals.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
            <div className="font-semibold text-[#1A1D2E]">
              No goals right now
            </div>
            <p className="mt-2 text-sm text-[#7A7F8A]">
              As QBH discovers providers and tracks visits, goals will appear
              here automatically.
            </p>
          </div>
        ) : (
          <div data-tour="goals-sections" className="space-y-8">
            {sections.map((section) => {
              const completed = section.items.filter((g) => g.progress >= 100);
              const outstanding = section.items.filter((g) => g.progress < 100);

              return (
              <section key={section.category}>
                <h2
                  className="mb-3 text-sm font-semibold uppercase tracking-wider"
                  style={{ color: section.config.color }}
                >
                  {section.config.sectionTitle}
                  {completed.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-[#B0B4BC]">
                      {completed.length} completed
                    </span>
                  )}
                </h2>

                {/* Outstanding goals first */}
                <div className="space-y-3">
                  {outstanding.map((goal) => {
                    const goalLink = getGoalLink(goal);
                    return (
                    <div
                      key={goal.id}
                      className="rounded-2xl bg-white shadow-sm p-5 border border-[#EBEDF0]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {goalLink ? (
                              <Link
                                href={goalLink.href}
                                className="text-lg font-semibold text-[#1A1D2E] underline decoration-[#5C6B5C]/30 underline-offset-4 hover:decoration-[#5C6B5C]"
                              >
                                {goal.title}
                              </Link>
                            ) : (
                              <span className="text-lg font-semibold text-[#1A1D2E]">
                                {goal.title}
                              </span>
                            )}
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
                          <p className="mt-1.5 text-sm text-[#7A7F8A]">
                            {goal.detail}
                          </p>
                          {goalLink && (
                            <Link
                              href={goalLink.href}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#5C6B5C] hover:underline underline-offset-4"
                            >
                              {goalLink.label}
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          )}
                          {goal.dismissKey && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const profileRes = await apiFetch("/api/patient-profile");
                                  const profileData = await profileRes.json();
                                  const existing = profileData?.profile?.dismissed_provider_types || [];
                                  await apiFetch("/api/patient-profile", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      profile: {
                                        dismissed_provider_types: [...existing, goal.dismissKey],
                                      },
                                    }),
                                  });
                                  fetchGoals();
                                } catch {}
                              }}
                              className="mt-2 text-xs text-[#B0B4BC] hover:text-[#7A7F8A] underline underline-offset-2"
                            >
                              I don&apos;t have one
                            </button>
                          )}
                        </div>
                        {(goal.progress > 0 || goal.category === "setup") && (
                          <div className="shrink-0">
                            <MiniGauge
                              value={goal.progress}
                              color={section.config.color}
                            />
                          </div>
                        )}
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
                    );
                  })}
                </div>

                {/* Completed goals — collapsed */}
                {completed.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-[#B0B4BC] font-medium mb-2">Completed</div>
                    <div className="space-y-2">
                      {completed.map((goal) => (
                        <div
                          key={goal.id}
                          className="flex items-center gap-3 rounded-xl bg-[#F0F2F5] px-4 py-2.5 border border-[#EBEDF0]"
                        >
                          <div className="h-5 w-5 rounded-full bg-[#5C6B5C] flex items-center justify-center shrink-0">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 8.5L6.5 12L13 4" />
                            </svg>
                          </div>
                          <span className="text-sm text-[#7A7F8A] line-through">{goal.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              );
            })}
          </div>
        )}

        {/* User goals */}
        {userGoals.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#7A7F8A]">
              Your Goals
            </h2>
            <div className="space-y-3">
              {userGoals.map((ug) => (
                <div
                  key={ug.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white shadow-sm p-5 border border-[#EBEDF0]"
                >
                  <span className="text-[#1A1D2E] font-medium">{ug.title}</span>
                  <MiniGauge value={ug.progress} color="#7A7F8A" />
                </div>
              ))}
            </div>
          </section>
        )}

        <NextSteps />
      </div>
    </PageShell>
  );
}
