"use client";

import { Suspense, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopNav from "../../components/qbh/TopNav";
import BestNextStep from "../../components/qbh/BestNextStep";
import { apiFetch } from "../../lib/api";
import ProviderCard from "../../components/qbh/ProviderCard";
import { Plus, Search, X, Check } from "lucide-react";
import type { ProviderDashboardSnapshot } from "../lib/QBH/types";

function getStatusLabel(snapshot: ProviderDashboardSnapshot): { label: string; className: string } {
  const bs = snapshot.booking_state;
  const actions = snapshot.system_actions;

  if (actions.integrity.hasMultipleFutureConfirmedEvents) {
    return { label: "Needs review", className: "bg-red-50 text-red-600 ring-1 ring-red-200" };
  }
  if (actions.current?.status === "BLOCKED") {
    return { label: "Blocked", className: "bg-red-50 text-red-600 ring-1 ring-red-200" };
  }
  if (bs?.status === "BOOKED") {
    return { label: "Upcoming", className: "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30" };
  }
  if (bs?.status === "FOLLOW_UP") {
    return { label: "Follow-up", className: "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30" };
  }
  if (actions.current?.status === "IN_PROGRESS") {
    return { label: "In progress", className: "bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/30" };
  }
  return { label: "Tracked", className: "bg-[#F0F2F5] text-[#7A7F8A] ring-1 ring-[#EBEDF0]" };
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

/* ── Add Provider Form ── */

type NpiResult = {
  npi: string | null;
  name: string;
  specialty: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
};

function AddProviderForm({
  userId,
  initialSearch,
  onClose,
  onAdded,
}: {
  userId: string;
  initialSearch?: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState(initialSearch || "");
  const [results, setResults] = useState<NpiResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/api/npi/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.ok) setResults(data.results || []);
      } catch {
        // best effort
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleAdd(result: NpiResult) {
    setAdding(result.name);
    try {
      const res = await apiFetch("/api/providers/add-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_user_id: userId,
          name: result.name,
          phone_number: result.phone,
          specialty: result.specialty,
          npi: result.npi,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAdded((prev) => new Set([...prev, result.name]));
        onAdded();
      }
    } catch {
      // best effort
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#EBEDF0]">
        <span className="text-sm font-semibold text-[#1A1D2E]">Add a provider</span>
        <button type="button" onClick={onClose} className="p-1 text-[#B0B4BC] hover:text-[#7A7F8A]">
          <X size={16} />
        </button>
      </div>
      <div className="px-5 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B4BC]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, specialty, or location..."
            className="w-full rounded-xl border border-[#EBEDF0] py-2.5 pl-9 pr-4 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#7A7F8A]">Searching...</span>
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-[#EBEDF0]">
            {results.map((result) => {
              const isAdded = added.has(result.name);
              const isAdding = adding === result.name;
              return (
                <div
                  key={result.npi || result.name}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#1A1D2E] truncate">{result.name}</div>
                    <div className="text-xs text-[#7A7F8A] truncate">
                      {[result.specialty, result.city, result.state].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {isAdded ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-[#5C6B5C]">
                      <Check size={12} /> Added
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAdd(result)}
                      disabled={!!adding}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                      style={{ backgroundColor: "#5C6B5C" }}
                    >
                      {isAdding ? "Adding..." : "Add"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {query.length >= 2 && !searching && results.length === 0 && (
          <div className="py-4 text-center text-xs text-[#7A7F8A]">
            No results found. Try a different search term.
          </div>
        )}
      </div>
    </div>
  );
}

function ProvidersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshots, setSnapshots] = useState<ProviderDashboardSnapshot[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasCalendar, setHasCalendar] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [initialSearch, setInitialSearch] = useState("");

  const loadData = useCallback(() => {
    apiFetch("/api/dashboard/data")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) {
          setSnapshots(json.snapshots ?? []);
          setUserId(json.appUserId ?? "");
          setHasCalendar(json.hasGoogleCalendarConnection ?? false);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-open add form if ?add=true is in URL
  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setShowAddForm(true);
      const search = searchParams.get("search") || "";
      if (search) setInitialSearch(search);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  const doctors = snapshots.filter((s) => s.provider.provider_type !== "pharmacy" && s.provider.provider_type !== "calendar");
  const pharmacies = snapshots.filter((s) => s.provider.provider_type === "pharmacy");

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <TopNav />
      <div className="mx-auto max-w-4xl px-6 pt-8 pb-20">
        <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E]">
          Your Providers
        </h1>
        <p className="mt-1 text-sm text-[#7A7F8A]">
          {snapshots.length} provider{snapshots.length !== 1 ? "s" : ""} on file
        </p>

        <BestNextStep context="providers" />

        {/* Add Provider */}
        <div className="mt-4">
          {showAddForm ? (
            <AddProviderForm
              userId={userId}
              initialSearch={initialSearch}
              onClose={() => { setShowAddForm(false); setInitialSearch(""); }}
              onAdded={() => loadData()}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 rounded-xl border border-dashed border-[#C0C8D0] px-4 py-2.5 text-sm font-medium text-[#5C6B5C] transition hover:bg-white hover:border-[#5C6B5C]"
            >
              <Plus size={16} />
              Add provider
            </button>
          )}
        </div>

        {doctors.length === 0 && pharmacies.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
            <div className="font-semibold text-[#1A1D2E]">No providers yet</div>
            <p className="mt-2 text-sm text-[#7A7F8A]">
              Providers will appear here once discovered from your bank data or added manually.
            </p>
          </div>
        ) : (
          <>
            {/* Doctors / Specialists — compact list */}
            {doctors.length > 0 && (
              <div className="mt-6 rounded-2xl bg-white border border-[#EBEDF0] shadow-sm overflow-hidden divide-y divide-[#EBEDF0]">
                {doctors.map((snapshot) => {
                  const status = getStatusLabel(snapshot);
                  const isExpanded = expandedId === snapshot.provider.id;
                  const subtitle = snapshot.provider.doctor_name
                    ? `Dr. ${snapshot.provider.doctor_name}${snapshot.provider.specialty ? ` · ${snapshot.provider.specialty}` : ""}`
                    : snapshot.provider.specialty || null;

                  const hasNotes = !!(snapshot.latestNote?.office_instructions || snapshot.latestNote?.follow_up_notes);

                  return (
                    <div key={snapshot.provider.id}>
                      <button
                        type="button"
                        onClick={() => toggleExpand(snapshot.provider.id)}
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#F8F9FA] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#1A1D2E] truncate">
                              {snapshot.provider.name}
                            </span>
                            {hasNotes && (
                              <span className="text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 font-medium shrink-0">
                                Notes
                              </span>
                            )}
                          </div>
                          {subtitle && (
                            <div className="text-xs text-[#7A7F8A] truncate mt-0.5">
                              {subtitle}
                            </div>
                          )}
                          {/* Show brief note preview */}
                          {snapshot.latestNote?.summary && !isExpanded && (
                            <div className="text-xs text-[#B0B4BC] truncate mt-1">
                              {snapshot.latestNote.summary.slice(0, 100)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                          <span className="text-[#B0B4BC]">
                            <ChevronIcon open={isExpanded} />
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3">
                          {/* Office notes section */}
                          {(snapshot.latestNote?.office_instructions || snapshot.latestNote?.follow_up_notes) && (
                            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                              <div className="text-xs font-semibold text-amber-700 mb-2">Important Notes from Office</div>
                              {snapshot.latestNote.office_instructions && (
                                <div className="text-sm text-amber-900">{snapshot.latestNote.office_instructions}</div>
                              )}
                              {snapshot.latestNote.follow_up_notes && (
                                <div className="text-sm text-amber-900 mt-1">{snapshot.latestNote.follow_up_notes}</div>
                              )}
                            </div>
                          )}
                          <ProviderCard
                            snapshot={snapshot}
                            userId={userId}
                            hasGoogleCalendarConnection={hasCalendar}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pharmacies */}
            {pharmacies.length > 0 && (
              <div className="mt-8">
                <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC] mb-3">
                  Pharmacies
                </div>
                <div className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm overflow-hidden divide-y divide-[#EBEDF0]">
                  {pharmacies.map((snapshot) => (
                    <div
                      key={snapshot.provider.id}
                      className="flex items-center justify-between px-5 py-4"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#1A1D2E]">
                          {snapshot.provider.name}
                        </div>
                        <div className="text-xs text-[#7A7F8A]">Pharmacy</div>
                      </div>
                      <span className="inline-flex rounded-full bg-[#F0F2F5] px-2.5 py-0.5 text-xs font-medium text-[#7A7F8A] ring-1 ring-[#EBEDF0]">Tracked</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function ProvidersPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />}>
      <ProvidersInner />
    </Suspense>
  );
}
