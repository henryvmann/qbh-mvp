"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import TopNav from "../../components/qbh/TopNav";
import { FileText, Plus, Trash2, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";

type PatientNote = {
  id: string;
  app_user_id: string;
  provider_id: string | null;
  title: string;
  body: string;
  note_type: "question" | "visit_note" | "symptom" | "general";
  created_at: string;
};

type ProviderInfo = {
  id: string;
  name: string;
  display_name?: string | null;
};

const NOTE_TYPE_LABELS: Record<string, string> = {
  question: "Question",
  visit_note: "Visit Note",
  symptom: "Symptom",
  general: "General",
};

const NOTE_TYPE_COLORS: Record<string, string> = {
  question: "bg-blue-50 text-blue-600 ring-1 ring-blue-200",
  visit_note: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200",
  symptom: "bg-amber-50 text-amber-600 ring-1 ring-amber-200",
  general: "bg-[#F0F2F5] text-[#7A7F8A] ring-1 ring-[#EBEDF0]",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function NotesPage() {
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formProviderId, setFormProviderId] = useState("");
  const [formNoteType, setFormNoteType] = useState<string>("general");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/notes").then((r) => r.ok ? r.json() : null),
      apiFetch("/api/dashboard/data").then((r) => r.ok ? r.json() : null),
    ]).then(([notesData, dashData]) => {
      if (notesData?.ok) setNotes(notesData.notes);
      if (dashData?.ok && dashData.snapshots) {
        const provs: ProviderInfo[] = dashData.snapshots.map((s: any) => ({
          id: s.provider.id,
          name: s.provider.display_name || s.provider.name,
          display_name: s.provider.display_name,
        }));
        setProviders(provs);
      }
      setLoaded(true);
    });
  }, []);

  async function handleSave() {
    if (!formTitle.trim() || !formBody.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          body: formBody.trim(),
          provider_id: formProviderId || null,
          note_type: formNoteType,
        }),
      });
      const data = await res.json();
      if (data?.ok && data.note) {
        setNotes((prev) => [data.note, ...prev]);
        setFormTitle("");
        setFormBody("");
        setFormProviderId("");
        setFormNoteType("general");
        setShowForm(false);
      }
    } catch {}
    finally { setSaving(false); }
  }

  async function handleDelete(noteId: string) {
    const res = await apiFetch(`/api/notes?id=${noteId}`, { method: "DELETE" });
    const data = await res.json();
    if (data?.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  }

  function toggleProvider(providerId: string) {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
  }

  // Group notes
  const providerNotes = notes.filter((n) => n.provider_id);
  const generalNotes = notes.filter((n) => !n.provider_id);

  const notesByProvider = new Map<string, PatientNote[]>();
  for (const note of providerNotes) {
    const existing = notesByProvider.get(note.provider_id!) || [];
    existing.push(note);
    notesByProvider.set(note.provider_id!, existing);
  }

  function getProviderName(providerId: string): string {
    const p = providers.find((pr) => pr.id === providerId);
    return p?.display_name || p?.name || "Unknown provider";
  }

  function renderNote(note: PatientNote, showProvider = false) {
    return (
      <div
        key={note.id}
        className="group flex items-start gap-3 rounded-xl bg-white px-4 py-3 border border-[#EBEDF0] shadow-sm"
      >
        <FileText size={16} className="mt-0.5 shrink-0 text-[#7A7F8A]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#1A1D2E]">{note.title}</span>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${NOTE_TYPE_COLORS[note.note_type] || NOTE_TYPE_COLORS.general}`}>
              {NOTE_TYPE_LABELS[note.note_type] || "General"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#7A7F8A] line-clamp-2">{note.body}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-[#B0B4BC]">
            <span>{formatDate(note.created_at)}</span>
            {showProvider && note.provider_id && (
              <span>- {getProviderName(note.provider_id)}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleDelete(note.id)}
          className="shrink-0 p-1 text-[#B0B4BC] opacity-0 group-hover:opacity-100 hover:text-red-500 transition"
          aria-label="Delete note"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  if (!loaded) {
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-[#F5F5F5]">
          <div className="mx-auto max-w-2xl px-6 py-8">
            <div className="text-sm text-[#7A7F8A]">Loading notes...</div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#F5F5F5]">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-[#1A1D2E]">Notes</h1>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
              style={{ backgroundColor: "#5C6B5C" }}
            >
              <Plus size={16} />
              Add Note
            </button>
          </div>

          {/* Add Note Form */}
          {showForm && (
            <div className="mt-4 rounded-2xl bg-white p-5 border border-[#EBEDF0] shadow-sm">
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Note title"
                  className="w-full rounded-lg bg-[#F0F2F5] px-3 py-2 text-sm text-[#1A1D2E] border border-[#EBEDF0] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                />
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Write your note..."
                  rows={3}
                  className="w-full rounded-lg bg-[#F0F2F5] px-3 py-2 text-sm text-[#1A1D2E] border border-[#EBEDF0] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C] resize-none"
                />
                <div className="flex gap-3">
                  <select
                    value={formProviderId}
                    onChange={(e) => setFormProviderId(e.target.value)}
                    className="flex-1 rounded-lg bg-[#F0F2F5] px-3 py-2 text-sm text-[#1A1D2E] border border-[#EBEDF0] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  >
                    <option value="">No provider (general)</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                    ))}
                  </select>
                  <select
                    value={formNoteType}
                    onChange={(e) => setFormNoteType(e.target.value)}
                    className="rounded-lg bg-[#F0F2F5] px-3 py-2 text-sm text-[#1A1D2E] border border-[#EBEDF0] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  >
                    <option value="general">General</option>
                    <option value="question">Question</option>
                    <option value="visit_note">Visit Note</option>
                    <option value="symptom">Symptom</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !formTitle.trim() || !formBody.trim()}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition hover:brightness-95"
                    style={{ backgroundColor: "#5C6B5C" }}
                  >
                    {saving ? "Saving..." : "Save Note"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-lg px-4 py-2 text-sm text-[#7A7F8A] hover:bg-[#F0F2F5] transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {notes.length === 0 && !showForm && (
            <div className="mt-8 text-center">
              <MessageSquare size={40} className="mx-auto text-[#B0B4BC]" />
              <p className="mt-3 text-sm text-[#7A7F8A]">No notes yet. Add your first note to keep track of questions, symptoms, or visit details.</p>
            </div>
          )}

          {/* By Provider */}
          {notesByProvider.size > 0 && (
            <div className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7A7F8A] mb-3">
                By Provider
              </h2>
              <div className="flex flex-col gap-2">
                {Array.from(notesByProvider.entries()).map(([providerId, pNotes]) => {
                  const isExpanded = expandedProviders.has(providerId);
                  return (
                    <div key={providerId} className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleProvider(providerId)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#F0F2F5] transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#1A1D2E]">
                            {getProviderName(providerId)}
                          </span>
                          <span className="text-xs text-[#B0B4BC]">
                            {pNotes.length} note{pNotes.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-[#7A7F8A]" />
                        ) : (
                          <ChevronRight size={16} className="text-[#7A7F8A]" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3 flex flex-col gap-2">
                          {pNotes.map((note) => renderNote(note))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* General Notes */}
          {generalNotes.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7A7F8A] mb-3">
                General Notes
              </h2>
              <div className="flex flex-col gap-2">
                {generalNotes.map((note) => renderNote(note, true))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
