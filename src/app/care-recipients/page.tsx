"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TopNav from "../../components/qbh/TopNav";
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

  useEffect(() => {
    Promise.all([
      apiFetch("/api/patient-profile").then((r) => r.json()),
      apiFetch("/api/dashboard/data").then((r) => r.json()),
    ]).then(([profileData, dashData]) => {
      if (profileData?.profile?.care_recipients) {
        setRecipients(profileData.profile.care_recipients);
      }
      if (dashData?.ok) {
        setProviders(dashData.snapshots || []);
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
    return providers.filter((s) => {
      const raw = s.provider.care_recipient;
      if (!raw) return false;
      try {
        const arr: string[] = typeof raw === "string" ? JSON.parse(raw) : raw;
        return arr.some((r) => r === recipientRelationship || r === recipientName);
      } catch { return false; }
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen text-[#1A1D2E]" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
      <TopNav />
      <div className="mx-auto max-w-3xl px-6 pt-8 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E]">Care Recipients</h1>
            <p className="mt-1 text-sm text-[#7A7F8A]">People you manage healthcare for</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: "#5C6B5C" }}
          >
            <Plus size={14} /> Add Person
          </button>
        </div>

        {/* Add new recipient */}
        {showAdd && (
          <div className="mt-4 rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-5">
            <div className="text-sm font-semibold text-[#1A1D2E] mb-3">Add a Person</div>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (e.g., Scarlett, Mom, Dad)"
                className="w-full rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                autoFocus
              />
              <div className="flex gap-3">
                <select
                  value={newRelationship}
                  onChange={(e) => setNewRelationship(e.target.value)}
                  className="flex-1 rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
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
                  className="flex-1 rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
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
                  style={{ backgroundColor: "#5C6B5C" }}
                >
                  {saving ? "Saving..." : "Add"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl px-4 py-2 text-xs text-[#7A7F8A]">
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
              <div key={r.id} className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm overflow-hidden">
                <div className="p-5">
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                        autoFocus
                      />
                      <div className="flex gap-3">
                        <select
                          value={editRelationship}
                          onChange={(e) => setEditRelationship(e.target.value)}
                          className="flex-1 rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
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
                          className="flex-1 rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
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
                          style={{ backgroundColor: "#5C6B5C" }}
                        >
                          <Check size={12} className="inline mr-1" />{saving ? "Saving..." : "Save"}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="rounded-xl px-4 py-2 text-xs text-[#7A7F8A]">
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
                        <div className="text-lg font-semibold text-[#1A1D2E]">{r.name}</div>
                        <div className="text-xs text-[#7A7F8A] mt-0.5">
                          {r.relationship}
                          {r.dob && ` · Born ${new Date(r.dob).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setEditingId(r.id); setEditName(r.name); setEditRelationship(r.relationship); setEditDob(r.dob || ""); }}
                        className="text-xs text-[#5C6B5C] underline underline-offset-2"
                      >
                        <Pencil size={12} className="inline mr-1" />Edit
                      </button>
                    </div>
                  )}

                  {/* Assigned providers */}
                  {!isEditing && (
                    <div className="mt-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#B0B4BC] mb-2">
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
                                  <div className="text-[10px] text-[#7A7F8A]">{s.provider.specialty}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#B0B4BC]">No providers assigned yet.</p>
                      )}

                      {/* Add provider for this recipient */}
                      {addingProviderFor === r.id ? (
                        <div className="mt-3">
                          <InlineProviderSearch
                            careRecipientLabel={r.relationship}
                            onAdded={async () => {
                              setAddingProviderFor(null);
                              // Refresh providers
                              const dashRes = await apiFetch("/api/dashboard/data");
                              const dashData = await dashRes.json();
                              if (dashData?.ok) setProviders(dashData.snapshots || []);
                            }}
                            onCancel={() => setAddingProviderFor(null)}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingProviderFor(r.id)}
                          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#5C6B5C] hover:underline underline-offset-2"
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
          <div className="mt-8 rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] text-center">
            <p className="text-lg font-light text-[#1A1D2E]">No care recipients yet</p>
            <p className="mt-1 text-sm text-[#7A7F8A]">Add the people you manage healthcare for.</p>
          </div>
        )}

        <NextSteps />
      </div>
    </main>
  );
}
