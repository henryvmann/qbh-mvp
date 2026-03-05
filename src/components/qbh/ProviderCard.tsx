// src/components/qbh/ProviderCard.tsx

import type { ProviderDashboardSnapshot } from "../../app/lib/QBH/types";
import BookingStatusPanel from "./BookingStatusPanel";
import HandleItButton from "./HandleItButton";

type Props = { snapshot: ProviderDashboardSnapshot };

export default function ProviderCard({ snapshot }: Props) {
  const p = snapshot.provider;

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

        <div className="inline-flex items-center rounded-full bg-[#F5F0E6] px-3 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-black/5">
          QBH
        </div>
      </div>

      <BookingStatusPanel snapshot={snapshot} />

      <HandleItButton providerId={p.id} label="Handle It" />

      <div className="mt-3 text-xs text-slate-500">
        QBH will call and book using your saved preferences.
      </div>
    </div>
  );
}