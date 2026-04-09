"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type EpicOrg = {
  name: string;
  fhirBaseUrl: string;
};

type EpicOrgPickerProps = {
  onSelect: (org: EpicOrg) => void;
  selected?: EpicOrg | null;
};

export default function EpicOrgPicker({ onSelect, selected }: EpicOrgPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EpicOrg[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/epic/organizations/search?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setResults(data.results || []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(org: EpicOrg) {
    onSelect(org);
    setQuery(org.name);
    setOpen(false);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    onSelect({ name: "", fhirBaseUrl: "" });
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <label className="mb-2 block text-sm font-medium text-[#7A7F8A]">
        Search for your health system
      </label>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected?.name && e.target.value !== selected.name) {
              onSelect({ name: "", fhirBaseUrl: "" });
            }
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder="e.g. Yale New Haven, Stamford Health, Mayo Clinic..."
          className="w-full rounded-xl bg-white px-4 py-3 text-[#1A1D2E] placeholder-[#7A7F8A]/50 border border-[#EBEDF0] shadow-sm transition-colors focus:outline-none focus:ring-[#5C6B5C]/60"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7F8A] hover:text-[#1A1D2E]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-2 text-xs text-[#7A7F8A]">Searching...</div>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl bg-white border border-[#EBEDF0] shadow-lg">
          {results.map((org) => (
            <li key={org.fhirBaseUrl}>
              <button
                type="button"
                onClick={() => handleSelect(org)}
                className="w-full px-4 py-3 text-left text-sm text-[#1A1D2E] transition-colors hover:bg-[#F0F2F5] first:rounded-t-xl last:rounded-b-xl"
              >
                {org.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && query.length >= 2 && results.length === 0 && (
        <div className="mt-2 text-xs text-[#7A7F8A]">
          No Epic organizations found for &ldquo;{query}&rdquo;
        </div>
      )}

      {selected?.name && selected?.fhirBaseUrl && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#5C6B5C]/10 px-3 py-2 text-sm text-[#5C6B5C]">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8.5l3 3 7-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {selected.name}
        </div>
      )}
    </div>
  );
}
