"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../../components/qbh/TopNav";
import { apiFetch } from "../../lib/api";
import ProviderCard from "../../components/qbh/ProviderCard";
import type { ProviderDashboardSnapshot } from "../lib/QBH/types";

function getStatusLabel(snapshot: ProviderDashboardSnapshot): { label: string; className: string } {
  const bs = snapshot.booking_state;
  const actions = snapshot.system_actions;

  if (actions.integrity.hasMultipleFutureConfirmedEvents) {
    return { label: "Needs review", className: "bg-red-50 text-red-600 ring-1 ring-red-200" };
  }
  if (actions.current?.status === "BLOCKED") {
    return { label: "Blocked", className: "bg-red-50 text-red-600 ring-1 ring-red-200" };
  }
  if (bs?.status === "BOOKED") {
    return { label: "Upcoming", className: "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30" };
  }
  if (bs?.status === "FOLLOW_UP") {
    return { label: "Follow-up", className: "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30" };
  }
  if (actions.current?.status === "IN_PROGRESS") {
    return { label: "In progress", className: "bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/30" };
  }
  return { label: "Tracked", className: "bg-[#F0F2F5] text-[#7A7F8A] ring-1 ring-[#EBEDF0]" };
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function ProvidersInner() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<ProviderDashboardSnapshot[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasCalendar, setHasCalendar] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/dashboard/data")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) {
          setSnapshots(json.snapshots ?? []);
          setUserId(json.appUserId ?? "");
          setHasCalendar(json.hasGoogleCalendarConnection ?? false);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  const doctors = snapshots.filter((s) => s.provider.provider_type !== "pharmacy" && s.provider.provider_type !== "calendar");
  const pharmacies = snapshots.filter((s) => s.provider.provider_type === "pharmacy");

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <TopNav />
      <div className="mx-auto max-w-2xl px-6 pt-8 pb-20">
        <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E]">
          Your Providers
        </h1>
        <p className="mt-1 text-sm text-[#7A7F8A]">
          {snapshots.length} provider{snapshots.length !== 1 ? "s" : ""} on file
        </p>

        {doctors.length === 0 && pharmacies.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
            <div className="font-semibold text-[#1A1D2E]">No providers yet</div>
            <p className="mt-2 text-sm text-[#7A7F8A]">
              Providers will appear here once discovered from your bank data or added manually.
            </p>
          </div>
        ) : (
          <>
            {/* Doctors / Specialists — compact list */}
            {doctors.length > 0 && (
              <div className="mt-6 rounded-2xl bg-white border border-[#EBEDF0] shadow-sm overflow-hidden divide-y divide-[#EBEDF0]">
                {doctors.map((snapshot) => {
                  const status = getStatusLabel(snapshot);
                  const isExpanded = expandedId === snapshot.provider.id;
                  const subtitle = snapshot.provider.doctor_name
                    ? `Dr. ${snapshot.provider.doctor_name}${snapshot.provider.specialty ? ` · ${snapshot.provider.specialty}` : ""}`
                    : snapshot.provider.specialty || null;

                  return (
                    <div key={snapshot.provider.id}>
                      <button
                        type="button"
                        onClick={() => toggleExpand(snapshot.provider.id)}
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#F8F9FA] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-[#1A1D2E] truncate">
                            {snapshot.provider.name}
                          </div>
                          {subtitle && (
                            <div className="text-xs text-[#7A7F8A] truncate mt-0.5">
                              {subtitle}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                          <span className="text-[#B0B4BC]">
                            <ChevronIcon open={isExpanded} />
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4">
                          <ProviderCard
                            snapshot={snapshot}
                            userId={userId}
                            hasGoogleCalendarConnection={hasCalendar}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pharmacies */}
            {pharmacies.length > 0 && (
              <div className="mt-8">
                <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC] mb-3">
                  Pharmacies
                </div>
                <div className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm overflow-hidden divide-y divide-[#EBEDF0]">
                  {pharmacies.map((snapshot) => (
                    <div
                      key={snapshot.provider.id}
                      className="flex items-center justify-between px-5 py-4"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#1A1D2E]">
                          {snapshot.provider.name}
                        </div>
                        <div className="text-xs text-[#7A7F8A]">Pharmacy</div>
                      </div>
                      <span className="inline-flex rounded-full bg-[#F0F2F5] px-2.5 py-0.5 text-xs font-medium text-[#7A7F8A] ring-1 ring-[#EBEDF0]">Tracked</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function ProvidersPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />}>
      <ProvidersInner />
    </Suspense>
  );
}
