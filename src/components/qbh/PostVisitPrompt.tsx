"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { apiFetch } from "../../lib/api";

type RecentVisit = {
  providerId: string;
  providerName: string;
  visitDate: string;
};

export default function PostVisitPrompt() {
  const [recentVisit, setRecentVisit] = useState<RecentVisit | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Check for recent visits in the last 48 hours
    const dismissedKey = "qbh_post_visit_dismissed";
    const dismissedData = sessionStorage.getItem(dismissedKey);
    if (dismissedData) return;

    apiFetch("/api/dashboard/data")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.ok) return;
        const now = Date.now();
        for (const s of data.snapshots || []) {
          if (s.booking_state?.status === "BOOKED" && s.booking_state?.appointmentStart) {
            const apptTime = new Date(s.booking_state.appointmentStart).getTime();
            const hoursSince = (now - apptTime) / (1000 * 60 * 60);
            // Show prompt 0-48 hours after appointment
            if (hoursSince > 0 && hoursSince < 48) {
              setRecentVisit({
                providerId: s.provider.id,
                providerName: s.provider.name,
                visitDate: s.booking_state.appointmentStart,
              });
              break;
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!recentVisit || dismissed || saved) return null;

  async function handleSave() {
    if (!recentVisit) return;
    setSaving(true);
    try {
      // Save post-visit notes
      const noteText = [
        response === "great" ? "Visit went well, no follow-up needed." : "",
        response === "prescription" ? "New prescription received." : "",
        response === "followup" ? "Follow-up visit needed." : "",
        notes.trim(),
      ].filter(Boolean).join(" ");

      if (noteText) {
        await apiFetch("/api/providers/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider_id: recentVisit.providerId,
            notes: noteText,
          }),
        });
      }
      setSaved(true);
      sessionStorage.setItem("qbh_post_visit_dismissed", "true");
    } catch {} finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-5 animate-fadeIn">
      <div className="flex items-start gap-3">
        <Image src="/kate-avatar.png" alt="Kate" width={32} height={32} className="rounded-full shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-[#1A1D2E]">
            How did it go with {recentVisit.providerName}?
          </div>
          <p className="mt-1 text-xs text-[#7A7F8A]">
            Your appointment was {new Date(recentVisit.visitDate).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>

          {!response ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: "great", label: "Great, no follow-up needed" },
                { value: "prescription", label: "New prescription" },
                { value: "followup", label: "Need to follow up" },
                { value: "notes", label: "I have notes to add" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setResponse(opt.value)}
                  className="rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-2 text-xs font-medium text-[#1A1D2E] hover:border-[#5C6B5C] transition"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any details to remember for next time?"
                rows={2}
                className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-2 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C] resize-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#5C6B5C" }}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setDismissed(true); sessionStorage.setItem("qbh_post_visit_dismissed", "true"); }}
                  className="text-xs text-[#B0B4BC] hover:text-[#7A7F8A]"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
        <button onClick={() => { setDismissed(true); sessionStorage.setItem("qbh_post_visit_dismissed", "true"); }} className="text-[#B0B4BC] hover:text-[#7A7F8A] shrink-0">
          &#10005;
        </button>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out both; }
      `}</style>
    </div>
  );
}
