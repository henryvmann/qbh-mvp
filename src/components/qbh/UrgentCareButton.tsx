"use client";

import { useState, useCallback } from "react";
import { Phone, MapPin, AlertTriangle, Heart, X, Search, PhoneCall } from "lucide-react";
import { apiFetch } from "../../lib/api";

const ACCENT = "#5C6B5C";
const URGENT_RED = "#DC2626";

type NearbyResult = {
  name: string;
  address: string;
  phone: string | null;
  type: "urgent_care" | "er";
};

export default function UrgentCareButton() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "search">("menu");
  const [searchType, setSearchType] = useState<"urgent_care" | "er">("urgent_care");
  const [results, setResults] = useState<NearbyResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingProvider, setAddingProvider] = useState<string | null>(null);
  const [addedProviders, setAddedProviders] = useState<Set<string>>(new Set());
  const [callingProvider, setCallingProvider] = useState<string | null>(null);

  const searchNearby = useCallback(async (type: "urgent_care" | "er") => {
    setSearchType(type);
    setView("search");
    setSearching(true);
    setResults([]);

    const query = type === "urgent_care" ? "urgent care" : "emergency room";

    try {
      const res = await apiFetch(`/api/npi/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.ok && data.results?.length > 0) {
        setResults(
          data.results.slice(0, 8).map((r: any) => ({
            name: r.name,
            address: [r.city, r.state].filter(Boolean).join(", "),
            phone: r.phone,
            type,
          }))
        );
      }
    } catch {
      // Best effort
    } finally {
      setSearching(false);
    }
  }, []);

  async function addProviderAndCall(result: NearbyResult) {
    setAddingProvider(result.name);

    try {
      // Add as provider
      const addRes = await apiFetch("/api/providers/add-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.name,
          phone_number: result.phone,
          specialty: result.type === "urgent_care" ? "Urgent Care" : "Emergency Room",
        }),
      });
      const addData = await addRes.json();

      if (addData.ok && addData.provider_id) {
        setAddedProviders((prev) => new Set([...prev, result.name]));

        // Now have Kate call
        setCallingProvider(result.name);
        await apiFetch("/api/vapi/start-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider_id: addData.provider_id,
            provider_name: result.name,
            office_number: result.phone,
            mode: "BOOK",
          }),
        });

        setCallingProvider(null);
      }
    } catch {
      // Best effort
    } finally {
      setAddingProvider(null);
    }
  }

  return (
    <>
      {/* Thin bar trigger */}
      <button
        type="button"
        onClick={() => { setOpen(true); setView("menu"); }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 transition hover:bg-red-50/50"
        style={{ backgroundColor: "transparent", borderColor: "#E8D0CC" }}
      >
        <Heart size={13} className="text-red-400" />
        <span className="text-xs font-medium text-red-400">
          Need help now?
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />

          <div
            className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white px-6 pb-8 pt-5 shadow-xl sm:rounded-3xl sm:mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-[#B0B4BC] hover:bg-[#F0F2F5]"
            >
              <X size={20} />
            </button>

            {view === "menu" ? (
              <>
                <div className="flex items-center gap-2 mb-5">
                  <AlertTriangle size={20} className="text-red-600" />
                  <h2 className="text-lg font-semibold text-[#1A1D2E]">
                    Need help right now?
                  </h2>
                </div>

                <div className="space-y-3">
                  {/* 911 disclaimer — no tel: link */}
                  <div className="flex items-center gap-4 rounded-2xl border border-red-200 bg-red-50/50 px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                      <Phone size={18} className="text-red-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-red-700">If this is a medical emergency, call 911</div>
                      <div className="text-xs text-red-400">Quarterback Health is not an emergency service</div>
                    </div>
                  </div>

                  {/* Urgent Care — in-app search */}
                  <button
                    type="button"
                    onClick={() => searchNearby("urgent_care")}
                    className="flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition hover:bg-[#F8FAF8]"
                    style={{ borderColor: "#D0DDD0" }}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "#E8F0E8" }}>
                      <Search size={18} style={{ color: ACCENT }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: ACCENT }}>Find urgent care near you</div>
                      <div className="text-xs text-[#7A7F8A]">Search and book immediately</div>
                    </div>
                  </button>

                  {/* ER — in-app search */}
                  <button
                    type="button"
                    onClick={() => searchNearby("er")}
                    className="flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition hover:bg-[#F5F0F8]"
                    style={{ borderColor: "#D8D0E0" }}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDE8F5]">
                      <MapPin size={18} className="text-[#5C4A8A]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#5C4A8A]">Find your nearest ER</div>
                      <div className="text-xs text-[#7A7F8A]">Search emergency rooms</div>
                    </div>
                  </button>

                  {/* Kate */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      window.dispatchEvent(
                        new CustomEvent("kate-quick-action", {
                          detail: { message: "I need to find care nearby \u2014 where should I go?" },
                        })
                      );
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition hover:bg-[#F0F8FF]"
                    style={{ borderColor: "#C0D8E8" }}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E0F0FF]">
                      <Heart size={18} className="text-[#2A6090]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#2A6090]">
                        Ask Kate to help find care nearby
                      </div>
                      <div className="text-xs text-[#7A7F8A]">Your care coordinator can help you find options</div>
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Search results view */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setView("menu")}
                    className="rounded-lg p-1 text-[#7A7F8A] hover:bg-[#F0F2F5]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <h2 className="text-lg font-semibold text-[#1A1D2E]">
                    {searchType === "urgent_care" ? "Urgent Care" : "Emergency Rooms"}
                  </h2>
                </div>

                {searching ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5C6B5C] border-t-transparent" />
                  </div>
                ) : results.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="text-sm text-[#7A7F8A]">No results found nearby.</div>
                    <a
                      href={`https://www.google.com/maps/search/${searchType === "urgent_care" ? "urgent+care" : "emergency+room"}+near+me`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm font-medium text-[#5C6B5C] hover:underline"
                    >
                      Search on Google Maps instead →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {results.map((result) => {
                      const isAdded = addedProviders.has(result.name);
                      const isAdding = addingProvider === result.name;
                      const isCalling = callingProvider === result.name;

                      return (
                        <div
                          key={result.name}
                          className="rounded-xl border border-[#EBEDF0] bg-white p-4 shadow-sm"
                        >
                          <div className="text-sm font-semibold text-[#1A1D2E]">
                            {result.name}
                          </div>
                          {result.address && (
                            <div className="text-xs text-[#7A7F8A] mt-0.5">{result.address}</div>
                          )}
                          {result.phone && (
                            <div className="text-xs text-[#7A7F8A] mt-0.5">{result.phone}</div>
                          )}

                          <div className="mt-3 flex gap-2">
                            {isAdded ? (
                              <span className="text-xs font-medium text-[#5C6B5C]">
                                {isCalling ? "Kate is calling..." : "✓ Added — Kate is on it"}
                              </span>
                            ) : (
                              <>
                                {result.phone && (
                                  <button
                                    onClick={() => addProviderAndCall(result)}
                                    disabled={!!addingProvider}
                                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                    style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
                                  >
                                    <PhoneCall size={12} />
                                    {isAdding ? "Adding..." : "Add & have Kate call"}
                                  </button>
                                )}
                                <a
                                  href={`tel:${result.phone}`}
                                  className="flex items-center gap-1.5 rounded-lg border border-[#EBEDF0] px-3 py-1.5 text-xs font-medium text-[#7A7F8A] hover:bg-[#F0F2F5]"
                                >
                                  <Phone size={12} />
                                  Call directly
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <a
                      href={`https://www.google.com/maps/search/${searchType === "urgent_care" ? "urgent+care" : "emergency+room"}+near+me`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-center text-xs text-[#7A7F8A] hover:underline"
                    >
                      See more on Google Maps →
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
