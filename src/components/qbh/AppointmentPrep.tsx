"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "../../lib/api";

type PrepData = {
  provider_name: string;
  appointment_date: string | null;
  visit_type: string;
  history_summary: string;
  related_care: string;
  questions_to_ask: string[];
  things_to_bring: string[];
  prep_notes: string;
  kate_note: string;
};

type AppointmentPrepProps = {
  providerId: string;
  providerName: string;
};

export default function AppointmentPrep({
  providerId,
  providerName,
}: AppointmentPrepProps) {
  const [prep, setPrep] = useState<PrepData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePrep = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/kate/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId }),
      });
      const data = await res.json();
      if (data?.ok && data.prep) {
        setPrep(data.prep);
        setOpen(true);
      } else {
        setError(data?.error || "Couldn't generate prep");
      }
    } catch {
      setError("Failed to connect");
    } finally {
      setLoading(false);
    }
  }, [providerId, loading]);

  if (!open) {
    return (
      <button
        onClick={generatePrep}
        disabled={loading}
        className="mt-3 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-[#5C6B5C] bg-[#5C6B5C]/10 hover:bg-[#5C6B5C]/20 transition disabled:opacity-50"
      >
        <span>📋</span>
        {loading ? "Preparing..." : "Prep for this visit"}
      </button>
    );
  }

  if (!prep) return null;

  return (
    <div className="mt-4 rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <div>
            <div className="text-sm font-semibold text-[#1A1D2E]">
              Visit Prep: {prep.provider_name}
            </div>
            {prep.appointment_date && (
              <div className="text-xs text-[#7A7F8A]">{prep.appointment_date}</div>
            )}
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded p-1 text-[#B0B4BC] hover:text-[#7A7F8A]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Visit type */}
      <div className="text-xs font-semibold uppercase tracking-wider text-[#5C6B5C] mb-1">
        Visit Type
      </div>
      <div className="text-sm text-[#1A1D2E] mb-4">{prep.visit_type}</div>

      {/* History */}
      <div className="text-xs font-semibold uppercase tracking-wider text-[#5C6B5C] mb-1">
        History
      </div>
      <div className="text-sm text-[#7A7F8A] mb-4">{prep.history_summary}</div>

      {/* Related care */}
      {prep.related_care && (
        <>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#5C6B5C] mb-1">
            Connected Care
          </div>
          <div className="text-sm text-[#7A7F8A] mb-4">{prep.related_care}</div>
        </>
      )}

      {/* Questions */}
      <div className="text-xs font-semibold uppercase tracking-wider text-[#5C6B5C] mb-2">
        Questions to Ask
      </div>
      <div className="space-y-1.5 mb-4">
        {prep.questions_to_ask.map((q, i) => (
          <div key={i} className="flex gap-2 text-sm text-[#1A1D2E]">
            <span className="text-[#5C6B5C] shrink-0">•</span>
            <span>{q}</span>
          </div>
        ))}
      </div>

      {/* Things to bring */}
      <div className="text-xs font-semibold uppercase tracking-wider text-[#5C6B5C] mb-2">
        Things to Bring
      </div>
      <div className="space-y-1.5 mb-4">
        {prep.things_to_bring.map((item, i) => (
          <div key={i} className="flex gap-2 text-sm text-[#1A1D2E]">
            <span className="text-[#5C6B5C] shrink-0">✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      {/* Prep notes */}
      {prep.prep_notes && (
        <>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#5C6B5C] mb-1">
            Preparation
          </div>
          <div className="text-sm text-[#7A7F8A] mb-4">{prep.prep_notes}</div>
        </>
      )}

      {/* Kate's note */}
      <div className="mt-3 rounded-lg bg-white border border-[#EBEDF0] p-3 text-xs text-[#7A7F8A] italic">
        💡 {prep.kate_note}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            const text = [
              `Visit Prep: ${prep.provider_name}`,
              prep.appointment_date ? `Date: ${prep.appointment_date}` : "",
              `Type: ${prep.visit_type}`,
              "",
              "Questions to Ask:",
              ...prep.questions_to_ask.map((q) => `• ${q}`),
              "",
              "Things to Bring:",
              ...prep.things_to_bring.map((item) => `✓ ${item}`),
              "",
              prep.prep_notes ? `Prep: ${prep.prep_notes}` : "",
            ].filter(Boolean).join("\n");
            navigator.clipboard.writeText(text);
          }}
          className="rounded-lg border border-[#EBEDF0] bg-white px-3 py-1.5 text-xs font-medium text-[#1A1D2E] hover:bg-[#F0F2F5]"
        >
          Copy to clipboard
        </button>
        <button
          onClick={() => {
            const text = [
              `Visit Prep: ${prep.provider_name}`,
              prep.appointment_date ? `Date: ${prep.appointment_date}` : "",
              `Type: ${prep.visit_type}`,
              "",
              "Questions to Ask:",
              ...prep.questions_to_ask.map((q) => `• ${q}`),
              "",
              "Things to Bring:",
              ...prep.things_to_bring.map((item) => `✓ ${item}`),
              "",
              prep.prep_notes ? `Preparation: ${prep.prep_notes}` : "",
            ].filter(Boolean).join("\n");
            const subject = `Visit Prep: ${prep.provider_name}`;
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`);
          }}
          className="rounded-lg border border-[#EBEDF0] bg-white px-3 py-1.5 text-xs font-medium text-[#1A1D2E] hover:bg-[#F0F2F5]"
        >
          Email to myself
        </button>
        <button
          onClick={generatePrep}
          disabled={loading}
          className="rounded-lg border border-[#EBEDF0] bg-white px-3 py-1.5 text-xs font-medium text-[#7A7F8A] hover:bg-[#F0F2F5] disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Regenerate"}
        </button>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}
