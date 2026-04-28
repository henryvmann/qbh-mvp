"use client";

import { Suspense, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopNav from "../../components/qbh/TopNav";
import BestNextStep from "../../components/qbh/BestNextStep";
import { apiFetch } from "../../lib/api";
import ProviderCard from "../../components/qbh/ProviderCard";
import { Plus, Search, X, Check } from "lucide-react";
import Link from "next/link";
import ProviderLink from "../../components/qbh/ProviderLink";
import NextSteps from "../../components/qbh/NextSteps";
import type { ProviderDashboardSnapshot } from "../lib/QBH/types";
import { SPECIALTY_COLORS, getSpecialtyColor as getSpecialtyColorBase } from "../../lib/qbh/provider-utils";

function getSpecialtyColor(snapshot: ProviderDashboardSnapshot) {
  return getSpecialtyColorBase(snapshot.provider);
}

function getStatusLabel(snapshot: ProviderDashboardSnapshot): { label: string; className: string } {
  const bs = snapshot.booking_state;
  const actions = snapshot.system_actions;

  if (actions.integrity.hasMultipleFutureConfirmedEvents) {
    return { label: "Needs review", className: "bg-red-50 text-red-600 ring-1 ring-red-200" };
  }
  if (actions.current?.status === "BLOCKED") {
    return { label: "Blocked", className: "bg-red-50 text-red-600 ring-1 ring-red-200" };
  }
  if (snapshot.provider.confirmed_status === "recurring") {
    return { label: "Recurring", className: "bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/30" };
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

/** Color palette for provider specialty types */

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
  const [userLocation, setUserLocation] = useState<string>("");
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect user location via IP for nearby provider suggestions
  useEffect(() => {
    inputRef.current?.focus();
    // Fetch user location
    fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) })
      .then((r) => r.json())
      .then((geo) => {
        if (geo?.city && geo?.region_code) {
          setUserLocation(`${geo.city}, ${geo.region_code}`);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        // Search with original query first — only append location for specialty-only searches
        const isSpecialtyOnly = /^(dentist|doctor|therapist|cardiologist|dermatologist|optometrist|psychiatrist|pediatrician|obgyn|urologist|neurologist|allergist|chiropractor|podiatrist|ent)s?$/i.test(query.trim());
        const searchQuery = isSpecialtyOnly && userLocation ? `${query} ${userLocation}` : query;
        const res = await apiFetch(`/api/npi/search?q=${encodeURIComponent(searchQuery)}`);
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

  const [addError, setAddError] = useState<string | null>(null);

  async function handleAdd(result: NpiResult) {
    setAdding(result.name);
    setAddError(null);
    try {
      const res = await apiFetch("/api/providers/add-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(userId ? { app_user_id: userId } : {}),
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
      } else {
        setAddError(data.error || "Failed to add provider");
      }
    } catch {
      setAddError("Network error — please try again");
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
        {userLocation && !query && (
          <p className="mt-1.5 text-[10px] text-[#B0B4BC]">
            Searching near {userLocation}. Include a city or state for other areas.
          </p>
        )}

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

        {addError && (
          <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">
            {addError}
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<"choose" | "link" | "search">("choose");
  const [confirmSearchQuery, setConfirmSearchQuery] = useState("");
  const [confirmSearchResults, setConfirmSearchResults] = useState<Array<{ name: string; phone?: string; specialty?: string; npi?: string }>>([]);
  const [confirmSearching, setConfirmSearching] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedDismiss, setExpandedDismiss] = useState<string | null>(null);
  const [careRecipients, setCareRecipients] = useState<Array<{ id: string; name: string; relationship: string }>>([]);
  const [userName, setUserName] = useState("");
  const [editingRecipient, setEditingRecipient] = useState<string | null>(null);
  const [editRecipientName, setEditRecipientName] = useState("");
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

    // Load care recipients
    apiFetch("/api/patient-profile").then((r) => r.json()).then((data) => {
      if (data?.profile?.care_recipients) setCareRecipients(data.profile.care_recipients);
      const p = data?.profile;
      if (p) setUserName(p.display_name || p.nickname || (p.full_name ? p.full_name.split(" ")[0] : ""));
    }).catch(() => {});
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-open add form if ?add=true is in URL (search bar always starts blank)
  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setShowAddForm(true);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  const allDoctors = snapshots.filter((s) => s.provider.provider_type !== "pharmacy" && s.provider.provider_type !== "calendar");
  const pharmacies = snapshots.filter((s) => s.provider.provider_type === "pharmacy");

  // Group doctors by care team
  const careTeams = new Map<string, typeof allDoctors>();
  const ungrouped: typeof allDoctors = [];
  for (const s of allDoctors) {
    const team = s.provider.care_team;
    if (team) {
      if (!careTeams.has(team)) careTeams.set(team, []);
      careTeams.get(team)!.push(s);
    } else {
      ungrouped.push(s);
    }
  }
  const doctors = ungrouped; // backwards compat — ungrouped renders in the existing grid

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
          {userName ? `${userName}\u2019s Providers` : "Your Providers"}
        </h1>
        <p className="mt-1 text-sm text-[#7A7F8A]">
          {snapshots.length} provider{snapshots.length !== 1 ? "s" : ""} on file
        </p>

        {/* Care Recipients */}
        {careRecipients.length > 0 && (
          <div className="mt-4 mb-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#B0B4BC] mb-2">Managing Care For</div>
            <div className="flex flex-wrap gap-2">
              {careRecipients.map((r) => (
                <Link
                  key={r.id}
                  href="/care-recipients"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#EBEDF0] px-3 py-1 text-xs font-medium text-[#1A1D2E] shadow-sm hover:border-[#5C6B5C] transition"
                >
                  {r.name}
                  <span className="text-[10px] text-[#B0B4BC]">{r.relationship}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <BestNextStep context="providers" />

        {/* Add Provider */}
        <div data-tour="add-provider" className="mt-4">
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
            {/* Care Team Groups */}
            {careTeams.size > 0 && Array.from(careTeams.entries()).map(([teamName, teamDoctors]) => (
              <div key={teamName} className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#5C6B5C]">
                    {teamName}
                  </span>
                  <span className="text-[10px] text-[#B0B4BC]">
                    {teamDoctors.length} provider{teamDoctors.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  {teamDoctors.map((snapshot) => {
                    const status = getStatusLabel(snapshot);
                    const colors = getSpecialtyColor(snapshot);
                    const subtitle = snapshot.provider.doctor_name
                      ? `Dr. ${snapshot.provider.doctor_name}${snapshot.provider.specialty ? ` · ${snapshot.provider.specialty}` : ""}`
                      : snapshot.provider.specialty || null;

                    return (
                      <div
                        key={snapshot.provider.id}
                        className="rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md"
                        style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.accent }}>
                                {colors.label}
                              </span>
                              <div className="mt-1.5 text-base font-semibold leading-tight">
                                <ProviderLink providerId={snapshot.provider.id} providerName={snapshot.provider.name} />
                              </div>
                              {subtitle && (
                                <div className="text-xs mt-1" style={{ color: colors.accent + "99" }}>{subtitle}</div>
                              )}
                            </div>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${status.className}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Ungrouped Doctors / Specialists — color-coded cards */}
            {doctors.length > 0 && (
              <div data-tour="provider-list" className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                {doctors.map((snapshot) => {
                  const status = getStatusLabel(snapshot);
                  const colors = getSpecialtyColor(snapshot);
                  const isExpanded = expandedId === snapshot.provider.id;
                  const subtitle = snapshot.provider.doctor_name
                    ? `Dr. ${snapshot.provider.doctor_name}${snapshot.provider.specialty ? ` · ${snapshot.provider.specialty}` : ""}`
                    : snapshot.provider.specialty || null;

                  const hasNotes = !!(snapshot.latestNote?.office_instructions || snapshot.latestNote?.follow_up_notes);

                  return (
                    <div
                      key={snapshot.provider.id}
                      className="rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md"
                      style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(snapshot.provider.id)}
                        className="w-full text-left p-5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[10px] font-bold uppercase tracking-wider"
                                style={{ color: colors.accent }}
                              >
                                {colors.label}
                              </span>
                              {hasNotes && (
                                <span className="text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 font-medium shrink-0">
                                  Notes
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 text-base font-semibold leading-tight">
                              <ProviderLink providerId={snapshot.provider.id} providerName={snapshot.provider.name} />
                            </div>
                            {subtitle && (
                              <div className="text-xs mt-1" style={{ color: colors.accent + "99" }}>
                                {subtitle}
                              </div>
                            )}
                            {/* Care recipient badges */}
                            {(() => {
                              let recipients: string[] = [];
                              try {
                                const raw = snapshot.provider.care_recipient;
                                if (raw) recipients = typeof raw === "string" ? JSON.parse(raw) : raw;
                              } catch {}
                              if (!recipients || recipients.length === 0) return null;

                              // Build smart initials — use first letter, or first two if duplicates
                              const allNames = careRecipients.map((r) => r.name);
                              const SELF_LABELS = ["self", "myself", "me", "my health"];
                              function getInitial(recipientLabel: string): string {
                                const lower = recipientLabel.toLowerCase().trim();
                                // Try matching by ID first, then name, then relationship, then self-labels
                                const match = careRecipients.find((r) => {
                                  if (r.id === recipientLabel) return true;
                                  if (r.name === recipientLabel) return true;
                                  if (r.relationship === recipientLabel) return true;
                                  if (r.name.toLowerCase() === lower) return true;
                                  if (r.relationship.toLowerCase() === lower) return true;
                                  // "Myself", "Me", "Self", "My health" → match the Self care recipient
                                  if (SELF_LABELS.includes(lower) && r.relationship === "Self") return true;
                                  // Partial match: if the label contains the name or vice versa
                                  if (lower.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(lower)) return true;
                                  return false;
                                });
                                const name = match?.name || recipientLabel;
                                const first = name.charAt(0).toUpperCase();
                                const duplicates = allNames.filter((n) => n.charAt(0).toUpperCase() === first);
                                if (duplicates.length > 1) return name.slice(0, 2);
                                return first;
                              }

                              return (
                                <div className="flex gap-1 mt-1.5">
                                  {recipients.map((r) => (
                                    <span
                                      key={r}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#5C6B5C]/15 text-[9px] font-bold text-[#5C6B5C]"
                                      title={(() => {
                                        const lr = r.toLowerCase();
                                        return careRecipients.find((cr) =>
                                          cr.relationship === r || cr.name === r ||
                                          cr.relationship.toLowerCase() === lr || cr.name.toLowerCase() === lr ||
                                          (SELF_LABELS.includes(lr) && cr.relationship === "Self")
                                        )?.name || r;
                                      })()}
                                    >
                                      {getInitial(r)}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                              {status.label}
                            </span>
                            <a
                              href={`/providers/${snapshot.provider.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] font-medium underline underline-offset-2 transition"
                              style={{ color: colors.accent }}
                            >
                              Edit
                            </a>
                            <span style={{ color: colors.accent + "80" }}>
                              <ChevronIcon open={isExpanded} />
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Confirm Provider for unconfirmed calendar providers */}
                      {snapshot.provider.source === "calendar" && !snapshot.provider.confirmed_status && snapshot.booking_state?.status === "NONE" && (
                        confirmingId === snapshot.provider.id ? (
                          <div className="px-5 pb-4 border-t" style={{ borderColor: colors.border }}>
                            {confirmMode === "choose" && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs font-semibold text-[#1A1D2E]">What is this provider?</p>
                                <button
                                  onClick={() => setConfirmMode("link")}
                                  className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-2.5 text-left text-sm text-[#1A1D2E] hover:bg-[#F4F5F7]"
                                >
                                  Link to a provider on your profile
                                </button>
                                <button
                                  onClick={() => setConfirmMode("search")}
                                  className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-2.5 text-left text-sm text-[#1A1D2E] hover:bg-[#F4F5F7]"
                                >
                                  Search for your provider
                                </button>
                                <button
                                  onClick={async () => {
                                    await apiFetch("/api/providers/confirm", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ provider_id: snapshot.provider.id, recurring: true }),
                                    });
                                    setConfirmingId(null);
                                    window.location.reload();
                                  }}
                                  className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-2.5 text-left text-sm text-[#7A7F8A] hover:bg-[#F4F5F7]"
                                >
                                  Already recurring — no booking needed
                                </button>
                                <button onClick={() => { setConfirmingId(null); setConfirmMode("choose"); }} className="text-xs text-[#B0B4BC] mt-1">
                                  Cancel
                                </button>
                              </div>
                            )}
                            {confirmMode === "link" && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs font-semibold text-[#1A1D2E]">Select an existing provider:</p>
                                {allDoctors.filter((s) => s.provider.id !== snapshot.provider.id && s.provider.source !== "calendar").map((s) => (
                                  <button
                                    key={s.provider.id}
                                    onClick={async () => {
                                      await apiFetch("/api/providers/confirm", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ provider_id: snapshot.provider.id, link_to_provider_id: s.provider.id }),
                                      });
                                      setConfirmingId(null);
                                      setConfirmMode("choose");
                                      window.location.reload();
                                    }}
                                    className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-2.5 text-left text-sm text-[#1A1D2E] hover:bg-[#F4F5F7]"
                                  >
                                    {s.provider.name}{s.provider.specialty ? ` · ${s.provider.specialty}` : ""}
                                  </button>
                                ))}
                                <button onClick={() => setConfirmMode("choose")} className="text-xs text-[#B0B4BC] mt-1">
                                  ← Back
                                </button>
                              </div>
                            )}
                            {confirmMode === "search" && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs font-semibold text-[#1A1D2E]">Search for this provider:</p>
                                <input
                                  type="text"
                                  value={confirmSearchQuery}
                                  onChange={(e) => setConfirmSearchQuery(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === "Enter" && confirmSearchQuery.trim()) {
                                      setConfirmSearching(true);
                                      try {
                                        const res = await apiFetch(`/api/npi/search?q=${encodeURIComponent(confirmSearchQuery.trim())}`);
                                        const data = await res.json();
                                        setConfirmSearchResults(data?.results || []);
                                      } catch {} finally { setConfirmSearching(false); }
                                    }
                                  }}
                                  placeholder="Provider name, then press Enter"
                                  className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                                />
                                {confirmSearching && <p className="text-xs text-[#7A7F8A]">Searching...</p>}
                                {confirmSearchResults.map((r, i) => (
                                  <button
                                    key={i}
                                    onClick={async () => {
                                      await apiFetch("/api/providers/confirm", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          provider_id: snapshot.provider.id,
                                          name: r.name,
                                          phone_number: r.phone,
                                          specialty: r.specialty,
                                          npi: r.npi,
                                        }),
                                      });
                                      setConfirmingId(null);
                                      setConfirmMode("choose");
                                      setConfirmSearchQuery("");
                                      setConfirmSearchResults([]);
                                      window.location.reload();
                                    }}
                                    className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-2.5 text-left text-sm text-[#1A1D2E] hover:bg-[#F4F5F7]"
                                  >
                                    <div className="font-medium">{r.name}</div>
                                    {r.specialty && <div className="text-xs text-[#7A7F8A]">{r.specialty}</div>}
                                  </button>
                                ))}
                                <button onClick={() => { setConfirmMode("choose"); setConfirmSearchResults([]); setConfirmSearchQuery(""); }} className="text-xs text-[#B0B4BC] mt-1">
                                  ← Back
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="px-5 pb-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmingId(snapshot.provider.id); setConfirmMode("choose"); }}
                              className="rounded-xl px-4 py-2 text-xs font-semibold text-white"
                              style={{ backgroundColor: "#5C6B5C" }}
                            >
                              Confirm Provider
                            </button>
                          </div>
                        )
                      )}

                      {isExpanded && (
                        <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: colors.border }}>
                          {/* Office notes section */}
                          {(snapshot.latestNote?.office_instructions || snapshot.latestNote?.follow_up_notes) && (
                            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
                              <div className="text-xs font-semibold text-amber-700 mb-2">Important Notes from Office</div>
                              {snapshot.latestNote.office_instructions && (
                                <div className="text-sm text-amber-900">{snapshot.latestNote.office_instructions}</div>
                              )}
                              {snapshot.latestNote.follow_up_notes && (
                                <div className="text-sm text-amber-900 mt-1">{snapshot.latestNote.follow_up_notes}</div>
                              )}
                            </div>
                          )}
                          <div className="mt-3">
                            <ProviderCard
                              snapshot={snapshot}
                              userId={userId}
                              hasGoogleCalendarConnection={hasCalendar}
                            />
                          </div>
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

            {/* Missing specialty placeholders */}
            {(() => {
              const allProviderText = allDoctors.map((s) =>
                `${s.provider.name} ${s.provider.specialty || ""} ${s.provider.provider_type || ""}`.toLowerCase()
              ).join(" ");

              // Check dismissed types from patient profile
              const dismissedKey = "qbh_dismissed_provider_types";
              let dismissed: string[] = [];
              try {
                const stored = localStorage.getItem(dismissedKey);
                if (stored) dismissed = JSON.parse(stored);
              } catch {}

              const missing: { label: string; color: string; border: string; keywords: RegExp; dismissId: string }[] = [];
              if (!/primary|pcp|internal|family|general/.test(allProviderText) && !dismissed.includes("pcp"))
                missing.push({ label: "Primary Care", color: "#E8F5E8", border: "#C2D9B8", keywords: /primary care/, dismissId: "pcp" });
              if (!/dent|dds|oral/.test(allProviderText) && !dismissed.includes("dentist"))
                missing.push({ label: "Dentist", color: "#E0F0FF", border: "#B0D0E8", keywords: /dentist/, dismissId: "dentist" });
              if (!/eye|vision|optom|ophthal/.test(allProviderText) && !dismissed.includes("eye"))
                missing.push({ label: "Eye Doctor", color: "#FFF5E0", border: "#E8D0A0", keywords: /eye/, dismissId: "eye" });
              if (!/therap|psych|counsel|mental/.test(allProviderText) && !dismissed.includes("therapist"))
                missing.push({ label: "Therapist", color: "#F0E8F5", border: "#D0B8E0", keywords: /therapist/, dismissId: "therapist" });
              if (!/derm|skin/.test(allProviderText) && !dismissed.includes("dermatologist"))
                missing.push({ label: "Dermatologist", color: "#FFF0E8", border: "#E8C8B0", keywords: /dermatologist/, dismissId: "dermatologist" });

              if (missing.length === 0) return null;
              return (
                <div className="mt-8">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC] mb-3">
                    Build Your Care Team
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {missing.map((m) => (
                      <div
                        key={m.label}
                        className="rounded-2xl border-2 border-dashed p-5"
                        style={{ borderColor: m.border, backgroundColor: m.color + "40" }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddForm(true);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <div>
                            <div className="text-sm font-semibold text-[#1A1D2E]">Your {m.label}</div>
                            <div className="text-xs text-[#7A7F8A]">Add one to your care team</div>
                          </div>
                          <Plus size={18} className="text-[#B0B4BC]" />
                        </button>
                        {expandedDismiss === m.dismissId ? (
                          <div className="mt-3 rounded-xl bg-white border border-[#EBEDF0] p-3">
                            <p className="text-xs text-[#1A1D2E]">Would you like Kate to help you find a {m.label.toLowerCase()} nearby?</p>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedDismiss(null);
                                  window.dispatchEvent(new CustomEvent("kate-quick-action", {
                                    detail: { message: `Help me find a ${m.label.toLowerCase()} near me` },
                                  }));
                                }}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                                style={{ backgroundColor: "#5C6B5C" }}
                              >
                                Yes, Help Me Find One
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    const stored = localStorage.getItem(dismissedKey);
                                    const current: string[] = stored ? JSON.parse(stored) : [];
                                    current.push(m.dismissId);
                                    localStorage.setItem(dismissedKey, JSON.stringify(current));
                                    apiFetch("/api/patient-profile", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        profile: { dismissed_provider_types: current },
                                      }),
                                    });
                                    window.location.reload();
                                  } catch {}
                                }}
                                className="rounded-lg px-3 py-1.5 text-xs text-[#7A7F8A] hover:bg-[#F0F2F5]"
                              >
                                No Thanks
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedDismiss(m.dismissId)}
                            className="mt-2 text-[10px] text-[#B0B4BC] hover:text-[#7A7F8A] underline underline-offset-2"
                          >
                            Help me find one
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}
        <NextSteps />
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
