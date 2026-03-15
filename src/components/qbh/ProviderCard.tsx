import type { ProviderDashboardSnapshot } from "../../app/lib/QBH/types";
import BookingStatusPanel from "./BookingStatusPanel";
import HandleItButton from "./HandleItButton";

type Props = { snapshot: ProviderDashboardSnapshot };

function formatDate(input: string | null | undefined): string {
  if (!input) return "Date pending";

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "Date pending";

  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export default function ProviderCard({ snapshot }: Props) {
  const p = snapshot.provider;

  const statusLabel = snapshot.futureConfirmedEvent
    ? "Booked"
    : snapshot.followUpNeeded
    ? "Follow-up likely"
    : "In progress";

  const statusTone = snapshot.futureConfirmedEvent
    ? "bg-[#EEF6EA] text-[#5E7A52]"
    : snapshot.followUpNeeded
    ? "bg-[#F8F3E7] text-[#8A6A2F]"
    : "bg-[#EEF3F7] text-[#5A6B7A]";

  const summaryLine = snapshot.futureConfirmedEvent
    ? `Confirmed for ${formatDate(snapshot.futureConfirmedEvent.start_at)}`
    : snapshot.latestAttempt
    ? `Last outreach ${formatDate(snapshot.latestAttempt.created_at)}`
    : "No outreach attempt yet";

  return (
    <div className="rounded-3xl bg-white/60 p-6 shadow-sm ring-1 ring-black/5 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-serif text-2xl leading-tight text-slate-900">
            {p.name}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {p.specialty ? p.specialty : "Provider"}
            {p.location ? ` • ${p.location}` : ""}
          </div>
        </div>

        <div
          className={[
            "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-black/5",
            statusTone,
          ].join(" ")}
        >
          {statusLabel}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-[#F7FAF6] px-4 py-3 ring-1 ring-slate-200">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Current status
        </div>
        <div className="mt-1 text-sm text-slate-700">{summaryLine}</div>
      </div>

      <BookingStatusPanel snapshot={snapshot} />

      <HandleItButton providerId={p.id} label="Handle It" />

      <div className="mt-3 text-xs text-slate-500">
        QBH will call and book using your saved preferences.
      </div>
    </div>
  );
}