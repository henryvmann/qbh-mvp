"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageShell from "../../components/qbh/PageShell";
import NextSteps from "../../components/qbh/NextSteps";
import ProviderLink from "../../components/qbh/ProviderLink";
import { apiFetch } from "../../lib/api";
import InlineProviderSearch from "../../components/qbh/InlineProviderSearch";
import { Plus, Pencil, Check, Trash2 } from "lucide-react";

type CareRecipient = {
  id: string;
  name: string;
  relationship: string;
  dob?: string | null;
};

// Managing additional people is a Family-tier feature. The first recipient
// (typically Self) is always allowed so Solo/Free users can still set up
// their own profile.
function familyTierActive(status: string | null, plan: string | null) {
  if (plan !== "family") return false;
  return status === "active" || status === "trialing";
}

type ProviderSnapshot = {
  provider: {
    id: string;
    name: string;
    specialty?: string | null;
    care_recipient?: string | null;
  };
};

export default function CareRecipientsPage() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<CareRecipient[]>([]);
  const [providers, setProviders] = useState<ProviderSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRelationship, setEditRelationship] = useState("");
  const [editDob, setEditDob] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingProviderFor, setAddingProviderFor] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState("Other");
  const [newDob, setNewDob] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [stripePlan, setStripePlan] = useState<string | null>(null);

  useEffect(() => {
    // /api/providers/list returns the raw active rows including
    // care_recipient — broader than dashboard/data which strips
    // calendar-typed providers and applies booking-state logic. We
    // want the assignment view to faithfully reflect what's stored.
    Promise.all([
      apiFetch("/api/patient-profile").then((r) => r.json()),
      apiFetch("/api/providers/list?status=active").then((r) => r.json()),
      apiFetch("/api/dashboard/data").then((r) => r.json()).catch(() => ({})),
    ]).then(([profileData, listData, dashboardData]) => {
      if (profileData?.profile?.care_recipients) {
        setRecipients(profileData.profile.care_recipients);
      }
      if (dashboardData?.subscription_status) {
        setSubscriptionStatus(dashboardData.subscription_status);
        setStripePlan(dashboardData.stripe_plan || null);
      }
      if (listData?.ok) {
        setProviders(
          (listData.providers ?? []).map((p: { id: string; name: string; specialty: string | null; care_recipient: string | null }) => ({
            provider: {
              id: p.id,
              name: p.name,
              specialty: p.specialty,
              care_recipient: p.care_recipient,
            },
          }))
        );
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function saveRecipients(updated: CareRecipient[]) {
    setSaving(true);
    try {
      await apiFetch("/api/patient-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { care_recipients: updated } }),
      });
      setRecipients(updated);
    } finally {
      setSaving(false);
    }
  }

  function getProvidersForRecipient(recipientName: string, recipientRelationship: string): ProviderSnapshot[] {
    const SELF_ALIASES = ["self", "myself", "me", "my health"];
    const wantName = recipientName.trim().toLowerCase();
    const wantRel = recipientRelationship.trim().toLowerCase();
    const isSelf = wantRel === "self";
    return providers.filter((s) => {
      const raw = s.provider.care_recipient;
      if (!raw) return false;
      try {
        const arr: string[] = typeof raw === "string" ? JSON.parse(raw) : raw;
        return arr.some((r) => {
          const v = (r || "").trim().toLowerCase();
          if (!v) return false;
          if (v === wantName) return true;
          if (v === wantRel) return true;
          // Self-recipient also catches the legacy "Myself"/"Me"/"Self"
          // labels some providers were tagged with before names existed.
          if (isSelf && SELF_ALIASES.includes(v)) return true;
          return false;
        });
      } catch { return false; }
    });
  }

  if (loading) {
    return (
      <PageShell><div /></PageShell>
    );
  }

  return (
    <PageShell>
      
      <div className="mx-auto max-w-3xl px-6 pt-8 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tighter font-medium text-[#071832]">Care Recipients</h1>
            <p className="mt-1 text-sm text-[#4F5F73]">People you manage healthcare for</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const canAdd = familyTierActive(subscriptionStatus, stripePlan) || recipients.length === 0;
              if (canAdd) setShowAdd(true);
              else setShowPaywall(true);
            }}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: "#1677FF" }}
          >
            <Plus size={14} /> Add Person
          </button>
        </div>

        {showPaywall && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowPaywall(false)}
          >
            <div
              className="max-w-md w-full rounded-2xl bg-white shadow-xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-serif text-2xl text-[#071832]">Add more people with QB Family</h2>
              <p className="mt-3 text-sm text-[#3A3F4B] leading-relaxed">
                Managing healthcare for family members or anyone else under your care is part of QB Family.
                You&rsquo;ll get per-person provider tracking, shared scheduling, and Kate handling calls for
                everyone on your list.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/billing")}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: "#1677FF" }}
                >
                  See Family plan
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaywall(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-[#4F5F73]"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add new recipient */}
        {showAdd && (
          <div className="mt-4 rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-5">
            <div className="text-sm font-semibold text-[#071832] mb-3">Add a Person</div>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (e.g., Scarlett, Mom, Dad)"
                className="w-full rounded-xl bg-[#F0F2F5] border border-[#E5EAF2] px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                autoFocus
              />
              <div className="flex gap-3">
                <select
                  value={newRelationship}
                  onChange={(e) => setNewRelationship(e.target.value)}
                  className="flex-1 rounded-xl bg-[#F0F2F5] border border-[#E5EAF2] px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                >
                  <option value="Self">Self</option>
                  <option value="Child">Child</option>
                  <option value="Parent">Parent</option>
                  <option value="Partner">Partner</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="date"
                  value={newDob}
                  onChange={(e) => setNewDob(e.target.value)}
                  className="flex-1 rounded-xl bg-[#F0F2F5] border border-[#E5EAF2] px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!newName.trim() || saving}
                  onClick={async () => {
                    const updated = [...recipients, { id: crypto.randomUUID(), name: newName.trim(), relationship: newRelationship, dob: newDob || null }];
                    await saveRecipients(updated);
                    setNewName(""); setNewRelationship("Other"); setNewDob(""); setShowAdd(false);
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#1677FF" }}
                >
                  {saving ? "Saving..." : "Add"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl px-4 py-2 text-xs text-[#4F5F73]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recipient cards */}
        <div className="mt-6 space-y-4">
          {recipients.map((r) => {
            const assignedProviders = getProvidersForRecipient(r.name, r.relationship);
            const isEditing = editingId === r.id;

            return (
              <div key={r.id} className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm overflow-hidden">
                <div className="p-5">
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl bg-[#F0F2F5] border border-[#E5EAF2] px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                        autoFocus
                      />
                      <div className="flex gap-3">
                        <select
                          value={editRelationship}
                          onChange={(e) => setEditRelationship(e.target.value)}
                          className="flex-1 rounded-xl bg-[#F0F2F5] border border-[#E5EAF2] px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                        >
                          <option value="Self">Self</option>
                          <option value="Child">Child</option>
                          <option value="Parent">Parent</option>
                          <option value="Partner">Partner</option>
                          <option value="Other">Other</option>
                        </select>
                        <input
                          type="date"
                          value={editDob}
                          onChange={(e) => setEditDob(e.target.value)}
                          className="flex-1 rounded-xl bg-[#F0F2F5] border border-[#E5EAF2] px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={async () => {
                            const updated = recipients.map((cr) => cr.id === r.id ? { ...cr, name: editName.trim(), relationship: editRelationship, dob: editDob || null } : cr);
                            await saveRecipients(updated);
                            setEditingId(null);
                          }}
                          className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: "#1677FF" }}
                        >
                          <Check size={12} className="inline mr-1" />{saving ? "Saving..." : "Save"}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="rounded-xl px-4 py-2 text-xs text-[#4F5F73]">
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Remove ${r.name}?`)) return;
                            const updated = recipients.filter((cr) => cr.id !== r.id);
                            await saveRecipients(updated);
                            setEditingId(null);
                          }}
                          className="ml-auto rounded-xl px-4 py-2 text-xs text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={12} className="inline mr-1" />Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-lg font-semibold text-[#071832]">{r.name}</div>
                        <div className="text-xs text-[#4F5F73] mt-0.5">
                          {r.relationship}
                          {r.dob && ` · Born ${new Date(r.dob).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setEditingId(r.id); setEditName(r.name); setEditRelationship(r.relationship); setEditDob(r.dob || ""); }}
                        className="text-xs text-[#1677FF] underline underline-offset-2"
                      >
                        <Pencil size={12} className="inline mr-1" />Edit
                      </button>
                    </div>
                  )}

                  {/* Assigned providers */}
                  {!isEditing && (
                    <div className="mt-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#4F5F73] mb-2">
                        Providers ({assignedProviders.length})
                      </div>
                      {assignedProviders.length > 0 ? (
                        <div className="space-y-1.5">
                          {assignedProviders.map((s) => (
                            <div key={s.provider.id} className="flex items-center justify-between rounded-xl bg-[#F8F9FA] px-3 py-2">
                              <div>
                                <div className="text-sm font-medium">
                                  <ProviderLink providerId={s.provider.id} providerName={s.provider.name} />
                                </div>
                                {s.provider.specialty && (
                                  <div className="text-[10px] text-[#4F5F73]">{s.provider.specialty}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#4F5F73]">No providers assigned yet.</p>
                      )}

                      {/* Add provider for this recipient */}
                      {addingProviderFor === r.id ? (
                        <div className="mt-3">
                          <InlineProviderSearch
                            careRecipientLabel={r.name}
                            onAdded={async () => {
                              setAddingProviderFor(null);
                              // Refresh — pull all owned providers regardless
                              // of status/type so newly-added show up here even
                              // before the dashboard pipeline includes them.
                              const listRes = await apiFetch("/api/providers/list?status=active");
                              const listData = await listRes.json().catch(() => ({}));
                              if (listData?.ok) {
                                setProviders(
                                  (listData.providers ?? []).map((p: { id: string; name: string; specialty: string | null; care_recipient: string | null }) => ({
                                    provider: {
                                      id: p.id,
                                      name: p.name,
                                      specialty: p.specialty,
                                      care_recipient: p.care_recipient,
                                    },
                                  }))
                                );
                              }
                            }}
                            onCancel={() => setAddingProviderFor(null)}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingProviderFor(r.id)}
                          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#1677FF] hover:underline underline-offset-2"
                        >
                          <Plus size={12} /> Add Provider
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {recipients.length === 0 && (
          <div className="mt-8 rounded-2xl bg-white shadow-sm p-6 border border-[#E5EAF2] text-center">
            <p className="text-lg font-light text-[#071832]">No care recipients yet</p>
            <p className="mt-1 text-sm text-[#4F5F73]">Add the people you manage healthcare for.</p>
          </div>
        )}

        {/* Unassigned providers — gives the user a way to tag legacy
            rows that came in before the recipient flow existed (Plaid-
            discovered, manually-added before recipient defaulting, etc.).
            Without this surface, users have to open each provider detail
            page to set the For chip. */}
        {(() => {
          const unassigned = providers.filter((s) => {
            const raw = s.provider.care_recipient;
            if (!raw) return true;
            try {
              const arr: string[] = typeof raw === "string" ? JSON.parse(raw) : raw;
              return !Array.isArray(arr) || arr.length === 0;
            } catch {
              return true;
            }
          });
          if (unassigned.length === 0 || recipients.length === 0) return null;
          return (
            <div className="mt-8 rounded-2xl bg-white shadow-sm p-5 border border-[#E5EAF2]">
              <div className="text-sm font-semibold text-[#071832]">
                Unassigned providers ({unassigned.length})
              </div>
              <p className="mt-1 text-xs text-[#4F5F73]">
                Providers without a care recipient yet. Tap any to assign.
              </p>
              <div className="mt-3 space-y-2">
                {unassigned.map((s) => (
                  <div
                    key={s.provider.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#F0F2F5] px-4 py-2.5 border border-[#E5EAF2]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#071832] truncate">
                        <ProviderLink providerId={s.provider.id} providerName={s.provider.name} />
                      </div>
                      {s.provider.specialty && (
                        <div className="text-[10px] text-[#4F5F73] truncate">
                          {s.provider.specialty}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      {recipients.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={async () => {
                            await apiFetch("/api/providers/update", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                provider_id: s.provider.id,
                                care_recipients: [r.name],
                              }),
                            });
                            const listRes = await apiFetch("/api/providers/list?status=active");
                            const listData = await listRes.json().catch(() => ({}));
                            if (listData?.ok) {
                              setProviders(
                                (listData.providers ?? []).map((p: { id: string; name: string; specialty: string | null; care_recipient: string | null }) => ({
                                  provider: {
                                    id: p.id,
                                    name: p.name,
                                    specialty: p.specialty,
                                    care_recipient: p.care_recipient,
                                  },
                                }))
                              );
                            }
                          }}
                          className="rounded-lg px-2 py-1 text-[10px] font-medium bg-white text-[#1677FF] border border-[#E5EAF2] hover:bg-[#1677FF]/5"
                        >
                          → {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <NextSteps />
      </div>
    </PageShell>
  );
}
