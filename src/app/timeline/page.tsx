"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import ProviderLink from "../../components/qbh/ProviderLink";
import NextSteps from "../../components/qbh/NextSteps";
import { Calendar, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import InlineProviderSearch from "../../components/qbh/InlineProviderSearch";

type Visit = { id: string; date: string; amount: number | null; source: string };
type TimelineProvider = { providerId: string; providerName: string; visits: Visit[] };
type TimelineYear = { year: string; providers: TimelineProvider[]; totalVisits: number };
type UpcomingEvent = { id: string; providerId: string; providerName: string; date: string; detail: string; needsProviderMatch?: boolean };

type YearAheadItem = {
  providerId: string | null;
  providerName: string;
  providerType: string | null;
  title: string;
  rationale?: string;
  status: "scheduled" | "in_progress" | "overdue" | "due";
  date: string;
  detail?: string;
  isPhantom?: boolean;
};
type YearAheadMonth = { key: string; label: string; items: YearAheadItem[] };

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function TimelinePage() {
  const router = useRouter();
  const [years, setYears] = useState<TimelineYear[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [providerCount, setProviderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [addingProvider, setAddingProvider] = useState<string | null>(null);
  const [addedProviders, setAddedProviders] = useState<Set<string>>(new Set());
  const [yearAheadMonths, setYearAheadMonths] = useState<YearAheadMonth[]>([]);
  const [yearAheadOverdue, setYearAheadOverdue] = useState<YearAheadItem[]>([]);
  const [yearAheadRecommendations, setYearAheadRecommendations] = useState<YearAheadItem[]>([]);
  type CustomTimelineItem = { id: string; title: string; description?: string | null; target_month?: string | null; created_at: string };
  const [customItems, setCustomItems] = useState<CustomTimelineItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTargetMonth, setFormTargetMonth] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  const TIMELINE_PRESETS = [
    "Annual physical",
    "Mammogram",
    "Colonoscopy",
    "Dermatology (skin check)",
    "Eye exam",
    "Dental cleaning",
    "OB/GYN annual",
    "Lipid + metabolic panel",
    "A1C / diabetes screening",
    "Bone density (DEXA) scan",
    "Flu shot",
    "Shingles vaccine",
    "GLP-1 follow-up",
    "Cancer follow-up / surveillance",
    "Therapy check-in",
    "Medication review",
  ];

  useEffect(() => {
    apiFetch("/api/timeline/data")
      .then((res) => {
        if (res.status === 401) { router.push("/login"); return null; }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) {
          setYears(json.years ?? []);
          setUpcoming(json.upcoming ?? []);
          setProviderCount(json.providerCount ?? 0);
          setCustomItems(json.customTimelineItems ?? []);
        }
      })
      .finally(() => setLoading(false));
    apiFetch("/api/year-ahead")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json?.ok) {
          setYearAheadMonths(json.months ?? []);
          setYearAheadOverdue(json.overdue ?? []);
          setYearAheadRecommendations(json.recommendations ?? []);
        }
      })
      .catch(() => {});
  }, [router]);

  function toggleProvider(key: string) {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (loading) {
    return (
      <PageShell><div /></PageShell>
    );
  }

  const totalVisits = years.reduce((sum, y) => sum + y.totalVisits, 0);

  return (
    <PageShell>
      
      <div className="mx-auto max-w-3xl px-6 pt-8 pb-16">
        <h1 className="font-serif text-3xl tracking-tighter font-medium text-[#071832]">
          Health Timeline
        </h1>
        <p className="mt-1 text-sm text-[#4F5F73]">
          Your providers and visits — past, present, and future
        </p>

        {/* Summary strip */}
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E5EAF2] px-3 py-1 text-xs font-medium text-[#071832] shadow-sm">
            {providerCount} provider{providerCount !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E5EAF2] px-3 py-1 text-xs font-medium text-[#071832] shadow-sm">
            {totalVisits} visit{totalVisits !== 1 ? "s" : ""} tracked
          </span>
          {upcoming.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-600 shadow-sm">
              <Calendar size={12} /> {upcoming.length} upcoming
            </span>
          )}
        </div>

        {/* Year Ahead — preventive-care calendar inferred from
            provider history + cadence. Empty months are still shown
            so the timeline reads as a calendar, not just a list. */}
        {(yearAheadMonths.length > 0 || yearAheadOverdue.length > 0 || yearAheadRecommendations.length > 0) && (
          <div className="mt-10">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-bold text-[#1677FF]">Year ahead</span>
              <div className="flex-1 h-px bg-[#E5EAF2]" />
            </div>
            <p className="text-xs text-[#4F5F73] mb-4">
              What&rsquo;s coming up over the next 12 months — annual physicals,
              cleanings, follow-ups. Inferred from your provider history.
            </p>

            {/* Recommendations — guideline-based items (mammograms, colonoscopy,
                etc.) with no specific month assigned. Surfaced separately from
                the month calendar because we don't actually know when these
                should happen for the user — only that they're worth scheduling
                this year. Splitting them out keeps the calendar honest. */}
            {yearAheadRecommendations.length > 0 && (
              <div className="mb-5 rounded-2xl bg-white border border-[#1677FF]/20 shadow-sm p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[#1677FF] mb-1">
                  Recommended this year
                </div>
                <p className="text-[11px] text-[#4F5F73] mb-3">
                  Based on age and care history. No specific month — schedule when it works for you.
                </p>
                <div className="space-y-3">
                  {yearAheadRecommendations.map((item) => (
                    <div
                      key={`rec-${item.title}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#071832]">{item.title}</div>
                        {item.rationale && (
                          <div className="text-xs text-[#4F5F73] mt-1 leading-snug">{item.rationale}</div>
                        )}
                        <a
                          href="/providers?add=true"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1677FF] hover:underline underline-offset-4"
                        >
                          Find a provider
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </a>
                      </div>
                      <span className="rounded-full bg-[#1677FF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#1677FF] shrink-0">
                        Recommended
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Your goals — user-added timeline items. Surfaces things
                that aren't derivable from providers or guidelines (GLP-1
                start, cancer surveillance, weight check, etc.). Always
                rendered so the Add button is reachable even when there
                are no items yet. */}
            <div className="mb-5 rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#4F5F73]">
                    Your goals
                  </div>
                  <p className="text-[11px] text-[#4F5F73] mt-0.5">
                    Anything else you&rsquo;re tracking — appointments, screenings, goals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: "#1677FF" }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              {showAddForm && (
                <div className="mt-3 mb-3 rounded-xl bg-[#F8F9FB] border border-[#E5EAF2] p-3 space-y-2">
                  <div>
                    <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">
                      What are you tracking?
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. GLP-1 follow-up, cancer surveillance, weight check"
                      list="timeline-presets"
                      className="w-full rounded-lg border border-[#E5EAF2] bg-white px-3 py-2 text-sm text-[#071832] placeholder:text-[#4F5F73] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                    />
                    <datalist id="timeline-presets">
                      {TIMELINE_PRESETS.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">
                      Notes <span className="text-[#4F5F73] font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Anything Kate should know"
                      className="w-full rounded-lg border border-[#E5EAF2] bg-white px-3 py-2 text-sm text-[#071832] placeholder:text-[#4F5F73] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">
                      Target month <span className="text-[#4F5F73] font-normal">(optional — leave blank for &ldquo;anytime&rdquo;)</span>
                    </label>
                    <input
                      type="month"
                      value={formTargetMonth}
                      onChange={(e) => setFormTargetMonth(e.target.value)}
                      className="w-full rounded-lg border border-[#E5EAF2] bg-white px-3 py-2 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setFormTitle(""); setFormDescription(""); setFormTargetMonth(""); }}
                      className="rounded-lg px-3 py-1.5 text-xs text-[#4F5F73] hover:bg-[#F0F2F5]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!formTitle.trim() || savingItem}
                      onClick={async () => {
                        setSavingItem(true);
                        try {
                          const res = await apiFetch("/api/timeline/items", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              title: formTitle.trim(),
                              description: formDescription.trim() || undefined,
                              target_month: formTargetMonth || undefined,
                            }),
                          });
                          const data = await res.json();
                          if (data?.ok && data.item) {
                            setCustomItems((prev) => [data.item, ...prev]);
                            setFormTitle("");
                            setFormDescription("");
                            setFormTargetMonth("");
                            setShowAddForm(false);
                          }
                        } finally {
                          setSavingItem(false);
                        }
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: "#1677FF" }}
                    >
                      {savingItem ? "Saving…" : "Add"}
                    </button>
                  </div>
                </div>
              )}

              {customItems.length === 0 && !showAddForm && (
                <div className="mt-2 text-xs text-[#4F5F73]">
                  Nothing yet. Tap Add to track something on your own — a screening, a check-in, a follow-up.
                </div>
              )}

              {customItems.length > 0 && (
                <div className="space-y-2 mt-2">
                  {customItems.map((item) => {
                    const monthLabel = item.target_month
                      ? new Date(item.target_month + "-15").toLocaleDateString("en-US", { month: "short", year: "numeric" })
                      : "Anytime";
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-[#F8F9FB] px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-[#071832]">{item.title}</div>
                          {item.description && (
                            <div className="text-[11px] text-[#4F5F73] mt-0.5 leading-snug">{item.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="rounded-full bg-white border border-[#E5EAF2] px-2.5 py-0.5 text-[10px] font-semibold text-[#4F5F73]">
                            {monthLabel}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/timeline/items?id=${item.id}`, { method: "DELETE" });
                              setCustomItems((prev) => prev.filter((x) => x.id !== item.id));
                            }}
                            aria-label="Remove"
                            className="text-[#4F5F73] hover:text-red-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {yearAheadOverdue.length > 0 && (
              <div className="mb-5 rounded-2xl bg-white border border-[#E04030]/30 shadow-sm p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[#E04030] mb-2">
                  Ready to schedule
                </div>
                <div className="space-y-2">
                  {yearAheadOverdue.map((item) => (
                    <div key={item.providerId} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#071832]">{item.title}</div>
                        <div className="text-xs text-[#4F5F73] mt-0.5">
                          {item.providerName} · due since {formatDate(item.date)}
                        </div>
                      </div>
                      <span className="rounded-full bg-[#E04030]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#E04030] shrink-0">
                        Due
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {yearAheadMonths.map((m) => {
                const isEmpty = m.items.length === 0;
                return (
                  <div
                    key={m.key}
                    className={`rounded-2xl bg-white border border-[#E5EAF2] shadow-sm px-5 py-4 ${isEmpty ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F5F73]">
                        {m.label}
                      </div>
                      {isEmpty && (
                        <div className="text-[11px] text-[#4F5F73]">Nothing planned</div>
                      )}
                    </div>
                    {!isEmpty && (
                      <div className="space-y-3">
                        {m.items.map((item) => {
                          const pillBg = item.status === "scheduled"
                            ? "bg-[#27C46B]/10 text-[#27C46B]"
                            : "bg-[#1677FF]/10 text-[#1677FF]";
                          const pillLabel = item.status === "scheduled"
                            ? "Scheduled"
                            : item.status === "in_progress"
                            ? "Kate is on it"
                            : item.isPhantom
                            ? "Recommended"
                            : "Due";
                          return (
                            <div key={`${item.providerId ?? "phantom"}-${item.title}-${item.date}`} className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-[#071832]">{item.title}</div>
                                <div className="text-xs text-[#4F5F73] mt-0.5">
                                  {item.providerName} · {formatDate(item.date)}
                                </div>
                                {item.rationale && (
                                  <div className="text-xs text-[#4F5F73] mt-1.5 leading-snug">
                                    {item.rationale}
                                  </div>
                                )}
                                {item.isPhantom && (
                                  <a
                                    href="/providers?add=true"
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1677FF] hover:underline underline-offset-4"
                                  >
                                    Find a provider
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${pillBg}`}>
                                {pillLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming appointments */}
        {upcoming.length > 0 && (
          <div data-tour="timeline-upcoming" className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-600">Upcoming</span>
              <div className="flex-1 h-px bg-[#E5EAF2]" />
            </div>
            <div className="space-y-3">
              {upcoming.map((evt) => (
                <div key={evt.id} className="rounded-2xl bg-white border border-emerald-500/20 shadow-sm px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">
                        {evt.providerId ? (
                          <ProviderLink providerId={evt.providerId} providerName={evt.providerName} />
                        ) : evt.providerName}
                      </div>
                      <div className="text-xs text-[#4F5F73] mt-0.5">{formatDateTime(evt.date)}</div>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                      Upcoming
                    </span>
                  </div>
                  {evt.needsProviderMatch && !addedProviders.has(evt.id) && (
                    addingProvider === evt.id ? (
                      <InlineProviderSearch
                        onAdded={() => {
                          setAddedProviders((prev) => new Set([...prev, evt.id]));
                          setAddingProvider(null);
                        }}
                        onCancel={() => setAddingProvider(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingProvider(evt.id)}
                        className="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
                      >
                        Add As Provider
                      </button>
                    )
                  )}
                  {addedProviders.has(evt.id) && (
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      ✓ Added
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Year-by-year provider history */}
        {years.length > 0 ? (
          <div data-tour="timeline-history" className="mt-8 space-y-6">
            {years.map((yearData) => (
              <div key={yearData.year}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1677FF]">{yearData.year}</span>
                  <span className="text-xs text-[#4F5F73]">
                    {yearData.providers.length} provider{yearData.providers.length !== 1 ? "s" : ""} &middot; {yearData.totalVisits} visit{yearData.totalVisits !== 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-[#E5EAF2]" />
                </div>

                <div className="relative space-y-3 pl-6">
                  {/* Timeline line */}
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-[#E5EAF2]" />

                  {yearData.providers.map((prov) => {
                    const key = `${yearData.year}-${prov.providerId}`;
                    const isExpanded = expandedProviders.has(key);

                    return (
                      <div key={key} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[17px] top-4 h-2.5 w-2.5 rounded-full bg-[#1677FF] ring-2 ring-white" />

                        <div className="rounded-2xl bg-white shadow-sm border border-[#E5EAF2] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleProvider(key)}
                            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F8F9FA] transition"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#071832]">
                                {prov.providerId.startsWith("gcal-") ? (
                                  <span>{prov.providerName}</span>
                                ) : (
                                  <ProviderLink providerId={prov.providerId} providerName={prov.providerName} />
                                )}
                              </div>
                              <div className="text-xs text-[#4F5F73] mt-0.5">
                                {prov.visits.length} visit{prov.visits.length !== 1 ? "s" : ""} in {yearData.year}
                                {prov.visits.some((v) => v.source === "calendar") && (
                                  <span className="ml-1 text-[#4F5F73]">&middot; From calendar</span>
                                )}
                              </div>
                              {prov.providerId.startsWith("gcal-") && !addedProviders.has(prov.providerId) && (
                                addingProvider === prov.providerId ? (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <InlineProviderSearch
                                      onAdded={() => {
                                        setAddedProviders((prev) => new Set([...prev, prov.providerId]));
                                        setAddingProvider(null);
                                      }}
                                      onCancel={() => setAddingProvider(null)}
                                    />
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAddingProvider(prov.providerId);
                                    }}
                                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
                                  >
                                    Add As Provider
                                  </button>
                                )
                              )}
                              {addedProviders.has(prov.providerId) && (
                                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                  ✓ Added
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="rounded-full bg-[#B0D0E8]/30 px-2.5 py-0.5 text-[10px] font-semibold text-[#2A6090]">
                                {prov.visits.length}
                              </span>
                              {isExpanded ? <ChevronDown size={16} className="text-[#4F5F73]" /> : <ChevronRight size={16} className="text-[#4F5F73]" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-[#E5EAF2] px-5 py-3 bg-[#F8F9FA]">
                              <div className="space-y-2">
                                {prov.visits.map((v) => {
                                  const isGcal = v.id.startsWith("gcal-");
                                  return (
                                    <div key={v.id} className="flex items-center justify-between text-xs">
                                      <span className="text-[#4F5F73]">{formatDate(v.date)}</span>
                                      <div className="flex items-center gap-3">
                                        {v.amount != null && (
                                          <span className="text-[#4F5F73]">${v.amount.toFixed(2)}</span>
                                        )}
                                        {isGcal && (
                                          <button
                                            type="button"
                                            aria-label="Not healthcare-related, remove from timeline"
                                            onClick={async () => {
                                              const eventId = v.id.replace(/^gcal-/, "");
                                              await apiFetch("/api/timeline/data", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ dismissed_event_id: eventId }),
                                              });
                                              // Optimistic: drop this visit from local state without
                                              // a full refetch. If it was the only visit under this
                                              // gcal- provider, drop the provider row too.
                                              setYears((prev) =>
                                                prev
                                                  .map((y) => ({
                                                    ...y,
                                                    providers: y.providers
                                                      .map((p) => ({
                                                        ...p,
                                                        visits: p.visits.filter((x) => x.id !== v.id),
                                                      }))
                                                      .filter((p) => p.visits.length > 0),
                                                    totalVisits: y.providers.reduce(
                                                      (sum, p) => sum + p.visits.filter((x) => x.id !== v.id).length,
                                                      0
                                                    ),
                                                  }))
                                                  .filter((y) => y.totalVisits > 0)
                                              );
                                            }}
                                            className="text-[#4F5F73] hover:text-red-500 transition"
                                            title="Not healthcare-related"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="mt-3 text-[10px] text-[#4F5F73]">
                                Something here that isn&rsquo;t healthcare-related? Tap ✕ to drop it from your timeline.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-white shadow-sm p-6 border border-[#E5EAF2]">
            <div className="font-semibold text-[#071832]">Your health story starts here</div>
            <p className="mt-2 text-sm text-[#4F5F73]">
              As you add providers and Kate books appointments, your timeline will show who you&apos;ve seen, when, and how it all connects.
            </p>
          </div>
        ) : null}

        <NextSteps />
      </div>
    </PageShell>
  );
}
