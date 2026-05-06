"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { getSpecialtyColor } from "../../../lib/qbh/provider-utils";
import PageShell from "../../../components/qbh/PageShell";
import HandleItButton from "../../../components/qbh/HandleItButton";
import { ArrowLeft, Phone, MapPin, FileText, Calendar, Clock } from "lucide-react";

type Provider = {
  id: string;
  name: string;
  display_name?: string | null;
  phone_number?: string | null;
  specialty?: string | null;
  doctor_name?: string | null;
  notes?: string | null;
  provider_type?: string | null;
  npi?: string | null;
  care_team?: string | null;
  source?: string | null;
  status?: string | null;
  created_at?: string | null;
  /** JSON-stringified array of care-recipient names this provider is for. */
  care_recipient?: string | null;
  is_primary?: boolean | null;
};

type CareRecipient = { id: string; name: string; relationship: string };

type Visit = { id: string; visit_date: string; amount: number | null; source: string };
type CalEvent = { id: string; start_at: string; end_at: string; status: string; source: string };
type Note = { id: string; content: string; note_type: string; created_at: string };
type CallRecord = { id: number; status: string; date: string; displayTime: string | null };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;

  const [provider, setProvider] = useState<Provider | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [upcoming, setUpcoming] = useState<CalEvent[]>([]);
  const [past, setPast] = useState<CalEvent[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editSpecialty, setEditSpecialty] = useState("");
  const [editDoctorName, setEditDoctorName] = useState("");
  const [editCareTeam, setEditCareTeam] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [careRecipients, setCareRecipients] = useState<CareRecipient[]>([]);
  const [editAssignedTo, setEditAssignedTo] = useState<string[]>([]);

  useEffect(() => {
    apiFetch("/api/patient-profile")
      .then((r) => r.json())
      .then((data) => {
        const list = data?.profile?.care_recipients as CareRecipient[] | undefined;
        if (Array.isArray(list)) setCareRecipients(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch(`/api/providers/detail?id=${providerId}`)
      .then((res) => {
        if (res.status === 401) { router.push("/login"); return null; }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) {
          setProvider(json.provider);
          setVisits(json.visits || []);
          setUpcoming(json.upcomingEvents || []);
          setPast(json.pastEvents || []);
          setNotes(json.notes || []);
          setCallHistory(json.callHistory || []);
        }
      })
      .finally(() => setLoading(false));
  }, [providerId, router]);

  async function handleRemoveProvider() {
    if (!provider) return;
    const ok = window.confirm(
      `Remove ${provider.display_name || provider.name} from your care team?\n\nThis will delete all visits, notes, and call history for this provider, and Kate won't bring it back on future scans.`
    );
    if (!ok) return;
    try {
      const res = await apiFetch("/api/providers/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId, action: "delete" }),
      });
      const json = await res.json();
      if (json?.ok) {
        router.push("/providers");
      } else {
        window.alert(`Couldn't remove provider: ${json?.error ?? "unknown error"}`);
      }
    } catch (err) {
      window.alert(`Couldn't remove provider: ${err instanceof Error ? err.message : "network error"}`);
    }
  }

  async function togglePrimary() {
    if (!provider) return;
    const next = !provider.is_primary;
    const res = await apiFetch("/api/providers/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: providerId, is_primary: next }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json?.ok) {
      window.alert(`Couldn't update: ${json?.error ?? "unknown error"}`);
      return;
    }
    setProvider({ ...provider, is_primary: next });
  }

  async function handleArchiveProvider() {
    if (!provider) return;
    // Archive = "I no longer see this doctor, but keep the history."
    // No data is deleted; the row just stops showing on the active
    // dashboard. User can restore from /providers/archived.
    const ok = window.confirm(
      `Archive ${provider.display_name || provider.name}?\n\nKeeps all your history with this provider, but stops showing them on your active care team. You can restore them later from the Archive page.`
    );
    if (!ok) return;
    try {
      const res = await apiFetch("/api/providers/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId, action: "archive" }),
      });
      const json = await res.json();
      if (json?.ok) {
        router.push("/providers");
      } else {
        window.alert(`Couldn't archive provider: ${json?.error ?? "unknown error"}`);
      }
    } catch (err) {
      window.alert(`Couldn't archive provider: ${err instanceof Error ? err.message : "network error"}`);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await apiFetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          content: newNote.trim(),
          note_type: "general",
        }),
      });
      setNewNote("");
      // Refresh notes
      const res = await apiFetch(`/api/providers/detail?id=${providerId}`);
      const json = await res.json();
      if (json?.ok) setNotes(json.notes || []);
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div />
      </PageShell>
    );
  }

  if (!provider) {
    return (
      <PageShell>
        <div className="pt-2">
          <p className="text-[#4F5F73]">Provider not found.</p>
          <Link href="/providers" className="mt-4 inline-block text-sm text-[#1677FF] underline">Back to providers</Link>
        </div>
      </PageShell>
    );
  }

  const colors = getSpecialtyColor(provider);
  const subtitle = provider.doctor_name
    ? `Dr. ${provider.doctor_name}${provider.specialty ? ` · ${provider.specialty}` : ""}`
    : provider.specialty || null;

  return (
    <PageShell maxWidth="max-w-2xl">
      <div className="pb-20 text-[#071832]">

        {/* Back link */}
        <Link href="/providers" className="inline-flex items-center gap-1.5 text-sm text-[#4F5F73] hover:text-[#071832] transition mb-6">
          <ArrowLeft size={14} /> Back to providers
        </Link>

        {/* ── Provider Card (Insurance Card Style) ── */}
        <div
          className="rounded-2xl shadow-md overflow-hidden"
          style={{ backgroundColor: colors.bg, border: `2px solid ${colors.border}` }}
        >
          <div className="p-6">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: colors.accent }}
            >
              {colors.label}
            </span>
            <h1 className="mt-2 text-2xl font-semibold text-[#071832] flex items-center gap-2">
              {provider.display_name || provider.name}
              {provider.is_primary && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: "#E08A1F1A", color: "#E08A1F" }}
                  title="Your primary provider"
                >
                  ★ Primary
                </span>
              )}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm" style={{ color: colors.accent + "99" }}>
                {subtitle}
              </p>
            )}
            {provider.care_team && (
              <span className="mt-2 inline-block rounded-full bg-[#1677FF]/10 px-3 py-1 text-xs font-medium text-[#1677FF]">
                {provider.care_team}
              </span>
            )}
            {(() => {
              if (!provider.care_recipient) return null;
              try {
                const list = JSON.parse(provider.care_recipient);
                if (!Array.isArray(list) || list.length === 0) return null;
                return (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {list.map((name: string) => (
                      <span
                        key={name}
                        className="inline-block rounded-full bg-[#071832]/5 px-3 py-1 text-xs font-medium text-[#071832]"
                      >
                        For {name}
                      </span>
                    ))}
                  </div>
                );
              } catch {
                return null;
              }
            })()}

            {/* Contact details */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {provider.phone_number && (
                <a
                  href={`tel:${provider.phone_number}`}
                  className="flex items-center gap-2 text-sm text-[#071832] hover:text-[#1677FF] transition"
                >
                  <Phone size={14} className="shrink-0" style={{ color: colors.accent }} />
                  {provider.phone_number.replace(/^\+1/, "").replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
                </a>
              )}
              {provider.npi && (
                <div className="flex items-center gap-2 text-sm text-[#4F5F73]">
                  <FileText size={14} className="shrink-0" />
                  NPI: {provider.npi}
                </div>
              )}
            </div>

            {provider.notes && !editing && (
              <p className="mt-3 text-xs text-[#4F5F73] italic">{provider.notes}</p>
            )}

            {/* Edit toggle */}
            {!editing ? (
              <div className="mt-3 flex items-center gap-4">
                <button
                  onClick={() => {
                    setEditPhone(provider.phone_number || "");
                    setEditSpecialty(provider.specialty || "");
                    setEditDoctorName(provider.doctor_name || "");
                    setEditCareTeam(provider.care_team || "");
                    setEditNotes(provider.notes || "");
                    // care_recipient stored as JSON-stringified array of names.
                    let assigned: string[] = [];
                    try {
                      if (provider.care_recipient) {
                        const parsed = JSON.parse(provider.care_recipient);
                        if (Array.isArray(parsed)) assigned = parsed;
                      }
                    } catch {}
                    setEditAssignedTo(assigned);
                    setEditing(true);
                  }}
                  className="text-xs font-medium underline underline-offset-2 transition"
                  style={{ color: colors.accent }}
                >
                  Edit details
                </button>
                <button
                  onClick={togglePrimary}
                  className="text-xs font-medium underline underline-offset-2 transition"
                  style={{ color: provider.is_primary ? "#E08A1F" : colors.accent }}
                >
                  {provider.is_primary ? "★ Primary — unset" : "Set as primary"}
                </button>
                <button
                  onClick={handleArchiveProvider}
                  className="text-xs font-medium underline underline-offset-2 transition hover:opacity-80"
                  style={{ color: "#4F5F73" }}
                >
                  No longer seeing — archive
                </button>
                <button
                  onClick={handleRemoveProvider}
                  className="text-xs font-medium underline underline-offset-2 transition hover:opacity-80"
                  style={{ color: "#E04030" }}
                >
                  Remove from care team
                </button>
                <a
                  href={`/api/superbill?provider_id=${providerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium underline underline-offset-2 transition hover:opacity-80"
                  style={{ color: colors.accent }}
                >
                  Generate superbill
                </a>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full rounded-lg border border-[#E5EAF2] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                />
                <input
                  type="text"
                  value={editDoctorName}
                  onChange={(e) => setEditDoctorName(e.target.value)}
                  placeholder="Doctor name (e.g. Sarah Chen)"
                  className="w-full rounded-lg border border-[#E5EAF2] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                />
                <div>
                  <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">Provider Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "Primary Care", label: "Primary Care" },
                      { value: "Therapist", label: "Therapist" },
                      { value: "Dentist", label: "Dentist" },
                      { value: "Eye Care", label: "Eye Care" },
                      { value: "Dermatology", label: "Dermatology" },
                      { value: "OB/GYN", label: "OB/GYN" },
                      { value: "Specialist", label: "Specialist" },
                      { value: "Pharmacy", label: "Pharmacy" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditSpecialty(opt.value)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          editSpecialty === opt.value
                            ? "bg-[#1677FF] text-white"
                            : "bg-[#F0F2F5] text-[#4F5F73] border border-[#E5EAF2]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={editSpecialty}
                    onChange={(e) => setEditSpecialty(e.target.value)}
                    placeholder="Or type a specialty (e.g. Cardiology)"
                    className="mt-1.5 w-full rounded-lg border border-[#E5EAF2] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">Network Status</label>
                  <div className="flex gap-1.5">
                    {[
                      { value: "in-network", label: "In-Network" },
                      { value: "out-of-network", label: "Out-of-Network" },
                      { value: "", label: "Not Sure" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditNotes((prev) => {
                          const cleaned = prev.replace(/\[Network: [^\]]*\]\s*/g, "").trim();
                          return opt.value ? `[Network: ${opt.label}] ${cleaned}`.trim() : cleaned;
                        })}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          editNotes.includes(opt.label)
                            ? "bg-[#1677FF] text-white"
                            : "bg-[#F0F2F5] text-[#4F5F73] border border-[#E5EAF2]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {careRecipients.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">For</label>
                    <div className="flex flex-wrap gap-1.5">
                      {careRecipients.map((r) => {
                        const selected = editAssignedTo.includes(r.name);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() =>
                              setEditAssignedTo((prev) =>
                                prev.includes(r.name) ? prev.filter((n) => n !== r.name) : [...prev, r.name]
                              )
                            }
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                              selected
                                ? "bg-[#1677FF] text-white"
                                : "bg-[#F0F2F5] text-[#4F5F73] border border-[#E5EAF2]"
                            }`}
                          >
                            {selected ? "✓ " : ""}{r.name}{r.relationship && r.relationship !== "Self" ? ` · ${r.relationship}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes about this provider..."
                  rows={2}
                  className="w-full rounded-lg border border-[#E5EAF2] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1677FF] resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setSavingEdit(true);
                      try {
                        await apiFetch("/api/providers/update", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            provider_id: provider.id,
                            phone_number: editPhone.trim() || null,
                            doctor_name: editDoctorName.trim() || null,
                            specialty: editSpecialty.trim() || null,
                            care_team: editCareTeam.trim() || null,
                            notes: editNotes.trim() || null,
                            care_recipients: editAssignedTo,
                          }),
                        });
                        setProvider({
                          ...provider,
                          phone_number: editPhone.trim() || null,
                          doctor_name: editDoctorName.trim() || null,
                          specialty: editSpecialty.trim() || null,
                          care_team: editCareTeam.trim() || null,
                          notes: editNotes.trim() || null,
                          care_recipient:
                            editAssignedTo.length > 0 ? JSON.stringify(editAssignedTo) : null,
                        });
                        setEditing(false);
                      } finally {
                        setSavingEdit(false);
                      }
                    }}
                    disabled={savingEdit}
                    className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: "#1677FF" }}
                  >
                    {savingEdit ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-lg px-4 py-1.5 text-xs text-[#4F5F73] hover:bg-[#F0F2F5]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action bar — hide if pharmacy or has upcoming appointment */}
          {provider.provider_type !== "pharmacy" && upcoming.length === 0 && (
            <div className="px-6 pb-5">
              <HandleItButton
                providerId={provider.id}
                providerName={provider.name}
                phoneNumber={provider.phone_number}
                label="Have Kate book an appointment"
              />
            </div>
          )}
        </div>

        {/* ── Upcoming Appointments ── */}
        {upcoming.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#1677FF] mb-3">
              Upcoming Appointments
            </h2>
            <div className="space-y-2">
              {upcoming.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl bg-white border border-[#E5EAF2] shadow-sm px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Calendar size={16} className="text-[#1677FF] shrink-0" />
                    <span className="text-sm text-[#071832]">{formatDateTime(e.start_at)}</span>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                    Confirmed
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Notes ── */}
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#1677FF] mb-3">
            Notes
          </h2>
          <div className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-5">
            {/* Add note */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                placeholder="Add a note, question, or reminder..."
                className="flex-1 rounded-xl bg-[#F0F2F5] border border-[#E5EAF2] px-4 py-2.5 text-sm text-[#071832] placeholder:text-[#4F5F73] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || savingNote}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#1677FF" }}
              >
                {savingNote ? "..." : "Add"}
              </button>
            </div>

            {notes.length > 0 ? (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-xl bg-[#F8F9FA] px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#4F5F73]">
                        {note.note_type || "General"}
                      </span>
                      <span className="text-[10px] text-[#4F5F73]">
                        {formatDate(note.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-[#071832]">{note.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#4F5F73] text-center py-2">No notes yet</p>
            )}
          </div>
        </section>

        {/* ── Visit History ── */}
        {visits.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#1677FF] mb-3">
              Visit History
            </h2>
            <div className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm overflow-hidden divide-y divide-[#E5EAF2]">
              {visits.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Clock size={14} className="text-[#4F5F73] shrink-0" />
                    <span className="text-sm text-[#071832]">{formatDate(v.visit_date)}</span>
                  </div>
                  {v.amount != null && (
                    <span className="text-sm text-[#4F5F73]">
                      ${Number(v.amount).toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Call History ── */}
        {callHistory.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#4F5F73] mb-3">
              Kate&apos;s Call History
            </h2>
            <div className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm overflow-hidden divide-y divide-[#E5EAF2]">
              {callHistory.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-[#071832]">{formatDate(c.date)}</span>
                  <div className="flex items-center gap-2">
                    {c.displayTime && (
                      <span className="text-xs text-[#4F5F73]">{c.displayTime}</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === "BOOKED_CONFIRMED"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : c.status === "FAILED"
                          ? "bg-red-50 text-red-600"
                          : "bg-[#F0F2F5] text-[#4F5F73]"
                    }`}>
                      {c.status === "BOOKED_CONFIRMED" ? "Booked" : c.status === "FAILED" ? "Failed" : c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </PageShell>
  );
}
