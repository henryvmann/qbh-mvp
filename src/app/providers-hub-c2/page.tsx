"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import ProviderLink from "../../components/qbh/ProviderLink";
// Local palette for this variant
const PALETTE: Record<string, { bg: string; border: string; accent: string; label: string }> = {
  pcp:        { bg: "#D8E8DC", border: "#A8CEB0", accent: "#2D5A3D", label: "Primary Care" },
  dentist:    { bg: "#D0E4E4", border: "#A0C8C8", accent: "#1A6A6A", label: "Dentist" },
  therapist:  { bg: "#DCD4EA", border: "#B8A8D0", accent: "#4A3A7A", label: "Therapist" },
  eye:        { bg: "#E8E4D0", border: "#D0C8A0", accent: "#7A6A20", label: "Eye Care" },
  dermatology:{ bg: "#E8DCD4", border: "#D0B8A8", accent: "#8A4A30", label: "Dermatology" },
  obgyn:      { bg: "#E8D0DC", border: "#D0A8B8", accent: "#7A2A4A", label: "OB/GYN" },
  specialist: { bg: "#D0DCE8", border: "#A8B8D0", accent: "#2A4A6A", label: "Specialist" },
  pharmacy:   { bg: "#E0E0E0", border: "#C0C0C0", accent: "#505050", label: "Pharmacy" },
  default:    { bg: "#D8DCD8", border: "#B0B8B0", accent: "#3A4A3A", label: "Provider" },
};
function getLocalColors(provider: { name?: string; specialty?: string | null; provider_type?: string | null }) {
  const specialty = (provider.specialty || '').toLowerCase();
  const name = (provider.name || '').toLowerCase();
  const type = (provider.provider_type || '').toLowerCase();
  if (type === 'pharmacy') return PALETTE.pharmacy;
  const LABEL_MAP: Record<string, string> = {
    'primary care': 'pcp', 'therapist': 'therapist', 'dentist': 'dentist',
    'eye care': 'eye', 'dermatology': 'dermatology', 'ob/gyn': 'obgyn',
    'specialist': 'specialist', 'pharmacy': 'pharmacy',
  };
  const explicit = LABEL_MAP[specialty];
  if (explicit && PALETTE[explicit]) return PALETTE[explicit];
  if (/(therap|psych|counsel|mental|behav)/.test(specialty + name)) return PALETTE.therapist;
  if (/(dent|dds|oral)/.test(specialty + name)) return PALETTE.dentist;
  if (/(eye|vision|ophthal|optom)/.test(specialty + name)) return PALETTE.eye;
  if (/(derm|skin)/.test(specialty + name)) return PALETTE.dermatology;
  if (/(obgyn|ob\/gyn|gynec|obstet)/.test(specialty + name)) return PALETTE.obgyn;
  if (/(primary|family|internal|general|pcp)/.test(specialty + name)) return PALETTE.pcp;
  return PALETTE.default;
}

import { ChevronLeft, FileText, Calendar, StickyNote, Phone, MapPin, Plus, ExternalLink, Upload } from "lucide-react";

/**
 * OPTION C: Each provider has its own hub page with tabs.
 * Click a provider → see Overview, History, Documents, Prep, Notes.
 * This is the "deep" version — each provider feels like a folder.
 */

type Snapshot = {
  provider: {
    id: string;
    name: string;
    display_name?: string | null;
    specialty?: string | null;
    phone?: string | null;
    doctor_name?: string | null;
    provider_type?: string | null;
    notes?: string | null;
    source?: string | null;
    confirmed_status?: string | null;
  };
  booking_state?: { status: string; displayTime?: string; appointmentStart?: string } | null;
  followUpNeeded?: boolean;
  visitCount?: number;
  lastVisitDate?: string | null;
  latestNote?: { summary?: string; office_instructions?: string; follow_up_notes?: string } | null;
};

