"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { getSpecialtyColor } from "../../../lib/qbh/provider-utils";
import TopNav from "../../../components/qbh/TopNav";
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
};

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
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  if (!provider) {
    return (
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
        <div className="mx-auto max-w-2xl px-6 pt-8">
          <p className="text-[#7A7F8A]">Provider not found.</p>
          <Link href="/providers" className="mt-4 inline-block text-sm text-[#5C6B5C] underline">Back to providers</Link>
        </div>
      </main>
    );
  }

  const colors = getSpecialtyColor(provider);
  const subtitle = provider.doctor_name
    ? `Dr. ${provider.doctor_name}${provider.specialty ? ` · ${provider.specialty}` : ""}`
    : provider.specialty || null;

  return (
    <main className="min-h-screen pb-20 text-[#1A1D2E]" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
      <TopNav />
      <div className="mx-auto max-w-2xl px-6 pt-6">

        {/* Back link */}
        <Link href="/providers" className="inline-flex items-center gap-1.5 text-sm text-[#7A7F8A] hover:text-[#1A1D2E] transition mb-6">
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
            <h1 className="mt-2 text-2xl font-semibold text-[#1A1D2E]">
              {provider.display_name || provider.name}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm" style={{ color: colors.accent + "99" }}>
                {subtitle}
              </p>
            )}
            {provider.care_team && (
              <span className="mt-2 inline-block rounded-full bg-[#5C6B5C]/10 px-3 py-1 text-xs font-medium text-[#5C6B5C]">
                {provider.care_team}
              </span>
            )}

            {/* Contact details */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {provider.phone_number && (
                <a
                  href={`tel:${provider.phone_number}`}
                  className="flex items-center gap-2 text-sm text-[#1A1D2E] hover:text-[#5C6B5C] transition"
                >
                  <Phone size={14} className="shrink-0" style={{ color: colors.accent }} />
                  {provider.phone_number.replace(/^\+1/, "").replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
                </a>
              )}
              {provider.npi && (
                <div className="flex items-center gap-2 text-sm text-[#7A7F8A]">
                  <FileText size={14} className="shrink-0" />
                  NPI: {provider.npi}
                </div>
              )}
            </div>

            {provider.notes && !editing && (
              <p className="mt-3 text-xs text-[#7A7F8A] italic">{provider.notes}</p>
            )}

            {/* Edit toggle */}
            {!editing ? (
              <button
                onClick={() => {
                  setEditPhone(provider.phone_number || "");
                  setEditSpecialty(provider.specialty || "");
                  setEditDoctorName(provider.doctor_name || "");
                  setEditCareTeam(provider.care_team || "");
                  setEditNotes(provider.notes || "");
                  setEditing(true);
                }}
                className="mt-3 text-xs font-medium underline underline-offset-2 transition"
                style={{ color: colors.accent }}
              >
                Edit details
              </button>
            ) : (
              <div className="mt-4 space-y-2.5">
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full rounded-lg border border-[#EBEDF0] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                />
                <input
                  type="text"
                  value={editDoctorName}
                  onChange={(e) => setEditDoctorName(e.target.value)}
                  placeholder="Doctor name (e.g. Sarah Chen)"
                  className="w-full rounded-lg border border-[#EBEDF0] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                />
                <div>
                  <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">Provider Type</label>
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
                            ? "bg-[#5C6B5C] text-white"
                            : "bg-[#F0F2F5] text-[#7A7F8A] border border-[#EBEDF0]"
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
                    className="mt-1.5 w-full rounded-lg border border-[#EBEDF0] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">Network Status</label>
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
                            ? "bg-[#5C6B5C] text-white"
                            : "bg-[#F0F2F5] text-[#7A7F8A] border border-[#EBEDF0]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes about this provider..."
                  rows={2}
                  className="w-full rounded-lg border border-[#EBEDF0] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5C6B5C] resize-none"
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
                          }),
                        });
                        setProvider({
                          ...provider,
                          phone_number: editPhone.trim() || null,
                          doctor_name: editDoctorName.trim() || null,
                          specialty: editSpecialty.trim() || null,
                          care_team: editCareTeam.trim() || null,
                          notes: editNotes.trim() || null,
                        });
                        setEditing(false);
                      } finally {
                        setSavingEdit(false);
                      }
                    }}
                    disabled={savingEdit}
                    className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: "#5C6B5C" }}
                  >
                    {savingEdit ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-lg px-4 py-1.5 text-xs text-[#7A7F8A] hover:bg-[#F0F2F5]"
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
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#5C6B5C] mb-3">
              Upcoming Appointments
            </h2>
            <div className="space-y-2">
              {upcoming.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl bg-white border border-[#EBEDF0] shadow-sm px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Calendar size={16} className="text-[#5C6B5C] shrink-0" />
                    <span className="text-sm text-[#1A1D2E]">{formatDateTime(e.start_at)}</span>
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#5C6B5C] mb-3">
            Notes
          </h2>
          <div className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-5">
            {/* Add note */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                placeholder="Add a note, question, or reminder..."
                className="flex-1 rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || savingNote}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#5C6B5C" }}
              >
                {savingNote ? "..." : "Add"}
              </button>
            </div>

            {notes.length > 0 ? (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-xl bg-[#F8F9FA] px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#B0B4BC]">
                        {note.note_type || "General"}
                      </span>
                      <span className="text-[10px] text-[#B0B4BC]">
                        {formatDate(note.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-[#1A1D2E]">{note.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#B0B4BC] text-center py-2">No notes yet</p>
            )}
          </div>
        </section>

        {/* ── Visit History ── */}
        {visits.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#5C6B5C] mb-3">
              Visit History
            </h2>
            <div className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm overflow-hidden divide-y divide-[#EBEDF0]">
              {visits.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Clock size={14} className="text-[#B0B4BC] shrink-0" />
                    <span className="text-sm text-[#1A1D2E]">{formatDate(v.visit_date)}</span>
                  </div>
                  {v.amount != null && (
                    <span className="text-sm text-[#7A7F8A]">
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
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#7A7F8A] mb-3">
              Kate&apos;s Call History
            </h2>
            <div className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm overflow-hidden divide-y divide-[#EBEDF0]">
              {callHistory.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-[#1A1D2E]">{formatDate(c.date)}</span>
                  <div className="flex items-center gap-2">
                    {c.displayTime && (
                      <span className="text-xs text-[#7A7F8A]">{c.displayTime}</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === "BOOKED_CONFIRMED"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : c.status === "FAILED"
                          ? "bg-red-50 text-red-600"
                          : "bg-[#F0F2F5] text-[#7A7F8A]"
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
    </main>
  );
}
