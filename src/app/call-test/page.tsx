"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import HandleItButton from "../../components/qbh/HandleItButton";

type Provider = {
  id: string;
  name: string;
  phone?: string | null;
  specialty?: string | null;
};

export default function CallTestPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/dashboard/data")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          setUserId(data.appUserId);
          setProviders(
            (data.snapshots || [])
              .filter((s: any) => s.provider.provider_type !== "pharmacy")
              .map((s: any) => ({
                id: s.provider.id,
                name: s.provider.name,
                phone: s.provider.phone,
                specialty: s.provider.specialty,
              }))
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageShell><div /></PageShell>;

  return (
    <PageShell maxWidth="max-w-lg">
      <h1 className="text-xl font-semibold text-[#1A2E1A]">Call Test</h1>
      <p className="mt-1 text-sm text-[#7A7F8A]">Tap any provider to trigger a Kate call. Repeatable.</p>

      <div className="mt-6 space-y-4">
        {providers.map((p) => (
          <div key={p.id} className="rounded-2xl bg-white/55 backdrop-blur-sm border border-white/70 p-5 shadow-sm">
            <div className="text-sm font-semibold text-[#1A2E1A]">{p.name}</div>
            {p.specialty && <div className="text-xs text-[#7A7F8A]">{p.specialty}</div>}
            {p.phone && <div className="text-xs text-[#B0B4BC] mt-0.5">{p.phone}</div>}
            <div className="mt-3">
              <HandleItButton
                userId={userId}
                providerId={p.id}
                providerName={p.name}
                phoneNumber={p.phone}
                label="Call with Kate"
              />
            </div>
          </div>
        ))}
        {providers.length === 0 && (
          <div className="text-center text-sm text-[#B0B4BC]">No providers found. Add some first.</div>
        )}
      </div>
    </PageShell>
  );
}