function getStatus(s: Snapshot): { label: string; color: string } {
  if (s.provider.confirmed_status === "recurring") return { label: "Recurring", color: "#7C3AED" };
  if (s.booking_state?.status === "BOOKED") return { label: "Upcoming", color: "#D4A44C" };
  if (s.followUpNeeded && s.booking_state?.status !== "BOOKED" && s.booking_state?.status !== "IN_PROGRESS")
    return { label: "Overdue", color: "#E04030" };
  return { label: "On Track", color: "#4A6B4A" };
}

type Tab = "overview" | "history" | "documents" | "notes";

export default function ProvidersHubC2() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    apiFetch("/api/dashboard/data")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) setSnapshots(data.snapshots || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageShell><div /></PageShell>;

  const doctors = snapshots.filter((s) => s.provider.provider_type !== "pharmacy");
  const selected = selectedId ? doctors.find((s) => s.provider.id === selectedId) : null;

  // If a provider is selected, show their hub
  if (selected) {
    const colors = getLocalColors(selected.provider);
    const status = getStatus(selected);
    const tabs: { key: Tab; label: string; icon: React.ComponentType<any> }[] = [
      { key: "overview", label: "Overview", icon: MapPin },
      { key: "history", label: "History", icon: Calendar },
      { key: "documents", label: "Documents", icon: FileText },
      { key: "notes", label: "Notes", icon: StickyNote },
    ];

    return (
      <PageShell>
        {/* Back button */}
        <button onClick={() => { setSelectedId(null); setActiveTab("overview"); }} className="flex items-center gap-1 text-sm text-[#7A7F8A] hover:text-[#1A2E1A] mb-4">
          <ChevronLeft size={16} /> All Providers
        </button>

        {/* Provider header */}
        <div className="rounded-2xl p-6 mb-4" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.accent }}>{colors.label}</span>
              <h1 className="mt-1 text-2xl font-serif text-[#1A2E1A]">{selected.provider.name}</h1>
              {selected.provider.doctor_name && (
                <div className="text-sm text-[#7A7F8A] mt-0.5">Dr. {selected.provider.doctor_name}</div>
              )}
              {selected.provider.specialty && selected.provider.specialty !== colors.label && (
                <div className="text-xs mt-1" style={{ color: colors.accent + "99" }}>{selected.provider.specialty}</div>
              )}
            </div>
            <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ color: status.color, backgroundColor: status.color + "15", border: `1px solid ${status.color}30` }}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-white/40 backdrop-blur-sm border border-white/60 p-1 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${
                activeTab === tab.key ? "bg-white shadow-sm text-[#1A2E1A]" : "text-[#7A7F8A] hover:text-[#1A2E1A]"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="rounded-2xl bg-white/55 backdrop-blur-sm border border-white/70 p-5 shadow-sm">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#B0B4BC] mb-2">Contact</div>
                {selected.provider.phone ? (
                  <div className="flex items-center gap-2 text-sm text-[#1A2E1A]">
                    <Phone size={14} className="text-[#7A7F8A]" />
                    <a href={`tel:${selected.provider.phone}`} className="hover:underline">{selected.provider.phone}</a>
                  </div>
                ) : (
                  <div className="text-sm text-[#B0B4BC]">No phone number on file</div>
                )}
              </div>

              {selected.booking_state?.status === "BOOKED" && selected.booking_state.appointmentStart && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#B0B4BC] mb-2">Next Appointment</div>
                  <div className="flex items-center gap-2 text-sm text-[#1A2E1A]">
                    <Calendar size={14} className="text-[#D4A44C]" />
                    {new Date(selected.booking_state.appointmentStart).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#B0B4BC] mb-2">Visit Summary</div>
                <div className="text-sm text-[#7A7F8A]">
                  {selected.visitCount ? `${selected.visitCount} visit${selected.visitCount !== 1 ? "s" : ""} on record` : "No visits recorded yet"}
                  {selected.lastVisitDate && ` · Last: ${new Date(selected.lastVisitDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                </div>
              </div>

              {selected.latestNote?.office_instructions && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#B0B4BC] mb-2">Office Instructions</div>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                    {selected.latestNote.office_instructions}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#B0B4BC] mb-3">Visit History</div>
              {selected.visitCount && selected.visitCount > 0 ? (
                <div className="text-sm text-[#7A7F8A]">
                  {selected.visitCount} visit{selected.visitCount !== 1 ? "s" : ""} on record.
                  {selected.lastVisitDate && (
                    <span> Most recent: {new Date(selected.lastVisitDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  )}
                  <p className="mt-2 text-xs">Full timeline available on the <a href="/timeline" className="underline text-[#5C6B5C]">Timeline page</a>.</p>
                </div>
              ) : (
                <div className="text-sm text-[#B0B4BC]">No visit history recorded yet. Kate will track visits as they happen.</div>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#B0B4BC] mb-3">Documents</div>
              <div className="text-center py-6">
                <FileText size={32} className="mx-auto text-[#D0D3D8]" />
                <div className="mt-2 text-sm text-[#7A7F8A]">No documents for this provider yet</div>
                <a
                  href="/documents"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: "#5C6B5C" }}
                >
                  <Upload size={12} /> Upload a document
                </a>
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#B0B4BC] mb-3">Notes</div>
              {selected.provider.notes ? (
                <div className="text-sm text-[#1A2E1A] whitespace-pre-line">{selected.provider.notes}</div>
              ) : (
                <div className="text-sm text-[#B0B4BC]">No notes yet. Add notes from the provider detail page.</div>
              )}
              {selected.latestNote?.summary && (
                <div className="mt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#B0B4BC] mb-1">Last Call Summary</div>
                  <div className="text-sm text-[#7A7F8A]">{selected.latestNote.summary}</div>
                </div>
              )}
              {selected.latestNote?.follow_up_notes && (
                <div className="mt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#B0B4BC] mb-1">Follow-up</div>
                  <div className="text-sm text-[#7A7F8A]">{selected.latestNote.follow_up_notes}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <a href={`/providers/${selected.provider.id}`} className="text-xs text-[#7A7F8A] underline">Full provider detail page →</a>
        </div>
      </PageShell>
    );
  }

  // Provider list view
  return (
    <PageShell>
      <h1 className="font-serif text-2xl text-[#1A2E1A]">Your Provider Hub</h1>
      <p className="mt-1 text-sm text-[#7A7F8A]">{doctors.length} providers — tap any to see their full hub</p>

      <div className="mt-6 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7A7F8A] mb-1">
        Option C2: Jewel Tones Palette
      </div>

      <div className="mt-4 space-y-3">
        {doctors.map((s) => {
          const colors = getLocalColors(s.provider);
          const status = getStatus(s);

          return (
            <button
              key={s.provider.id}
              onClick={() => setSelectedId(s.provider.id)}
              className="w-full rounded-2xl p-5 text-left transition hover:shadow-md"
              style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color, boxShadow: `0 0 6px ${status.color}30` }} />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.accent }}>{colors.label}</span>
                    <div className="text-sm font-semibold text-[#1A2E1A]">{s.provider.name}</div>
                    {s.provider.specialty && s.provider.specialty !== colors.label && (
                      <div className="text-[10px] text-[#7A7F8A]">{s.provider.specialty}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold" style={{ color: status.color }}>{status.label}</span>
                  <ChevronLeft size={14} className="rotate-180 text-[#B0B4BC]" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <a href="/providers" className="text-xs text-[#7A7F8A] underline">Back to current providers page</a>
        {" · "}
        <a href="/providers-hub-c1" className="text-xs text-[#7A7F8A] underline">Warm Earth</a> · <a href="/providers-hub-c2" className="text-xs text-[#7A7F8A] underline">Jewel Tones</a> · <a href="/providers-hub-c3" className="text-xs text-[#7A7F8A] underline">Glass Tints</a>
      </div>
    </PageShell>
  );
}
