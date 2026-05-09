"use client";

/**
 * BookAllButton — fires Kate calls for every overdue provider with
 * one shared set of context (timing window + visit reason). The user
 * doesn't have to fill the per-call form N times when they have 5
 * outstanding follow-ups.
 *
 * V1 implementation: client-side serial dispatch. Each start-call
 * resolves before the next is fired, so VAPI never sees parallel
 * calls from the same account. Each schedule_attempt row gets the
 * same shared metadata.batch_id so we can later evolve to webhook-
 * driven advancement without changing the client.
 */

import { useState } from "react";
import { apiFetch } from "../../lib/api";

type FollowUp = {
  providerId: string;
  providerName: string;
};

type Props = {
  followUps: FollowUp[];
  /** Called after the batch starts so the parent can refresh state. */
  onStarted?: () => void;
};

export default function BookAllButton({ followUps, onStarted }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [bookingTimeframe, setBookingTimeframe] = useState("");
  const [bookingTimeframePreset, setBookingTimeframePreset] = useState("");
  const [bookingReason, setBookingReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function buildPreferredTimeframe(): string | null {
    const free = bookingTimeframe.trim();
    if (free) {
      return bookingTimeframePreset
        ? `${bookingTimeframePreset} (${free})`
        : free;
    }
    return bookingTimeframePreset || null;
  }

  async function startBatch() {
    if (followUps.length === 0) return;
    setSubmitting(true);
    setError(null);
    setProgress({ done: 0, total: followUps.length });
    const preferredTimeframe = buildPreferredTimeframe();
    const reasonForVisit = bookingReason.trim() || null;
    // Stable id ties every attempt row in this batch together so
    // future versions can chain via webhook end-of-call-report.
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    let success = 0;
    let failure = 0;
    for (let i = 0; i < followUps.length; i++) {
      const fu = followUps[i];
      try {
        const res = await apiFetch("/api/vapi/start-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider_id: fu.providerId,
            provider_name: fu.providerName,
            ...(preferredTimeframe ? { preferred_timeframe: preferredTimeframe } : {}),
            ...(reasonForVisit ? { reason_for_visit: reasonForVisit } : {}),
            // Tag every attempt with the same batch id + position so
            // we can correlate later (analytics, retry tooling).
            batch_id: batchId,
            batch_position: i,
            batch_size: followUps.length,
          }),
        });
        if (res.ok) success++;
        else failure++;
      } catch {
        failure++;
      }
      setProgress({ done: i + 1, total: followUps.length });
    }

    setSubmitting(false);
    if (failure > 0) {
      setError(
        `Started ${success} of ${followUps.length}. ${failure} couldn't start — try those individually.`
      );
    } else {
      setOpen(false);
      onStarted?.();
    }
  }

  if (followUps.length < 2) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
        style={{ backgroundColor: "#1677FF", color: "#FFFFFF" }}
      >
        Book all {followUps.length}
      </button>

      {open && (
        <>
          <div
            onClick={() => !submitting && setOpen(false)}
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(7,24,50,0.45)", backdropFilter: "blur(2px)" }}
          />
          <div
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#E5EAF2] pointer-events-auto"
              style={{ maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}
            >
              <div className="px-5 pt-5 pb-3 border-b border-[#E5EAF2]">
                <div className="text-base font-semibold text-[#071832]">
                  Book all {followUps.length} appointments
                </div>
                <p className="mt-1 text-xs text-[#4F5F73]">
                  Kate will call each office in turn, using the same context for
                  every booking. Set anything specific once — applies to all.
                </p>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F5F73] mb-2">
                    For all of these
                  </div>
                  <div className="space-y-1">
                    {followUps.map((fu) => (
                      <div
                        key={fu.providerId}
                        className="text-sm text-[#071832] flex items-center gap-2"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1677FF]" />
                        {fu.providerName}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#4F5F73]">
                    Aim for
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "", label: "No preference" },
                      { value: "ASAP — next available", label: "ASAP" },
                      { value: "within 2 weeks", label: "2 weeks" },
                      { value: "within 1 month", label: "1 month" },
                      { value: "within 3 months", label: "3 months" },
                      { value: "around 6 months from now", label: "6 months" },
                      { value: "around 12 months from now", label: "1 year" },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setBookingTimeframePreset(opt.value)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium transition"
                        style={{
                          backgroundColor: bookingTimeframePreset === opt.value ? "#1677FF" : "#F0F2F5",
                          color: bookingTimeframePreset === opt.value ? "#FFFFFF" : "#4F5F73",
                          border: `1px solid ${bookingTimeframePreset === opt.value ? "#1677FF" : "#E5EAF2"}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={bookingTimeframe}
                    onChange={(e) => setBookingTimeframe(e.target.value)}
                    placeholder="Or describe — e.g. 'around April 2027'"
                    className="mt-2 w-full rounded-xl border border-[#E5EAF2] bg-[#F8F9FB] px-3 py-2 text-sm text-[#071832] placeholder:text-[#4F5F73] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4F5F73]">
                    Reason for visit (applies to all) <span className="text-[#4F5F73]">— optional</span>
                  </label>
                  <textarea
                    value={bookingReason}
                    onChange={(e) => setBookingReason(e.target.value)}
                    placeholder="e.g. annual checkup, follow-up, new-patient visit"
                    rows={2}
                    className="w-full rounded-xl border border-[#E5EAF2] bg-[#F8F9FB] px-3 py-2 text-sm text-[#071832] placeholder:text-[#4F5F73] focus:outline-none focus:ring-1 focus:ring-[#1677FF] resize-none"
                  />
                  <p className="mt-1 text-[10px] text-[#4F5F73]">
                    Keep it general — receptionists only need the visit type, not clinical details.
                  </p>
                </div>

                {progress && (
                  <div className="text-xs text-[#4F5F73]">
                    Starting {progress.done} of {progress.total}…
                  </div>
                )}
                {error && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}
              </div>

              <div className="px-5 pb-5 pt-1 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => !submitting && setOpen(false)}
                  className="rounded-xl border border-[#E5EAF2] px-4 py-2 text-sm text-[#4F5F73] hover:bg-[#F0F2F5] disabled:opacity-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={startBatch}
                  disabled={submitting}
                  className="rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:brightness-95 disabled:opacity-50"
                  style={{ backgroundColor: "#1677FF", color: "#FFFFFF" }}
                >
                  {submitting
                    ? `Starting ${progress?.done ?? 0}/${followUps.length}…`
                    : `Start all ${followUps.length}`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
