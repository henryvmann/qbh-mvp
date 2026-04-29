"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";

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
  const [callingId, setCallingId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string | null>(null);

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

  async function handleCall(provider: Provider) {
    setCallingId(provider.id);
    setCallStatus("Starting...");
    try {
      const res = await apiFetch("/api/vapi/start-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_user_id: userId,
          provider_id: provider.id,
          provider_name: provider.name,
          mode: "BOOK",
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setCallStatus("Kate is on the call...");
        // Keep the glow for 3 minutes then reset
        setTimeout(() => {
          setCallingId(null);
          setCallStatus(null);
        }, 180000);
      } else {
        setCallStatus(data?.error || "Call failed");
        setTimeout(() => { setCallingId(null); setCallStatus(null); }, 5000);
      }
    } catch {
      setCallStatus("Error starting call");
      setTimeout(() => { setCallingId(null); setCallStatus(null); }, 5000);
    }
  }

  if (loading) return <PageShell><div /></PageShell>;

  return (
    <PageShell maxWidth="max-w-lg">
      <style>{`
        @keyframes callPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(15,165,165,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(15,165,165,0); }
        }
        .call-active {
          animation: callPulse 2s ease-in-out infinite;
          border-color: #0FA5A5 !important;
        }
      `}</style>

      <h1 className="text-xl font-semibold text-[#1A2E1A]">Call Test</h1>
      <p className="mt-1 text-sm text-[#7A7F8A]">Tap any provider to trigger a Kate call. Repeatable.</p>

      <div className="mt-6 space-y-4">
        {providers.map((p) => {
          const isActive = callingId === p.id;
          return (
            <div
              key={p.id}
              className={`rounded-2xl bg-white/55 backdrop-blur-sm border p-5 shadow-sm transition-all ${
                isActive ? "call-active border-[#0FA5A5]" : "border-white/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#1A2E1A]">{p.name}</div>
                  {p.specialty && <div className="text-xs text-[#7A7F8A]">{p.specialty}</div>}
                  {p.phone && <div className="text-xs text-[#B0B4BC] mt-0.5">{p.phone}</div>}
                </div>
                {isActive && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#0FA5A5] animate-pulse" />
                    <span className="text-xs font-medium text-[#0FA5A5]">Live</span>
                  </div>
                )}
              </div>

              {isActive && callStatus && (
                <div className="mt-3 rounded-xl bg-[#0FA5A5]/10 px-3 py-2 text-xs text-[#0FA5A5] font-medium">
                  {callStatus}
                </div>
              )}

              <div className="mt-3">
                <button
                  onClick={() => handleCall(p)}
                  disabled={!!callingId}
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ background: isActive ? "linear-gradient(135deg, #0FA5A5, #0D7A7A)" : "linear-gradient(135deg, #4A6B4A, #5C7B5C)" }}
                >
                  {isActive ? "On call..." : callingId ? "Waiting..." : "Call with Kate"}
                </button>
              </div>
            </div>
          );
        })}
        {providers.length === 0 && (
          <div className="text-center text-sm text-[#B0B4BC]">No providers found. Add some first.</div>
        )}
      </div>

      {callingId && (
        <button
          onClick={() => { setCallingId(null); setCallStatus(null); }}
          className="mt-4 w-full text-center text-xs text-[#B0B4BC] hover:text-[#7A7F8A]"
        >
          Reset call status
        </button>
      )}
    </PageShell>
  );
}
