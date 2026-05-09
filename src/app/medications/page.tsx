"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import NextSteps from "../../components/qbh/NextSteps";
import { Plus, Trash2, Pill, Phone, RefreshCw } from "lucide-react";

type Medication = {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  provider_id: string | null;
  pharmacy_id: string | null;
  prescribed_date: string | null;
  created_at: string;
};

type ProviderInfo = {
  id: string;
  name: string;
  display_name?: string | null;
  provider_type?: string;
  phone?: string | null;
};

type PharmacyVisit = {
  provider_name: string;
  visit_date: string | null;
  amount_cents: number | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAmount(cents: number | null): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

export default function MedicationsPage() {
  const router = useRouter();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [pharmacyVisits, setPharmacyVisits] = useState<PharmacyVisit[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [refillMessage, setRefillMessage] = useState<string | null>(null);
  const [refillModalMed, setRefillModalMed] = useState<Medication | null>(null);
  const [refillBusy, setRefillBusy] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDosage, setFormDosage] = useState("");
  const [formFrequency, setFormFrequency] = useState("");
  const [formProviderId, setFormProviderId] = useState("");
  const [formPharmacyId, setFormPharmacyId] = useState("");
  const [saving, setSaving] = useState(false);

  const pharmacies = providers.filter((p) => p.provider_type === "pharmacy");
  const nonPharmacyProviders = providers.filter((p) => p.provider_type !== "pharmacy");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/medications").then((r) => (r.ok ? r.json() : null)),
      apiFetch("/api/medications/data").then((r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.json();
      }),
      apiFetch("/api/dashboard/data").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([medsData, pharmacyData, dashData]) => {
        if (medsData?.ok) setMedications(medsData.medications ?? []);
        if (pharmacyData?.ok) setPharmacyVisits(pharmacyData.pharmacyVisits ?? []);
        if (dashData?.ok && dashData.snapshots) {
          const provs: ProviderInfo[] = dashData.snapshots.map((s: any) => ({
            id: s.provider.id,
            name: s.provider.name,
            display_name: s.provider.display_name,
            provider_type: s.provider.provider_type,
            phone: s.provider.phone,
          }));
          setProviders(provs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function handleAddMedication() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          dosage: formDosage.trim() || null,
          frequency: formFrequency.trim() || null,
          provider_id: formProviderId || null,
          pharmacy_id: formPharmacyId || null,
        }),
      });
      const data = await res.json();
      if (data?.ok && data.medication) {
        setMedications((prev) => [...prev, data.medication]);
        setFormName("");
        setFormDosage("");
        setFormFrequency("");
        setFormProviderId("");
        setFormPharmacyId("");
        setShowForm(false);
      }
    } catch {}
    finally {
      setSaving(false);
    }
  }

  async function handleDelete(medId: string) {
    const res = await apiFetch(`/api/medications?id=${medId}`, { method: "DELETE" });
    const data = await res.json();
    if (data?.ok) {
      setMedications((prev) => prev.filter((m) => m.id !== medId));
    }
  }

  function handleRefill(med: Medication) {
    setRefillModalMed(med);
  }

  // Fires the actual REFILL call to either the pharmacy (default for
  // most refills) or the prescribing doctor (when the pharmacy says no
  // refills left, or the med is a controlled substance). Reuses the
  // start-call route with mode=REFILL.
  async function fireRefillCall(med: Medication, target: "pharmacy" | "doctor") {
    if (refillBusy) return;
    const targetProviderId = target === "pharmacy" ? med.pharmacy_id : med.provider_id;
    if (!targetProviderId) return;

    const targetProvider = providers.find((p) => p.id === targetProviderId);
    const targetName = targetProvider?.display_name || targetProvider?.name || null;
    const pharmacyProvider = providers.find((p) => p.id === med.pharmacy_id);
    const pharmacyName = pharmacyProvider?.display_name || pharmacyProvider?.name || null;

    setRefillBusy(true);
    try {
      const res = await apiFetch("/api/vapi/start-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: targetProviderId,
          provider_name: targetName,
          mode: "REFILL",
          refill_medication_name: med.name,
          refill_dosage: med.dosage || undefined,
          refill_pharmacy_name: pharmacyName || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRefillModalMed(null);
        setRefillMessage(
          target === "pharmacy"
            ? `Kate is calling ${pharmacyName || "your pharmacy"} to refill ${med.name}.`
            : `Kate is calling ${targetName || "your doctor"} about a new prescription for ${med.name}.`
        );
        setTimeout(() => setRefillMessage(null), 4000);
      } else {
        setRefillMessage(`Couldn't start call: ${data?.message || data?.error || "unknown error"}`);
        setTimeout(() => setRefillMessage(null), 5000);
      }
    } catch (err) {
      setRefillMessage(`Couldn't start call: ${err instanceof Error ? err.message : "network error"}`);
      setTimeout(() => setRefillMessage(null), 5000);
    } finally {
      setRefillBusy(false);
    }
  }

  function getProviderName(providerId: string | null): string | null {
    if (!providerId) return null;
    const p = providers.find((pr) => pr.id === providerId);
    return p?.display_name || p?.name || null;
  }

  return (
    <PageShell maxWidth="max-w-5xl">
      <div className="text-[#071832] pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-[#071832]">
              Medications
            </h1>
            <p className="mt-2 max-w-2xl text-base text-[#4F5F73]">
              Track your medications and request refills through Kate.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
            style={{ backgroundColor: "#1677FF" }}
          >
            <Plus size={16} />
            Add medication
          </button>
        </div>

        {/* Refill toast */}
        {refillMessage && (
          <div className="mt-4 rounded-xl bg-[#1677FF]/10 border border-[#1677FF]/30 px-4 py-3 text-sm text-[#1677FF] font-medium">
            {refillMessage}
          </div>
        )}

        {/* Refill modal — opens when handleRefill is called. Two-button
            decision: pharmacy (default for most refills) or doctor
            (when pharmacy says no refills, or controlled substance). */}
        {refillModalMed && (() => {
          const pharm = providers.find((p) => p.id === refillModalMed.pharmacy_id);
          const doc = providers.find((p) => p.id === refillModalMed.provider_id);
          const pharmName = pharm?.display_name || pharm?.name || null;
          const docName = doc?.display_name || doc?.name || null;
          return (
            <div
              role="dialog"
              aria-modal="true"
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(7,24,50,0.45)",
                zIndex: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
              onClick={() => !refillBusy && setRefillModalMed(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 420,
                  background: "white",
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: "0 20px 60px rgba(7,24,50,0.25)",
                }}
              >
                <div className="text-base font-semibold text-[#071832]">
                  Refill {refillModalMed.name}
                </div>
                <div className="mt-1 text-xs text-[#4F5F73] mb-4">
                  Where should I call?
                </div>

                <div className="flex flex-col gap-2">
                  {pharmName ? (
                    <button
                      type="button"
                      disabled={refillBusy}
                      onClick={() => fireRefillCall(refillModalMed, "pharmacy")}
                      className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white text-left"
                      style={{ backgroundColor: "#1677FF" }}
                    >
                      <div>Call your pharmacy</div>
                      <div className="text-xs font-normal opacity-90 mt-0.5">{pharmName}</div>
                    </button>
                  ) : (
                    <div className="rounded-xl px-4 py-3 text-xs text-[#4F5F73] bg-[#F0F2F5] border border-[#E5EAF2]">
                      No pharmacy on file for this medication.
                    </div>
                  )}

                  {docName && (
                    <button
                      type="button"
                      disabled={refillBusy}
                      onClick={() => fireRefillCall(refillModalMed, "doctor")}
                      className="w-full rounded-xl px-4 py-3 text-sm font-medium border border-[#E5EAF2] bg-white text-[#071832] text-left"
                    >
                      <div>Call your doctor for a renewal</div>
                      <div className="text-xs font-normal text-[#4F5F73] mt-0.5">
                        {docName} · use this if the pharmacy says no refills left
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={refillBusy}
                    onClick={() => setRefillModalMed(null)}
                    className="text-xs text-[#4F5F73] mt-1 self-start"
                  >
                    Cancel
                  </button>
                </div>
                {refillBusy && (
                  <div className="mt-3 text-xs text-[#4F5F73]">Starting call…</div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Add Medication Form */}
        {showForm && (
          <div className="mt-6 rounded-2xl bg-white p-5 border border-[#E5EAF2] shadow-sm">
            <h3 className="text-sm font-semibold text-[#071832] mb-3">New medication</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Medication name (e.g. Lisinopril)"
                className="w-full rounded-lg bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] border border-[#E5EAF2] placeholder:text-[#4F5F73] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  value={formDosage}
                  onChange={(e) => setFormDosage(e.target.value)}
                  placeholder="Dosage (e.g. 10mg)"
                  className="flex-1 rounded-lg bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] border border-[#E5EAF2] placeholder:text-[#4F5F73] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                />
                <input
                  type="text"
                  value={formFrequency}
                  onChange={(e) => setFormFrequency(e.target.value)}
                  placeholder="Frequency (e.g. Once daily)"
                  className="flex-1 rounded-lg bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] border border-[#E5EAF2] placeholder:text-[#4F5F73] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={formProviderId}
                  onChange={(e) => setFormProviderId(e.target.value)}
                  className="flex-1 rounded-lg bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] border border-[#E5EAF2] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                >
                  <option value="">Prescribing provider (optional)</option>
                  {nonPharmacyProviders.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                  ))}
                </select>
                <select
                  value={formPharmacyId}
                  onChange={(e) => setFormPharmacyId(e.target.value)}
                  className="flex-1 rounded-lg bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] border border-[#E5EAF2] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                >
                  <option value="">Pharmacy (optional)</option>
                  {pharmacies.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddMedication}
                  disabled={saving || !formName.trim()}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition hover:brightness-95"
                  style={{ backgroundColor: "#1677FF" }}
                >
                  {saving ? "Saving..." : "Save medication"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg px-4 py-2 text-sm text-[#4F5F73] hover:bg-[#F0F2F5] transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Your Medications */}
        <section className="mt-8 rounded-2xl bg-white shadow-sm p-6 border border-[#E5EAF2]">
          <h2 className="font-serif text-xl text-[#071832]">
            Your medications
          </h2>

          {loading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-[#4F5F73]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1677FF] border-t-transparent" />
              Loading...
            </div>
          ) : medications.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#F0F2F5] p-5 border border-[#E5EAF2] text-center">
              <Pill size={32} className="mx-auto text-[#4F5F73]" />
              <p className="mt-2 text-sm text-[#4F5F73]">
                No medications added yet. Use the button above to add your first medication.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {medications.map((med) => {
                const providerName = getProviderName(med.provider_id);
                const pharmacyName = getProviderName(med.pharmacy_id);
                return (
                  <div
                    key={med.id}
                    className="group flex items-start justify-between rounded-xl bg-[#F0F2F5] px-5 py-4 border border-[#E5EAF2]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1677FF]/15 mt-0.5">
                        <Pill size={16} className="text-[#1677FF]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#071832]">
                          {med.name}
                          {med.dosage && (
                            <span className="ml-2 font-normal text-[#4F5F73]">{med.dosage}</span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#4F5F73]">
                          {med.frequency && <span>{med.frequency}</span>}
                          {providerName && <span>Prescribed by {providerName}</span>}
                          {pharmacyName && <span>Pharmacy: {pharmacyName}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(med.pharmacy_id || med.provider_id) && (
                        <button
                          type="button"
                          onClick={() => handleRefill(med)}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#1677FF] bg-[#1677FF]/10 hover:bg-[#1677FF]/20 transition"
                        >
                          <RefreshCw size={12} />
                          Refill with Kate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(med.id)}
                        className="shrink-0 p-1.5 text-[#4F5F73] opacity-0 group-hover:opacity-100 hover:text-red-500 transition"
                        aria-label="Delete medication"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pharmacy Visits Section */}
        <section className="mt-8 rounded-2xl bg-white shadow-sm p-6 border border-[#E5EAF2]">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl text-[#071832]">
              Pharmacy visits
            </h2>
            <span className="rounded-full bg-[#1677FF]/15 px-3 py-1 text-xs font-semibold text-[#1677FF] ring-1 ring-[#1677FF]/30">
              From bank data
            </span>
          </div>
          <p className="mt-2 text-sm text-[#4F5F73]">
            Pharmacy transactions detected from your connected financial accounts.
          </p>

          {loading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-[#4F5F73]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1677FF] border-t-transparent" />
              Loading pharmacy visits...
            </div>
          ) : pharmacyVisits.length === 0 ? (
            <div className="mt-6 rounded-xl bg-[#F0F2F5] p-5 border border-[#E5EAF2]">
              <p className="text-sm text-[#4F5F73]">
                No pharmacy visits detected yet. Once you connect a financial
                account, transactions at pharmacies like CVS, Walgreens, and
                Rite Aid will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {pharmacyVisits.map((visit, i) => (
                <div
                  key={`${visit.provider_name}-${visit.visit_date}-${i}`}
                  className="flex items-center justify-between rounded-xl bg-[#F0F2F5] px-5 py-4 border border-[#E5EAF2]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1677FF]/15">
                      <Phone size={14} className="text-[#1677FF]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#071832]">
                        {visit.provider_name}
                      </div>
                      <div className="text-xs text-[#4F5F73]">
                        {formatDate(visit.visit_date)}
                      </div>
                    </div>
                  </div>
                  {visit.amount_cents != null && (
                    <div className="text-sm font-medium text-[#071832]">
                      {formatAmount(visit.amount_cents)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        <NextSteps />
      </div>
    </PageShell>
  );
}
