"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../../components/qbh/TopNav";
import { apiFetch } from "../../lib/api";
import { Plus, Trash2, Users } from "lucide-react";

type CareRecipient = {
  id: string;
  name: string;
  relationship: string;
  dob?: string | null;
};

type KateSettings = {
  display_name?: string;
  communication_style?: string;
  proactivity_level?: string;
  focus_areas?: string[];
};

const COMM_STYLES = [
  { value: "friend", label: "Like a friend", desc: "Casual, warm, conversational" },
  { value: "professional", label: "Professional", desc: "Clear, organized, to-the-point" },
  { value: "expert", label: "Health expert", desc: "Detailed, thorough, educational" },
];

const PROACTIVITY_LEVELS = [
  { value: "proactive", label: "Stay on top of me", desc: "Daily insights, reminders, suggestions" },
  { value: "balanced", label: "Balanced", desc: "Key updates and when things need attention" },
  { value: "minimal", label: "I'll come to you", desc: "Only when I ask or something urgent" },
];

const FOCUS_AREAS = [
  { value: "booking", label: "Booking appointments" },
  { value: "history", label: "Medical history & records" },
  { value: "prep", label: "Visit preparation" },
  { value: "reminders", label: "Reminders & follow-ups" },
  { value: "insights", label: "Health insights & connections" },
  { value: "family", label: "Family/caregiver coordination" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insuranceMemberId, setInsuranceMemberId] = useState("");
  const [callbackPhone, setCallbackPhone] = useState("");
  const [commStyle, setCommStyle] = useState("friend");
  const [proactivity, setProactivity] = useState("balanced");
  const [focusAreas, setFocusAreas] = useState<string[]>(["booking", "reminders"]);
  const [calendarFlexibility, setCalendarFlexibility] = useState<"flexible" | "balanced" | "strict">("balanced");
  const [careRecipients, setCareRecipients] = useState<CareRecipient[]>([]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonRelationship, setNewPersonRelationship] = useState("Parent");
  const [newPersonDob, setNewPersonDob] = useState("");

  useEffect(() => {
    apiFetch("/api/patient-profile")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.ok && data.profile) {
          const p = data.profile;
          setDisplayName(p.display_name || p.nickname || "");
          setFullName(p.full_name || "");
          setDob(p.date_of_birth || "");
          setInsuranceProvider(p.insurance_provider || "");
          setInsuranceMemberId(p.insurance_member_id || "");
          setCallbackPhone(p.callback_phone || "");
          setCommStyle(p.kate_communication_style || "friend");
          setProactivity(p.kate_proactivity || "balanced");
          setFocusAreas(p.kate_focus_areas || ["booking", "reminders"]);
          setCalendarFlexibility(p.calendar_flexibility || "balanced");
          setCareRecipients(p.care_recipients || []);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch("/api/patient-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            display_name: displayName.trim() || null,
            full_name: fullName.trim() || null,
            date_of_birth: dob.trim() || null,
            insurance_provider: insuranceProvider.trim() || null,
            insurance_member_id: insuranceMemberId.trim() || null,
            callback_phone: callbackPhone.trim() || null,
            kate_communication_style: commStyle,
            kate_proactivity: proactivity,
            kate_focus_areas: focusAreas,
            calendar_flexibility: calendarFlexibility,
            care_recipients: careRecipients,
          },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function toggleFocus(value: string) {
    setFocusAreas((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <TopNav />
      <div className="mx-auto max-w-2xl px-6 pt-8 pb-20">
        <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E] mb-8">
          Settings
        </h1>

        {/* Your Info */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-6">
          <h2 className="text-sm font-semibold text-[#1A1D2E] mb-1">
            Your Info
          </h2>
          <p className="text-xs text-[#7A7F8A] mb-4">
            Kate needs these to book appointments on your behalf.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#7A7F8A] mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="First and last name"
                className="w-full rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A7F8A] mb-1">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A7F8A] mb-1">Insurance Provider</label>
              <input
                type="text"
                value={insuranceProvider}
                onChange={(e) => setInsuranceProvider(e.target.value)}
                placeholder="e.g. Aetna, Blue Cross, United"
                className="w-full rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A7F8A] mb-1">Member / Policy Number</label>
              <input
                type="text"
                value={insuranceMemberId}
                onChange={(e) => setInsuranceMemberId(e.target.value)}
                placeholder="Found on your insurance card"
                className="w-full rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A7F8A] mb-1">Callback Phone Number</label>
              <input
                type="tel"
                value={callbackPhone}
                onChange={(e) => setCallbackPhone(e.target.value)}
                placeholder="Number the office can reach you at"
                className="w-full rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
              />
            </div>
          </div>
        </div>

        {/* Care Recipients */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-[#1A1D2E]">
              Care Recipients
            </h2>
            <button
              type="button"
              onClick={() => setShowAddPerson(!showAddPerson)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#5C6B5C] hover:bg-[#5C6B5C]/10 transition"
            >
              <Plus size={14} />
              Add person
            </button>
          </div>
          <p className="text-xs text-[#7A7F8A] mb-4">
            People you manage care for. Kate can help book and track appointments for everyone here.
          </p>

          {showAddPerson && (
            <div className="mb-4 rounded-xl bg-[#F0F2F5] p-4 border border-[#EBEDF0]">
              <div className="flex flex-col gap-2.5">
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="Name"
                  className="w-full rounded-lg bg-white px-3 py-2 text-sm text-[#1A1D2E] border border-[#EBEDF0] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                />
                <div className="flex gap-2.5">
                  <select
                    value={newPersonRelationship}
                    onChange={(e) => setNewPersonRelationship(e.target.value)}
                    className="flex-1 rounded-lg bg-white px-3 py-2 text-sm text-[#1A1D2E] border border-[#EBEDF0] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  >
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Partner">Partner</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    type="date"
                    value={newPersonDob}
                    onChange={(e) => setNewPersonDob(e.target.value)}
                    placeholder="DOB (optional)"
                    className="flex-1 rounded-lg bg-white px-3 py-2 text-sm text-[#1A1D2E] border border-[#EBEDF0] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!newPersonName.trim()) return;
                      const newRecipient: CareRecipient = {
                        id: crypto.randomUUID(),
                        name: newPersonName.trim(),
                        relationship: newPersonRelationship,
                        dob: newPersonDob || null,
                      };
                      setCareRecipients((prev) => [...prev, newRecipient]);
                      setNewPersonName("");
                      setNewPersonRelationship("Parent");
                      setNewPersonDob("");
                      setShowAddPerson(false);
                    }}
                    disabled={!newPersonName.trim()}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition hover:brightness-95"
                    style={{ backgroundColor: "#5C6B5C" }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddPerson(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-[#7A7F8A] hover:bg-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {careRecipients.length === 0 && !showAddPerson ? (
            <div className="rounded-xl bg-[#F0F2F5] p-4 border border-[#EBEDF0] text-center">
              <Users size={24} className="mx-auto text-[#B0B4BC]" />
              <p className="mt-2 text-xs text-[#7A7F8A]">
                No care recipients added yet. Add people you manage care for.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {careRecipients.map((person) => (
                <div
                  key={person.id}
                  className="group flex items-center justify-between rounded-xl bg-[#F0F2F5] px-4 py-3 border border-[#EBEDF0]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5C6B5C]/15">
                      <Users size={14} className="text-[#5C6B5C]" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#1A1D2E]">{person.name}</div>
                      <div className="text-xs text-[#7A7F8A]">
                        {person.relationship}
                        {person.dob && ` — Born ${new Date(person.dob).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCareRecipients((prev) => prev.filter((r) => r.id !== person.id))}
                    className="shrink-0 p-1.5 text-[#B0B4BC] opacity-0 group-hover:opacity-100 hover:text-red-500 transition"
                    aria-label="Remove person"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nickname */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-6">
          <h2 className="text-sm font-semibold text-[#1A1D2E] mb-1">
            What should Kate call you?
          </h2>
          <p className="text-xs text-[#7A7F8A] mb-4">
            Kate uses your full name for calls with offices, but this is how she&apos;ll greet you on the site.
          </p>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Jenny, Hank, Dr. J"
            className="w-full rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-2.5 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
          />
        </div>

        {/* Communication style */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-6">
          <h2 className="text-sm font-semibold text-[#1A1D2E] mb-1">
            How should Kate talk to you?
          </h2>
          <p className="text-xs text-[#7A7F8A] mb-4">
            This affects how Kate communicates in chat and insights.
          </p>
          <div className="space-y-2">
            {COMM_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => setCommStyle(style.value)}
                className={`w-full flex items-center gap-3 rounded-xl p-4 text-left transition ${
                  commStyle === style.value
                    ? "bg-[#5C6B5C]/10 border border-[#5C6B5C]"
                    : "bg-[#F0F2F5] border border-[#EBEDF0] hover:bg-[#E8EBF0]"
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    commStyle === style.value ? "border-[#5C6B5C]" : "border-[#B0B4BC]"
                  }`}
                >
                  {commStyle === style.value && (
                    <div className="h-2 w-2 rounded-full bg-[#5C6B5C]" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-[#1A1D2E]">{style.label}</div>
                  <div className="text-xs text-[#7A7F8A]">{style.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Proactivity */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-6">
          <h2 className="text-sm font-semibold text-[#1A1D2E] mb-1">
            How involved should Kate be?
          </h2>
          <p className="text-xs text-[#7A7F8A] mb-4">
            Controls how often Kate surfaces insights and suggestions.
          </p>
          <div className="space-y-2">
            {PROACTIVITY_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => setProactivity(level.value)}
                className={`w-full flex items-center gap-3 rounded-xl p-4 text-left transition ${
                  proactivity === level.value
                    ? "bg-[#5C6B5C]/10 border border-[#5C6B5C]"
                    : "bg-[#F0F2F5] border border-[#EBEDF0] hover:bg-[#E8EBF0]"
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    proactivity === level.value ? "border-[#5C6B5C]" : "border-[#B0B4BC]"
                  }`}
                >
                  {proactivity === level.value && (
                    <div className="h-2 w-2 rounded-full bg-[#5C6B5C]" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-[#1A1D2E]">{level.label}</div>
                  <div className="text-xs text-[#7A7F8A]">{level.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Focus areas */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-6">
          <h2 className="text-sm font-semibold text-[#1A1D2E] mb-1">
            What should Kate focus on?
          </h2>
          <p className="text-xs text-[#7A7F8A] mb-4">
            Select what matters most to you. Kate will prioritize these areas.
          </p>
          <div className="flex flex-wrap gap-2">
            {FOCUS_AREAS.map((area) => {
              const selected = focusAreas.includes(area.value);
              return (
                <button
                  key={area.value}
                  onClick={() => toggleFocus(area.value)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    selected
                      ? "bg-[#5C6B5C] text-white"
                      : "bg-[#F0F2F5] text-[#7A7F8A] border border-[#EBEDF0] hover:bg-[#E8EBF0]"
                  }`}
                >
                  {area.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Calendar Flexibility */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-6">
          <h2 className="text-sm font-semibold text-[#1A1D2E] mb-1">
            Calendar Flexibility
          </h2>
          <p className="text-xs text-[#7A7F8A] mb-4">
            How should Kate handle scheduling around your existing calendar events?
          </p>
          <div className="space-y-2">
            {([
              { value: "flexible" as const, label: "I'm flexible", desc: "Book at the earliest time and I'll adjust my calendar" },
              { value: "balanced" as const, label: "Usually up to date", desc: "Avoid conflicts, but take earliest if nothing in 2 weeks" },
              { value: "strict" as const, label: "My calendar is set in stone", desc: "Never book over any event" },
            ]).map((option) => (
              <button
                key={option.value}
                onClick={() => setCalendarFlexibility(option.value)}
                className={`w-full flex items-center gap-3 rounded-xl p-4 text-left transition ${
                  calendarFlexibility === option.value
                    ? "bg-[#5C6B5C]/10 border border-[#5C6B5C]"
                    : "bg-[#F0F2F5] border border-[#EBEDF0] hover:bg-[#E8EBF0]"
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    calendarFlexibility === option.value ? "border-[#5C6B5C]" : "border-[#B0B4BC]"
                  }`}
                >
                  {calendarFlexibility === option.value && (
                    <div className="h-2 w-2 rounded-full bg-[#5C6B5C]" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-[#1A1D2E]">{option.label}</div>
                  <div className="text-xs text-[#7A7F8A]">{option.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-95 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)",
            boxShadow: "0 8px 24px rgba(92,107,92,0.35)",
          }}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save settings"}
        </button>
      </div>
    </main>
  );
}
