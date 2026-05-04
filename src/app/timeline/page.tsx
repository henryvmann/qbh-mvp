"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import ProviderLink from "../../components/qbh/ProviderLink";
import NextSteps from "../../components/qbh/NextSteps";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";
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
        }
      })
      .finally(() => setLoading(false));
    apiFetch("/api/year-ahead")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json?.ok) {
          setYearAheadMonths(json.months ?? []);
          setYearAheadOverdue(json.overdue ?? []);
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
        {(yearAheadMonths.length > 0 || yearAheadOverdue.length > 0) && (
          <div className="mt-10">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-bold text-[#1677FF]">Year ahead</span>
              <div className="flex-1 h-px bg-[#E5EAF2]" />
            </div>
            <p className="text-xs text-[#4F5F73] mb-4">
              What&rsquo;s coming up over the next 12 months — annual physicals,
              cleanings, follow-ups. Inferred from your provider history.
            </p>

            {yearAheadOverdue.length > 0 && (
              <div className="mb-5 rounded-2xl bg-white border border-[#E04030]/30 shadow-sm p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[#E04030] mb-2">
                  Overdue
                </div>
                <div className="space-y-2">
                  {yearAheadOverdue.map((item) => (
                    <div key={item.providerId} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#071832]">{item.title}</div>
                        <div className="text-xs text-[#4F5F73] mt-0.5">
                          {item.providerName} · was due {formatDate(item.date)}
                        </div>
                      </div>
                      <span className="rounded-full bg-[#E04030]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#E04030] shrink-0">
                        Overdue
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
                                {prov.visits.map((v) => (
                                  <div key={v.id} className="flex items-center justify-between text-xs">
                                    <span className="text-[#4F5F73]">{formatDate(v.date)}</span>
                                    {v.amount != null && (
                                      <span className="text-[#4F5F73]">${v.amount.toFixed(2)}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
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
