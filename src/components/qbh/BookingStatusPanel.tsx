// src/components/qbh/BookingStatusPanel.tsx

import type { ProviderDashboardSnapshot } from "../../app/lib/QBH/types";
import { formatDateRange } from "../../app/lib/QBH/format";

type Props = { snapshot: ProviderDashboardSnapshot };

function badge(kind: "good" | "warn" | "neutral") {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset";
  if (kind === "good")
    return `${base} bg-[#E7EFE5] text-[#2F3A2B] ring-black/5`;
  if (kind === "warn")
    return `${base} bg-[#F3EBDD] text-[#4A3B22] ring-black/5`;
  return `${base} bg-white/70 text-slate-700 ring-black/5`;
}

function labelForAttemptStatus(status: string): string {
  const s = String(status || "").toUpperCase();
  if (s === "CREATED") return "Queued";
  if (s === "CALLING") return "Calling";
  if (s === "PROPOSED") return "Slot proposed";
  if (s === "CONFIRMED" || s === "BOOKED_CONFIRMED") return "Booked";
  if (s === "FAILED") return "Needs retry";
  if (s === "CANCELLED") return "Cancelled";
  return status || "—";
}

export default function BookingStatusPanel({ snapshot }: Props) {
  const ev = snapshot.futureConfirmedEvent;
  const attempt = snapshot.latestAttempt;

  const hasBooked = Boolean(ev);
  const needsFollowup = snapshot.followUpNeeded;

  const headline = hasBooked
    ? "Upcoming appointment"
    : needsFollowup
    ? "No appointment yet"
    : "Status";

  const pill = hasBooked
    ? { kind: "good" as const, text: "Confirmed" }
    : needsFollowup
    ? { kind: "warn" as const, text: "Follow-up needed" }
    : { kind: "neutral" as const, text: "In progress" };

  return (
    <div className="mt-4 rounded-2xl bg-white/70 p-4 ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">{headline}</div>
          <div className="mt-1 text-sm text-slate-700">
            {ev ? (
              <span>{formatDateRange(ev.start_at, ev.end_at)}</span>
            ) : attempt ? (
              <span>
                Latest attempt:{" "}
                <span className="font-medium text-slate-900">
                  {labelForAttemptStatus(attempt.status)}
                </span>
              </span>
            ) : (
              <span>No attempts yet.</span>
            )}
          </div>
        </div>

        <span className={badge(pill.kind)}>{pill.text}</span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
        <div>{attempt ? <span>Attempt #{attempt.id}</span> : <span>—</span>}</div>
        <div>{ev ? <span>Calendar updated</span> : <span>System of record: Supabase</span>}</div>
      </div>
    </div>
  );
}