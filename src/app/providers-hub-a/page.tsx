"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import ProviderLink from "../../components/qbh/ProviderLink";
import { SPECIALTY_COLORS, getSpecialtyColor } from "../../lib/qbh/provider-utils";
import { ChevronDown, ChevronRight, Plus, FileText, Calendar, StickyNote } from "lucide-react";

/**
 * OPTION A: Providers grouped by specialty section.
 * Each specialty is a collapsible section with its color.
 * Clean, scannable, shows the whole picture at a glance.
 */

type Snapshot = {
  provider: {
    id: string;
    name: string;
    display_name?: string | null;
    specialty?: string | null;
    phone?: string | null;
    doctor_name?: string | null;
    provider_type?: string | null;
    source?: string | null;
    confirmed_status?: string | null;
    care_recipient?: string | null;
  };
  booking_state?: { status: string; displayTime?: string; appointmentStart?: string } | null;
  followUpNeeded?: boolean;
  visitCount?: number;
  lastVisitDate?: string | null;
};

function getStatus(s: Snapshot): { label: string; color: string } {
  if (s.provider.confirmed_status === "recurring") return { label: "Recurring", color: "#7C3AED" };
  if (s.booking_state?.status === "BOOKED") return { label: "Upcoming", color: "#D4A44C" };
  if (s.followUpNeeded && s.booking_state?.status !== "BOOKED" && s.booking_state?.status !== "IN_PROGRESS")
    return { label: "Overdue", color: "#E04030" };
  if (s.booking_state?.status === "IN_PROGRESS") return { label: "In Progress", color: "#3B82F6" };
  return { label: "On Track", color: "#4A6B4A" };
}

export default function ProvidersHubA() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/dashboard/data")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) setSnapshots(data.snapshots || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageShell><div /></PageShell>;

  const doctors = snapshots.filter((s) => s.provider.provider_type !== "pharmacy");
  const pharmacies = snapshots.filter((s) => s.provider.provider_type === "pharmacy");

  // Group by specialty color label
  const groups = new Map<string, { color: typeof SPECIALTY_COLORS.default; providers: Snapshot[] }>();
  for (const s of doctors) {
    const colors = getSpecialtyColor(s.provider);
    const label = colors.label;
    if (!groups.has(label)) groups.set(label, { color: colors, providers: [] });
    groups.get(label)!.providers.push(s);
  }

  // Sort groups: most providers first
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => b[1].providers.length - a[1].providers.length);

  return (
    <PageShell>
      <h1 className="font-serif text-2xl text-[#1A2E1A]">Your Provider Hub</h1>
      <p className="mt-1 text-sm text-[#7A7F8A]">{doctors.length} providers organized by specialty</p>

      <div className="mt-6 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7A7F8A] mb-1">
        Option A: Grouped by Specialty
      </div>

      {/* Specialty sections */}
      <div className="mt-4 space-y-4">
        {sortedGroups.map(([label, group]) => {
          const isExpanded = expandedGroup === label || expandedGroup === null;
          const { bg, border, accent } = group.color;

          return (
            <div key={label} className="rounded-2xl overflow-hidden" style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
              {/* Section header */}
              <button
                onClick={() => setExpandedGroup(expandedGroup === label ? null : label)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold uppercase tracking-wider" style={{ color: accent }}>{label}</span>
                  <span className="text-xs text-[#7A7F8A]">{group.providers.length} provider{group.providers.length !== 1 ? "s" : ""}</span>
                </div>
                {expandedGroup === label ? <ChevronDown size={16} style={{ color: accent }} /> : <ChevronRight size={16} style={{ color: accent }} />}
              </button>

              {/* Provider list within section */}
              {isExpanded && (
                <div className="border-t" style={{ borderColor: border }}>
                  {group.providers.map((s, idx) => {
                    const status = getStatus(s);
                    const isLast = idx === group.providers.length - 1;
                    const subtitle = s.provider.doctor_name
                      ? `Dr. ${s.provider.doctor_name}${s.provider.specialty && s.provider.specialty !== label ? ` · ${s.provider.specialty}` : ""}`
                      : s.provider.specialty && s.provider.specialty !== label ? s.provider.specialty : null;

                    return (
                      <div
                        key={s.provider.id}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-white/30 transition"
                        style={!isLast ? { borderBottom: `1px solid ${border}` } : {}}
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color, boxShadow: `0 0 6px ${status.color}30` }} />
                          <div>
                            <div className="text-sm font-medium text-[#1A2E1A]">
                              <ProviderLink providerId={s.provider.id} providerName={s.provider.name} />
                            </div>
                            {subtitle && <div className="text-[10px] text-[#7A7F8A]">{subtitle}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold" style={{ color: status.color }}>{status.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pharmacies */}
      {pharmacies.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7A7F8A] mb-2">Pharmacies</div>
          <div className="rounded-2xl bg-white/55 backdrop-blur-sm border border-white/70 overflow-hidden">
            {pharmacies.map((s, idx) => (
              <div key={s.provider.id} className="flex items-center justify-between px-5 py-3" style={idx < pharmacies.length - 1 ? { borderBottom: "1px solid rgba(255,255,255,0.5)" } : {}}>
                <span className="text-sm font-medium text-[#1A2E1A]">{s.provider.name}</span>
                <span className="text-[10px] text-[#B0B4BC]">Pharmacy</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing specialties */}
      <div className="mt-8 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7A7F8A] mb-2">Build Your Team</div>
      <div className="grid grid-cols-2 gap-3">
        {["Primary Care", "Dentist", "Therapist", "Eye Care", "Dermatology"].filter((s) => !groups.has(s)).map((missing) => {
          const colors = SPECIALTY_COLORS[missing.toLowerCase().replace(" care", "").replace("ologist", "ology")] || SPECIALTY_COLORS.default;
          return (
            <button
              key={missing}
              onClick={() => router.push("/providers?add=true")}
              className="rounded-2xl border-2 border-dashed p-4 text-left transition hover:shadow-sm"
              style={{ borderColor: colors.border, backgroundColor: colors.bg + "60" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#1A2E1A]">Your {missing}</div>
                  <div className="text-[10px] text-[#7A7F8A]">Add one</div>
                </div>
                <Plus size={16} className="text-[#B0B4BC]" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <a href="/providers" className="text-xs text-[#7A7F8A] underline">Back to current providers page</a>
      </div>
    </PageShell>
  );
}
