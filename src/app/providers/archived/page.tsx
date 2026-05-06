"use client";

/**
 * /providers/archived — soft-archived providers the user is no longer
 * seeing. Surfaced as a separate view rather than a filter on
 * /providers so the active care team stays clean. Each row offers a
 * one-tap restore. History (visits, notes, calls) stays intact —
 * archive flips the providers.status only, nothing is deleted.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import PageShell from "../../../components/qbh/PageShell";
import { T } from "../../../components/brand";
import { ArrowLeft, RefreshCcw } from "lucide-react";

type ArchivedProvider = {
  id: string;
  name: string;
  display_name: string | null;
  specialty: string | null;
  doctor_name: string | null;
  provider_type: string | null;
  source: string | null;
  created_at: string | null;
};

export default function ArchivedProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<ArchivedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await apiFetch("/api/providers/list?status=archived");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data?.ok) setProviders(data.providers ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRestore(p: ArchivedProvider) {
    setRestoringId(p.id);
    try {
      await apiFetch("/api/providers/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: p.id, action: "restore" }),
      });
      await refresh();
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <PageShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 80 }}>
        <Link
          href="/providers"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: T.lightMuted,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} /> Back to providers
        </Link>

        <header>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: T.lightText, marginBottom: 8 }}>
            Archived providers
          </h1>
          <p style={{ color: T.lightMuted, fontSize: 16, lineHeight: 1.5, maxWidth: 540 }}>
            Doctors you&apos;re no longer seeing, but their history is still here.
            Tap restore to bring one back to your active care team.
          </p>
        </header>

        {loading ? (
          <div style={{ color: T.lightMuted }}>Loading…</div>
        ) : providers.length === 0 ? (
          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              border: `1px dashed ${T.lightBorder}`,
              borderRadius: 14,
              padding: 32,
              textAlign: "center",
              color: T.lightMuted,
              fontSize: 14,
            }}
          >
            Nothing archived. When you stop seeing a doctor, archive them on
            their detail page and they&apos;ll show up here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {providers.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "rgba(255,255,255,0.85)",
                  border: `1px solid ${T.lightBorder}`,
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Link
                    href={`/providers/${p.id}`}
                    style={{
                      fontWeight: 600,
                      color: T.lightText,
                      fontSize: 15,
                      textDecoration: "none",
                    }}
                  >
                    {p.display_name || p.name}
                  </Link>
                  {(p.specialty || p.doctor_name) && (
                    <div style={{ fontSize: 12, color: T.lightMuted, marginTop: 2 }}>
                      {[p.doctor_name && `Dr. ${p.doctor_name}`, p.specialty]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRestore(p)}
                  disabled={restoringId === p.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 12px",
                    background: "rgba(22,119,255,0.08)",
                    color: T.electric,
                    border: `1px solid ${T.lightBorder}`,
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: restoringId === p.id ? 0.6 : 1,
                  }}
                >
                  <RefreshCcw size={14} />
                  {restoringId === p.id ? "Restoring…" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
