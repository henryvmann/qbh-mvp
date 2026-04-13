"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../../components/qbh/TopNav";
import { apiFetch } from "../../lib/api";
import ProviderCard from "../../components/qbh/ProviderCard";
import type { ProviderDashboardSnapshot } from "../lib/QBH/types";

function ProvidersInner() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<ProviderDashboardSnapshot[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasCalendar, setHasCalendar] = useState(false);

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
            {/* Doctors / Specialists */}
            {doctors.length > 0 && (
              <div className="mt-6 space-y-4">
                {doctors.map((snapshot) => (
                  <ProviderCard
                    key={snapshot.provider.id}
                    snapshot={snapshot}
                    userId={userId}
                    hasGoogleCalendarConnection={hasCalendar}
                  />
                ))}
              </div>
            )}

            {/* Pharmacies */}
            {pharmacies.length > 0 && (
              <div className="mt-8">
                <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC] mb-3">
                  Pharmacies
                </div>
                <div className="space-y-3">
                  {pharmacies.map((snapshot) => (
                    <div
                      key={snapshot.provider.id}
                      className="flex items-center justify-between rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-5"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#1A1D2E]">
                          {snapshot.provider.name}
                        </div>
                        <div className="text-xs text-[#7A7F8A]">Pharmacy</div>
                      </div>
                      <span className="text-xs text-[#B0B4BC]">Tracked</span>
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
