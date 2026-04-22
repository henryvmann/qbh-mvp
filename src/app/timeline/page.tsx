"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import TopNav from "../../components/qbh/TopNav";
import ProviderLink from "../../components/qbh/ProviderLink";
import NextSteps from "../../components/qbh/NextSteps";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";

type Visit = { id: string; date: string; amount: number | null; source: string };
type TimelineProvider = { providerId: string; providerName: string; visits: Visit[] };
type TimelineYear = { year: string; providers: TimelineProvider[]; totalVisits: number };
type UpcomingEvent = { id: string; providerId: string; providerName: string; date: string; detail: string; needsProviderMatch?: boolean };

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
  const [addProviderName, setAddProviderName] = useState("");
  const [addProviderSpecialty, setAddProviderSpecialty] = useState("");
  const [addProviderPhone, setAddProviderPhone] = useState("");
  const [savingProvider, setSavingProvider] = useState(false);
  const [addedProviders, setAddedProviders] = useState<Set<string>>(new Set());

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
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  const totalVisits = years.reduce((sum, y) => sum + y.totalVisits, 0);

  return (
    <main className="min-h-screen text-[#1A1D2E]" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
      <TopNav />
      <div className="mx-auto max-w-3xl px-6 pt-8 pb-16">
        <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E]">
          Health Timeline
        </h1>
        <p className="mt-1 text-sm text-[#7A7F8A]">
          Your providers and visits — past, present, and future
        </p>

        {/* Summary strip */}
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#EBEDF0] px-3 py-1 text-xs font-medium text-[#1A1D2E] shadow-sm">
            {providerCount} provider{providerCount !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#EBEDF0] px-3 py-1 text-xs font-medium text-[#1A1D2E] shadow-sm">
            {totalVisits} visit{totalVisits !== 1 ? "s" : ""} tracked
          </span>
          {upcoming.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-600 shadow-sm">
              <Calendar size={12} /> {upcoming.length} upcoming
            </span>
          )}
        </div>

        {/* Upcoming appointments */}
        {upcoming.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-600">Upcoming</span>
              <div className="flex-1 h-px bg-[#EBEDF0]" />
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
                      <div className="text-xs text-[#7A7F8A] mt-0.5">{formatDateTime(evt.date)}</div>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                      Upcoming
                    </span>
                  </div>
                  {evt.needsProviderMatch && !addedProviders.has(evt.id) && (
                    addingProvider === evt.id ? (
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={addProviderName}
                          onChange={(e) => setAddProviderName(e.target.value)}
                          placeholder="Provider name (e.g. Dr. Echelman)"
                          className="w-full rounded-lg border border-[#EBEDF0] bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={addProviderSpecialty}
                            onChange={(e) => setAddProviderSpecialty(e.target.value)}
                            placeholder="Specialty (optional)"
                            className="flex-1 rounded-lg border border-[#EBEDF0] bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                          />
                          <input
                            type="tel"
                            value={addProviderPhone}
                            onChange={(e) => setAddProviderPhone(e.target.value)}
                            placeholder="Phone (optional)"
                            className="flex-1 rounded-lg border border-[#EBEDF0] bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!addProviderName.trim() || savingProvider}
                            onClick={async () => {
                              setSavingProvider(true);
                              try {
                                const res = await apiFetch("/api/providers/add-manual", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    name: addProviderName.trim(),
                                    specialty: addProviderSpecialty.trim() || null,
                                    phone_number: addProviderPhone.trim() || null,
                                  }),
                                });
                                const data = await res.json();
                                if (data.ok) {
                                  setAddedProviders((prev) => new Set([...prev, evt.id]));
                                  setAddingProvider(null);
                                  setAddProviderName("");
                                  setAddProviderSpecialty("");
                                  setAddProviderPhone("");
                                }
                              } finally {
                                setSavingProvider(false);
                              }
                            }}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            style={{ backgroundColor: "#5C6B5C" }}
                          >
                            {savingProvider ? "Adding..." : "Add Provider"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingProvider(null)}
                            className="rounded-lg px-3 py-1.5 text-xs text-[#7A7F8A] hover:bg-[#F0F2F5]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAddProviderName(evt.providerName);
                          setAddProviderSpecialty("");
                          setAddProviderPhone("");
                          setAddingProvider(evt.id);
                        }}
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
          <div className="mt-8 space-y-6">
            {years.map((yearData) => (
              <div key={yearData.year}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-bold text-[#5C6B5C]">{yearData.year}</span>
                  <span className="text-xs text-[#B0B4BC]">
                    {yearData.providers.length} provider{yearData.providers.length !== 1 ? "s" : ""} &middot; {yearData.totalVisits} visit{yearData.totalVisits !== 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-[#EBEDF0]" />
                </div>

                <div className="relative space-y-3 pl-6">
                  {/* Timeline line */}
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-[#EBEDF0]" />

                  {yearData.providers.map((prov) => {
                    const key = `${yearData.year}-${prov.providerId}`;
                    const isExpanded = expandedProviders.has(key);

                    return (
                      <div key={key} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[17px] top-4 h-2.5 w-2.5 rounded-full bg-[#5C6B5C] ring-2 ring-white" />

                        <div className="rounded-2xl bg-white shadow-sm border border-[#EBEDF0] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleProvider(key)}
                            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F8F9FA] transition"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#1A1D2E]">
                                {prov.providerId.startsWith("gcal-") ? (
                                  <span>{prov.providerName}</span>
                                ) : (
                                  <ProviderLink providerId={prov.providerId} providerName={prov.providerName} />
                                )}
                              </div>
                              <div className="text-xs text-[#7A7F8A] mt-0.5">
                                {prov.visits.length} visit{prov.visits.length !== 1 ? "s" : ""} in {yearData.year}
                                {prov.visits.some((v) => v.source === "calendar") && (
                                  <span className="ml-1 text-[#B0B4BC]">&middot; From calendar</span>
                                )}
                              </div>
                              {prov.providerId.startsWith("gcal-") && !addedProviders.has(prov.providerId) && (
                                addingProvider === prov.providerId ? (
                                  <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={addProviderName}
                                      onChange={(e) => setAddProviderName(e.target.value)}
                                      placeholder="Provider name (e.g. Dr. Echelman)"
                                      className="w-full rounded-lg border border-[#EBEDF0] bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                                    />
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={addProviderSpecialty}
                                        onChange={(e) => setAddProviderSpecialty(e.target.value)}
                                        placeholder="Specialty (optional)"
                                        className="flex-1 rounded-lg border border-[#EBEDF0] bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                                      />
                                      <input
                                        type="tel"
                                        value={addProviderPhone}
                                        onChange={(e) => setAddProviderPhone(e.target.value)}
                                        placeholder="Phone (optional)"
                                        className="flex-1 rounded-lg border border-[#EBEDF0] bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        disabled={!addProviderName.trim() || savingProvider}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setSavingProvider(true);
                                          try {
                                            const res = await apiFetch("/api/providers/add-manual", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                name: addProviderName.trim(),
                                                specialty: addProviderSpecialty.trim() || null,
                                                phone_number: addProviderPhone.trim() || null,
                                              }),
                                            });
                                            const data = await res.json();
                                            if (data.ok) {
                                              setAddedProviders((prev) => new Set([...prev, prov.providerId]));
                                              setAddingProvider(null);
                                              setAddProviderName("");
                                              setAddProviderSpecialty("");
                                              setAddProviderPhone("");
                                            }
                                          } finally {
                                            setSavingProvider(false);
                                          }
                                        }}
                                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                        style={{ backgroundColor: "#5C6B5C" }}
                                      >
                                        {savingProvider ? "Adding..." : "Add Provider"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setAddingProvider(null); }}
                                        className="rounded-lg px-3 py-1.5 text-xs text-[#7A7F8A] hover:bg-[#F0F2F5]"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAddProviderName(prov.providerName);
                                      setAddProviderSpecialty("");
                                      setAddProviderPhone("");
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
                              {isExpanded ? <ChevronDown size={16} className="text-[#B0B4BC]" /> : <ChevronRight size={16} className="text-[#B0B4BC]" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-[#EBEDF0] px-5 py-3 bg-[#F8F9FA]">
                              <div className="space-y-2">
                                {prov.visits.map((v) => (
                                  <div key={v.id} className="flex items-center justify-between text-xs">
                                    <span className="text-[#7A7F8A]">{formatDate(v.date)}</span>
                                    {v.amount != null && (
                                      <span className="text-[#7A7F8A]">${v.amount.toFixed(2)}</span>
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
          <div className="mt-10 rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
            <div className="font-semibold text-[#1A1D2E]">Your health story starts here</div>
            <p className="mt-2 text-sm text-[#7A7F8A]">
              As you add providers and Kate books appointments, your timeline will show who you&apos;ve seen, when, and how it all connects.
            </p>
          </div>
        ) : null}

        <NextSteps />
      </div>
    </main>
  );
}
