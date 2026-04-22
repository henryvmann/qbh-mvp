"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../../lib/api";
import { Search, Check } from "lucide-react";

type NpiResult = {
  npi: string | null;
  name: string;
  specialty: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
};

type Props = {
  onAdded: () => void;
  onCancel: () => void;
  saving?: boolean;
};

export default function InlineProviderSearch({ onAdded, onCancel }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NpiResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
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
    } catch {
      // best effort
    } finally {
      setAdding(null);
    }
  }

  if (added) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs font-medium text-emerald-600">
        <Check size={14} /> Provider added
      </div>
    );
  }

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
                onClick={() => handleAdd(result)}
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
        <div className="py-2 text-center text-[10px] text-[#7A7F8A]">
          No results found
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="text-[10px] text-[#7A7F8A] hover:text-[#1A1D2E] transition"
      >
        Cancel
      </button>
    </div>
  );
}
