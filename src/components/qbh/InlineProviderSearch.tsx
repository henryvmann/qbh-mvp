"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../../lib/api";
import { Search, Check, Link as LinkIcon } from "lucide-react";

type NpiResult = {
  npi: string | null;
  name: string;
  specialty: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
};

type ExistingProvider = {
  id: string;
  name: string;
  specialty?: string | null;
};

type Props = {
  onAdded: () => void;
  onCancel: () => void;
};

export default function InlineProviderSearch({ onAdded, onCancel }: Props) {
  const [mode, setMode] = useState<"choose" | "search" | "link">("choose");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NpiResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [existingProviders, setExistingProviders] = useState<ExistingProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch existing providers for "link" mode
  useEffect(() => {
    if (mode !== "link") return;
    setLoadingProviders(true);
    apiFetch("/api/dashboard/data")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          const provs = (data.snapshots || []).map((s: any) => ({
            id: s.provider.id,
            name: s.provider.name,
            specialty: s.provider.specialty,
          }));
          setExistingProviders(provs);
        }
      })
      .finally(() => setLoadingProviders(false));
  }, [mode]);

  useEffect(() => {
    if (mode === "search") inputRef.current?.focus();
  }, [mode]);

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
      } catch {}
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleAddNew(result: NpiResult) {
    setAdding(result.name);
    try {
      const res = await apiFetch("/api/providers/add-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.name,
          phone_number: result.phone,
          specialty: result.specialty,
          npi: result.npi,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAdded(true);
        setTimeout(() => onAdded(), 800);
      }
    } catch {}
    finally { setAdding(null); }
  }

  function handleLinkExisting(provider: ExistingProvider) {
    // Just mark as linked — the provider already exists
    setAdded(true);
    setTimeout(() => onAdded(), 800);
  }

  if (added) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs font-medium text-emerald-600">
        <Check size={14} /> Provider linked
      </div>
    );
  }

  // Step 1: Choose between link existing or add new
  if (mode === "choose") {
    return (
      <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setMode("link")}
          className="w-full flex items-center gap-2 rounded-lg border border-[#EBEDF0] bg-white px-3 py-2 text-xs font-medium text-[#1A1D2E] hover:bg-[#F8F9FA] transition text-left"
        >
          <LinkIcon size={12} className="text-[#5C6B5C] shrink-0" />
          Link To Existing Provider
        </button>
        <button
          type="button"
          onClick={() => setMode("search")}
          className="w-full flex items-center gap-2 rounded-lg border border-[#EBEDF0] bg-white px-3 py-2 text-xs font-medium text-[#1A1D2E] hover:bg-[#F8F9FA] transition text-left"
        >
          <Search size={12} className="text-[#5C6B5C] shrink-0" />
          Search For New Provider
        </button>
        <button type="button" onClick={onCancel} className="text-[10px] text-[#7A7F8A] hover:text-[#1A1D2E]">
          Cancel
        </button>
      </div>
    );
  }

  // Step 2a: Link to existing provider
  if (mode === "link") {
    return (
      <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
        {loadingProviders ? (
          <p className="text-xs text-[#7A7F8A]">Loading providers...</p>
        ) : existingProviders.length === 0 ? (
          <div>
            <p className="text-xs text-[#7A7F8A]">No providers on file yet.</p>
            <button type="button" onClick={() => setMode("search")} className="mt-1 text-xs font-medium text-[#5C6B5C] underline underline-offset-2">
              Search for a new one
            </button>
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto divide-y divide-[#EBEDF0] rounded-lg border border-[#EBEDF0] bg-white">
            {existingProviders.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleLinkExisting(p)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#F8F9FA] transition"
              >
                <div>
                  <div className="text-xs font-medium text-[#1A1D2E]">{p.name}</div>
                  {p.specialty && <div className="text-[10px] text-[#7A7F8A]">{p.specialty}</div>}
                </div>
                <span className="text-[10px] font-medium text-[#5C6B5C]">Link</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={() => setMode("choose")} className="text-[10px] text-[#7A7F8A] hover:text-[#1A1D2E]">
            ← Back
          </button>
          <button type="button" onClick={onCancel} className="text-[10px] text-[#7A7F8A] hover:text-[#1A1D2E]">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Step 2b: Search NPI for new provider
  return (
    <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#B0B4BC]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, specialty, or location..."
          className="w-full rounded-lg border border-[#EBEDF0] bg-white py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
        />
        {searching && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#7A7F8A]">Searching...</span>
        )}
      </div>

      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto divide-y divide-[#EBEDF0] rounded-lg border border-[#EBEDF0] bg-white">
          {results.slice(0, 5).map((result) => (
            <div key={result.npi || result.name} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[#1A1D2E] truncate">{result.name}</div>
                <div className="text-[10px] text-[#7A7F8A] truncate">
                  {[result.specialty, result.city, result.state].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAddNew(result)}
                disabled={!!adding}
                className="shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#5C6B5C" }}
              >
                {adding === result.name ? "..." : "Add"}
              </button>
            </div>
          ))}
        </div>
      )}

      {query.length >= 2 && !searching && results.length === 0 && (
        <div className="py-2 text-center text-[10px] text-[#7A7F8A]">No results found</div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => setMode("choose")} className="text-[10px] text-[#7A7F8A] hover:text-[#1A1D2E]">
          ← Back
        </button>
        <button type="button" onClick={onCancel} className="text-[10px] text-[#7A7F8A] hover:text-[#1A1D2E]">
          Cancel
        </button>
      </div>
    </div>
  );
}
