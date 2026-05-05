"use client";

/**
 * /coverage — insurance Phase 0 hub.
 *
 * Four sections, all backed by APIs we just built (no new vendors):
 *   1. EOB upload + Kate explanation list
 *   2. FSA-eligible YTD spend
 *   3. Claims tracker (manual; user logs submissions, Kate watches)
 *   4. "Help me prep for an insurance call" Kate quick-prompt
 *
 * Phase 1 swaps in Stedi/Flexpa for live eligibility and claim
 * status; until then everything here runs on what we already have
 * (GPT-4o vision, Plaid healthcare classification, Kate chat).
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import { Upload, FileText, DollarSign, MessageSquare, Loader2 } from "lucide-react";

type EOB = {
  id: string;
  uploaded_at: string;
  payer: string | null;
  claim_number: string | null;
  date_of_service: string | null;
  provider_name: string | null;
  billed_amount: number | null;
  allowed_amount: number | null;
  plan_paid: number | null;
  patient_owes: number | null;
  status: string | null;
  kate_explanation: string | null;
};

type Claim = {
  id: string;
  payer: string | null;
  amount_submitted: number | null;
  amount_received: number | null;
  date_submitted: string;
  date_of_service: string | null;
  date_resolved: string | null;
  status: string;
  expected_followup_date: string | null;
  notes: string | null;
};

type FsaData = {
  year_total: number;
  transaction_count: number;
  by_provider: Array<{ provider_id: string; provider_name: string; provider_type: string | null; amount: number; count: number }>;
};

const CLAIM_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In review",
  approved: "Approved",
  denied: "Denied",
  paid: "Paid",
  appealed: "Appealed",
};

const CLAIM_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  submitted: { bg: "rgba(22,119,255,0.10)", fg: "#1677FF" },
  in_review: { bg: "rgba(22,119,255,0.10)", fg: "#1677FF" },
  approved: { bg: "rgba(39,196,107,0.14)", fg: "#27C46B" },
  paid: { bg: "rgba(39,196,107,0.14)", fg: "#27C46B" },
  denied: { bg: "rgba(224,64,48,0.10)", fg: "#E04030" },
  appealed: { bg: "rgba(224,138,31,0.14)", fg: "#E08A1F" },
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return `$${Number(n).toFixed(2)}`;
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CoveragePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [eobs, setEobs] = useState<EOB[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [fsa, setFsa] = useState<FsaData | null>(null);
  const [uploadingEob, setUploadingEob] = useState(false);
  const [eobError, setEobError] = useState<string | null>(null);
  const [showAddClaim, setShowAddClaim] = useState(false);

  const refresh = useCallback(async () => {
    const [eobRes, claimRes, fsaRes] = await Promise.all([
      apiFetch("/api/insurance-eob"),
      apiFetch("/api/insurance-claims"),
      apiFetch("/api/fsa-spend"),
    ]);
    if (eobRes.status === 401 || claimRes.status === 401) {
      router.push("/login");
      return;
    }
    const e = await eobRes.json().catch(() => ({}));
    const c = await claimRes.json().catch(() => ({}));
    const f = await fsaRes.json().catch(() => ({}));
    if (e?.ok) setEobs(e.eobs ?? []);
    if (c?.ok) setClaims(c.claims ?? []);
    if (f?.ok) setFsa(f);
    setLoading(false);
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleEobUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEob(true);
    setEobError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/insurance-eob", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setEobError(json?.error || "Upload failed");
      } else {
        await refresh();
      }
    } catch (err) {
      setEobError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingEob(false);
      e.target.value = "";
    }
  }

  function openInsuranceCallPrep() {
    // Dispatch the event KateChatButton listens for — opens the
    // floating chat with a pre-seeded prompt.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kate-quick-action", {
          detail: {
            message:
              "I'm about to call my insurance. Based on what you know about my providers and recent EOBs, what should I ask? Give me a short numbered checklist I can read off.",
          },
        })
      );
    }
  }

  if (loading) return <PageShell><div /></PageShell>;

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 pt-8 pb-16">
        <h1 className="font-serif text-3xl tracking-tighter font-medium text-[#071832]">
          Coverage
        </h1>
        <p className="mt-1 text-sm text-[#4F5F73]">
          EOBs, claims, FSA-eligible spend — Kate keeps track so you don&rsquo;t have to.
        </p>

        {/* FSA-eligible spend */}
        <section className="mt-8">
          <div className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#4F5F73]">
                  FSA-eligible spend this year
                </div>
                <div className="mt-2 font-serif text-3xl tracking-tight text-[#071832]">
                  {fmtMoney(fsa?.year_total ?? 0)}
                </div>
                <div className="mt-1 text-xs text-[#4F5F73]">
                  Across {fsa?.transaction_count ?? 0} healthcare transactions
                </div>
              </div>
              <DollarSign size={32} className="text-[#1677FF]" />
            </div>
            {fsa && fsa.by_provider.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#E5EAF2]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#4F5F73] mb-3">
                  Top providers
                </div>
                <div className="space-y-2">
                  {fsa.by_provider.slice(0, 5).map((p) => (
                    <div key={p.provider_id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-[#071832] truncate">{p.provider_name}</div>
                        <div className="text-xs text-[#4F5F73]">{p.count} visit{p.count === 1 ? "" : "s"}</div>
                      </div>
                      <div className="font-semibold text-[#071832] tabular-nums">{fmtMoney(p.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 text-xs text-[#4F5F73] leading-relaxed">
              Most copays, prescriptions, dental, vision, and mental-health visits are FSA-eligible.
              Save your receipts and submit through your FSA portal.
            </div>
          </div>
        </section>

        {/* EOBs */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#1677FF]">
              Explanation of Benefits
            </h2>
            <label className={`inline-flex items-center gap-2 cursor-pointer rounded-xl bg-[#1677FF] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-95 ${uploadingEob ? "opacity-60" : ""}`}>
              {uploadingEob ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploadingEob ? "Reading…" : "Upload EOB"}
              <input type="file" accept="image/*,application/pdf" onChange={handleEobUpload} disabled={uploadingEob} className="hidden" />
            </label>
          </div>
          {eobError && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {eobError}
            </div>
          )}
          {eobs.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-6 text-center">
              <FileText size={28} className="mx-auto text-[#4F5F73] opacity-50 mb-3" />
              <div className="text-sm font-medium text-[#071832]">No EOBs yet</div>
              <p className="mt-1 text-xs text-[#4F5F73]">
                Upload an Explanation of Benefits photo or PDF and Kate will tell you what it
                means in plain English.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {eobs.map((e) => (
                <div key={e.id} className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#071832]">
                        {e.provider_name || "Unknown provider"}
                        {e.payer && <span className="text-xs text-[#4F5F73] font-normal"> · {e.payer}</span>}
                      </div>
                      <div className="text-xs text-[#4F5F73] mt-0.5">
                        Service date {fmtDate(e.date_of_service)}
                      </div>
                    </div>
                    {e.status && (
                      <span className="rounded-full bg-[#1677FF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#1677FF] shrink-0">
                        {e.status}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <Stat label="Billed" value={fmtMoney(e.billed_amount)} />
                    <Stat label="Plan paid" value={fmtMoney(e.plan_paid)} valueColor="#27C46B" />
                    <Stat label="Allowed" value={fmtMoney(e.allowed_amount)} />
                    <Stat label="You owe" value={fmtMoney(e.patient_owes)} valueColor={e.patient_owes ? "#E04030" : "#071832"} />
                  </div>

                  {e.kate_explanation && (
                    <div className="mt-4 pt-4 border-t border-[#E5EAF2]">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#1677FF] mb-1.5">
                        Kate&rsquo;s read
                      </div>
                      <p className="text-sm text-[#071832] leading-relaxed">{e.kate_explanation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Claims tracker */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#1677FF]">
              Claims you&rsquo;ve submitted
            </h2>
            <button
              onClick={() => setShowAddClaim(!showAddClaim)}
              className="rounded-xl border border-[#E5EAF2] bg-white px-3 py-2 text-xs font-semibold text-[#071832] hover:border-[#1677FF] transition"
            >
              {showAddClaim ? "Cancel" : "Log a claim"}
            </button>
          </div>
          {showAddClaim && <AddClaimForm onAdded={async () => { setShowAddClaim(false); await refresh(); }} />}
          {claims.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-6 text-center">
              <div className="text-sm font-medium text-[#071832]">No claims tracked yet</div>
              <p className="mt-1 text-xs text-[#4F5F73]">
                Submitted a superbill or out-of-network claim? Log it here — Kate will remind
                you in 4 weeks if you haven&rsquo;t heard back.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {claims.map((c) => {
                const colors = CLAIM_STATUS_COLORS[c.status] ?? CLAIM_STATUS_COLORS.submitted;
                return (
                  <div key={c.id} className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#071832]">
                          {c.payer || "Insurance claim"} · {fmtMoney(c.amount_submitted)}
                        </div>
                        <div className="text-xs text-[#4F5F73] mt-0.5">
                          Submitted {fmtDate(c.date_submitted)}
                          {c.expected_followup_date && c.status === "submitted" && (
                            <span> · follow up {fmtDate(c.expected_followup_date)}</span>
                          )}
                          {c.amount_received != null && (
                            <span> · received {fmtMoney(c.amount_received)}</span>
                          )}
                        </div>
                        {c.notes && <div className="text-xs text-[#4F5F73] mt-1.5">{c.notes}</div>}
                      </div>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0"
                        style={{ background: colors.bg, color: colors.fg }}
                      >
                        {CLAIM_STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Insurance call prep helper */}
        <section className="mt-10">
          <button
            onClick={openInsuranceCallPrep}
            className="w-full rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-5 text-left hover:border-[#1677FF] transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1677FF]/10 flex items-center justify-center shrink-0">
                <MessageSquare size={20} className="text-[#1677FF]" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#071832]">
                  About to call your insurance?
                </div>
                <div className="text-xs text-[#4F5F73] mt-0.5">
                  Kate will draft a checklist of questions to ask before you dial.
                </div>
              </div>
            </div>
          </button>
        </section>

        {/* Insurance card capture link */}
        <section className="mt-6">
          <Link
            href="/account#insurance-card"
            className="block rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-5 hover:border-[#1677FF] transition"
          >
            <div className="text-sm font-semibold text-[#071832]">
              Snap your insurance card
            </div>
            <div className="text-xs text-[#4F5F73] mt-0.5">
              Kate reads it automatically — carrier, member ID, group number, copays.
              Used when she calls offices on your behalf.
            </div>
          </Link>
        </section>
      </div>
    </PageShell>
  );
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#4F5F73]">
        {label}
      </div>
      <div
        className="font-semibold text-sm tabular-nums mt-0.5"
        style={{ color: valueColor || "#071832" }}
      >
        {value}
      </div>
    </div>
  );
}

function AddClaimForm({ onAdded }: { onAdded: () => Promise<void> }) {
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [dateSubmitted, setDateSubmitted] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/insurance-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer: payer.trim() || null,
          amount_submitted: amount ? Number(amount) : null,
          date_submitted: dateSubmitted,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Couldn't save");
      } else {
        await onAdded();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-4 mb-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Insurance carrier">
          <input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Aetna, Cigna, etc." className={inputCls} />
        </Field>
        <Field label="Amount submitted">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" placeholder="0.00" className={inputCls} />
        </Field>
        <Field label="Submitted on">
          <input value={dateSubmitted} onChange={(e) => setDateSubmitted(e.target.value)} type="date" className={inputCls} />
        </Field>
        <div />
      </div>
      <Field label="Notes (optional)">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What was this for?" className={inputCls + " resize-none"} />
      </Field>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#1677FF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:opacity-60">
        {saving ? "Saving…" : "Track this claim"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#4F5F73] mb-1">{label}</div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#E5EAF2] bg-white px-3 py-2 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]";
