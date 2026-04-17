"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, X, Clock, FileText, CalendarCheck, MessageSquare } from "lucide-react";
import { apiFetch } from "../../lib/api";

/* ── Types ── */

type Suggestion = {
  id: string;
  text: string;
  actionLabel: string;
  actionType: "link" | "inline-phone" | "kate-action";
  actionHref?: string;
  katePrompt?: string;
};

type DashboardData = {
  appUserId: string;
  userName: string | null;
  snapshots: any[];
  hasGoogleCalendarConnection: boolean;
};

type PromptChip = {
  id: string;
  label: string;
  href: string;
  katePrompt?: string;
};

type PatientProfile = {
  date_of_birth?: string | null;
  insurance_provider?: string | null;
  callback_phone?: string | null;
};

/* ── Context type ── */

type BestNextStepContext = "dashboard" | "providers" | "visits" | "goals";

/* ── Priority logic ── */

function buildPromptChips(
  dashboard: DashboardData,
): PromptChip[] {
  const chips: PromptChip[] = [];
  const now = Date.now();

  // Check for appointment within 24 hours
  for (const s of dashboard.snapshots) {
    if (s.futureConfirmedEvent?.start_at) {
      const diff = new Date(s.futureConfirmedEvent.start_at).getTime() - now;
      if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
        chips.push({
          id: "prep-tomorrow",
          label: "Prep for tomorrow",
          href: "#kate-prep",
          katePrompt: "Help me prepare for my appointment tomorrow. What should I bring and what questions should I ask?",
        });
        break;
      }
    }
  }

  // Check for recent appointment (past 48h) — suggest visit notes
  for (const s of dashboard.snapshots) {
    if (s.booking_state?.appointmentStart) {
      const start = new Date(s.booking_state.appointmentStart).getTime();
      if (start < now && now - start < 48 * 60 * 60 * 1000) {
        chips.push({ id: "add-visit-notes", label: "Add visit notes", href: "/notes" });
        break;
      }
    }
  }

  // Overdue provider
  const overdue = dashboard.snapshots.find(
    (s: any) =>
      s.provider?.provider_type !== "pharmacy" &&
      s.followUpNeeded &&
      s.booking_state?.status !== "BOOKED" &&
      s.booking_state?.status !== "IN_PROGRESS"
  );
  if (overdue) {
    chips.push({
      id: "book-overdue",
      label: `Book ${overdue.provider.name.split(" ")[0]}`,
      href: "#kate-book",
      katePrompt: `I need to book an appointment with ${overdue.provider.name}. Can you help?`,
    });
  }

  // Default: chat with Kate
  if (chips.length < 3) {
    chips.push({ id: "chat-kate", label: "Chat with Kate", href: "#kate-chat" });
  }

  return chips.slice(0, 3);
}

function buildSuggestions(
  dashboard: DashboardData,
  profile: PatientProfile,
  context: BestNextStepContext = "dashboard"
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const now = Date.now();

  // HIGHEST PRIORITY: Appointment within 24 hours
  for (const s of dashboard.snapshots) {
    if (s.futureConfirmedEvent?.start_at) {
      const start = new Date(s.futureConfirmedEvent.start_at).getTime();
      const diff = start - now;
      if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
        suggestions.push({
          id: `appt-tomorrow-${s.provider.id}`,
          text: `Your appointment with ${s.provider.name} is tomorrow — want Kate to help you prepare?`,
          actionLabel: "Get Kate's help",
          actionType: "kate-action",
          katePrompt: `Help me prepare for my appointment with ${s.provider.name} tomorrow. Suggest some questions I should ask and things I should bring.`,
        });
        break;
      }
    }
  }

  // SECOND: Appointment completed in past 48 hours (no notes captured)
  for (const s of dashboard.snapshots) {
    if (s.booking_state?.appointmentStart) {
      const start = new Date(s.booking_state.appointmentStart).getTime();
      if (start < now && now - start < 48 * 60 * 60 * 1000) {
        suggestions.push({
          id: `post-visit-${s.provider.id}`,
          text: `How did your visit with ${s.provider.name} go? Tell Kate and she'll organize your notes`,
          actionLabel: "Let Kate handle this",
          actionType: "kate-action",
          katePrompt: `I just had a visit with ${s.provider.name}. Help me capture what happened — ask me about what the doctor said, any new prescriptions, follow-up steps, and things I should remember.`,
        });
        break;
      }
    }
  }

  // THIRD: Provider just booked (within past 2 hours) via schedule_attempts
  for (const s of dashboard.snapshots) {
    if (s.latestAttempt?.status === "BOOKED_CONFIRMED" || s.latestAttempt?.status === "CONFIRMED") {
      const createdAt = new Date(s.latestAttempt.created_at).getTime();
      if (now - createdAt < 2 * 60 * 60 * 1000) {
        const displayTime = s.booking_state?.displayTime || "your appointment";
        suggestions.push({
          id: `just-booked-${s.provider.id}`,
          text: `Kate booked you for ${displayTime}. Want Kate to help you prepare?`,
          actionLabel: "Get Kate's help",
          actionType: "kate-action",
          katePrompt: `I have an upcoming appointment at ${displayTime} with ${s.provider.name}. Help me prepare — suggest questions I should ask and things I should bring.`,
        });
        break;
      }
    }
  }

  // 1. Missing DOB or insurance
  if (!profile.date_of_birth?.trim() || !profile.insurance_provider?.trim()) {
    const missing: string[] = [];
    if (!profile.date_of_birth?.trim()) missing.push("DOB");
    if (!profile.insurance_provider?.trim()) missing.push("insurance");
    suggestions.push({
      id: "complete-profile",
      text: `Kate needs your ${missing.join(" and ")} to book for you — add ${missing.length > 1 ? "them" : "it"} now?`,
      actionLabel: "Add now",
      actionType: "link",
      actionHref: "/settings",
    });
  }

  // 2. Overdue providers needing booking
  const overdueSnapshots = dashboard.snapshots.filter(
    (s) =>
      s.provider?.provider_type !== "pharmacy" &&
      s.followUpNeeded &&
      s.booking_state?.status !== "BOOKED" &&
      s.booking_state?.status !== "IN_PROGRESS"
  );
  if (overdueSnapshots.length > 0) {
    const first = overdueSnapshots[0];
    suggestions.push({
      id: `book-overdue-${first.provider.id}`,
      text: `Kate can book ${first.provider.name} for you — let her handle it?`,
      actionLabel: "Let Kate book",
      actionType: "kate-action",
      katePrompt: `I need to book an appointment with ${first.provider.name}. Can you help me schedule it?`,
    });
  }

  // 3. Calendar not connected
  if (!dashboard.hasGoogleCalendarConnection) {
    suggestions.push({
      id: "connect-calendar",
      text: "Want Kate to check your calendar for conflicts? Connect it now.",
      actionLabel: "Connect calendar",
      actionType: "link",
      actionHref: `/calendar-connect?user_id=${dashboard.appUserId}`,
    });
  }

  // 4. Missing callback phone
  if (!profile.callback_phone?.trim()) {
    suggestions.push({
      id: "add-phone",
      text: "Offices may need to call you back — add your number?",
      actionLabel: "Add phone",
      actionType: "inline-phone",
    });
  }

  // 5. Providers needing review (pending status)
  const pendingReview = dashboard.snapshots.filter(
    (s) => s.booking_state?.status === "NEEDS_REVIEW"
  );
  if (pendingReview.length > 0) {
    suggestions.push({
      id: "review-providers",
      text: `Review ${pendingReview.length} new provider${pendingReview.length === 1 ? "" : "s"} Kate found`,
      actionLabel: "Review",
      actionType: "link",
      actionHref: "/providers",
    });
  }

  // Re-order based on context to prioritize relevant suggestions
  if (context === "providers") {
    suggestions.sort((a, b) => {
      const aProvider = a.id.includes("provider") || a.id.includes("review") || a.id.includes("book-overdue") ? 0 : 1;
      const bProvider = b.id.includes("provider") || b.id.includes("review") || b.id.includes("book-overdue") ? 0 : 1;
      return aProvider - bProvider;
    });
  } else if (context === "visits") {
    suggestions.sort((a, b) => {
      const aVisit = a.id.includes("book") || a.id.includes("calendar") ? 0 : 1;
      const bVisit = b.id.includes("book") || b.id.includes("calendar") ? 0 : 1;
      return aVisit - bVisit;
    });
  } else if (context === "goals") {
    suggestions.sort((a, b) => {
      const aGoal = a.id.includes("profile") || a.id.includes("book-overdue") ? 0 : 1;
      const bGoal = b.id.includes("profile") || b.id.includes("book-overdue") ? 0 : 1;
      return aGoal - bGoal;
    });
  }

  return suggestions;
}

/* ── Session storage helpers ── */

const STORAGE_KEY = "bns-dismissed";
const DISMISS_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours — items come back

type DismissedItem = { id: string; at: number };

function getDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items: DismissedItem[] = JSON.parse(raw);
    const now = Date.now();
    // Filter out expired dismissals
    const active = items.filter((i) => now - i.at < DISMISS_EXPIRY_MS);
    if (active.length !== items.length) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(active));
    }
    return active.map((i) => i.id);
  } catch {
    return [];
  }
}

function addDismissed(id: string) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const items: DismissedItem[] = raw ? JSON.parse(raw) : [];
    if (!items.some((i) => i.id === id)) {
      items.push({ id, at: Date.now() });
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

/* ── Component ── */

export default function BestNextStep({ context = "dashboard" }: { context?: BestNextStepContext }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [chips, setChips] = useState<PromptChip[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    setDismissed(getDismissed());

    Promise.all([
      apiFetch("/api/dashboard/data").then((r) =>
        r.ok ? r.json() : null
      ),
      apiFetch("/api/patient-profile").then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([dashJson, profileJson]) => {
        if (!dashJson?.ok) return;
        const profile: PatientProfile = profileJson?.profile || {};
        const built = buildSuggestions(dashJson as DashboardData, profile, context);
        setSuggestions(built);
        setChips(buildPromptChips(dashJson as DashboardData));
      })
      .finally(() => setLoaded(true));
  }, [context]);

  if (!loaded) return null;

  const current = suggestions.find((s) => !dismissed.includes(s.id));

  // Always show at least chips — never return null
  const defaultChips: PromptChip[] = chips.length > 0 ? chips : [
    { id: "chat", label: "Chat with Kate", href: "#kate-chat" },
    { id: "providers", label: "View providers", href: "/providers" },
    { id: "notes", label: "Add a note", href: "/notes" },
  ];

  function handleDismiss() {
    if (!current) return;
    addDismissed(current.id);
    setDismissed((prev) => [...prev, current.id]);
  }

  function handleAction() {
    if (!current) return;
    if (current.actionType === "kate-action" && current.katePrompt) {
      window.dispatchEvent(new CustomEvent("kate-quick-action", { detail: { message: current.katePrompt } }));
    } else if (current.actionType === "link" && current.actionHref) {
      router.push(current.actionHref);
    }
    // inline-phone is handled by the input
  }

  async function handleSavePhone() {
    if (!phoneValue.trim()) return;
    setSavingPhone(true);
    try {
      await apiFetch("/api/patient-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { callback_phone: phoneValue.trim() },
        }),
      });
      handleDismiss();
    } catch {
      // keep form open
    } finally {
      setSavingPhone(false);
    }
  }

  return (
    <div className="mt-4">
      {current && (
        <div
          className="animate-slideIn rounded-2xl bg-white shadow-sm"
          style={{
            borderLeft: "3px solid #5C6B5C",
            animation: "slideIn 0.4s ease-out both",
          }}
        >
          <style jsx>{`
            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateX(-12px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
          `}</style>

          <div className="flex items-start gap-3 p-4">
            {/* Kate avatar */}
            <Image
              src="/kate-avatar.png"
              alt="Kate"
              width={36}
              height={36}
              className="shrink-0 rounded-full"
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1D2E] leading-snug">
                {current.text}
              </p>

              {/* Inline phone input */}
              {current.actionType === "inline-phone" && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="tel"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="flex-1 rounded-lg border border-[#EBEDF0] px-3 py-1.5 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  />
                  <button
                    type="button"
                    onClick={handleSavePhone}
                    disabled={savingPhone || !phoneValue.trim()}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                    style={{ backgroundColor: "#5C6B5C" }}
                  >
                    {savingPhone ? "..." : "Save"}
                  </button>
                </div>
              )}

              {/* Action buttons */}
              {current.actionType !== "inline-phone" && current.actionType && (
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAction}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95"
                    style={{ backgroundColor: "#5C6B5C" }}
                  >
                    {current.actionLabel}
                    <ArrowRight size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#7A7F8A] transition hover:bg-[#F0F2F5]"
                  >
                    Later
                  </button>
                </div>
              )}
            </div>

            {/* Dismiss X */}
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 p-0.5 text-[#B0B4BC] transition hover:text-[#7A7F8A]"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* All-dismissed fallback */}
      {!current && suggestions.length > 0 && (
        <div className="rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-3 flex items-center gap-3">
          <img src="/kate-avatar.png" alt="Kate" width={28} height={28} className="rounded-full shrink-0" />
          <span className="text-xs text-[#7A7F8A]">
            You&apos;re on track! Here are some things you can do:
          </span>
        </div>
      )}

      {/* Contextual prompt chips — ALWAYS visible */}
      <div className="mt-3 flex flex-wrap gap-2">
        {defaultChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => {
              if (chip.katePrompt || chip.id === "chat-kate" || chip.id === "chat" || chip.href === "#kate-chat") {
                window.dispatchEvent(new CustomEvent("kate-quick-action", {
                  detail: { message: chip.katePrompt || "What should I focus on today?" },
                }));
              } else {
                router.push(chip.href);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#EBEDF0] bg-white px-3 py-1.5 text-xs font-medium text-[#5C6B5C] shadow-sm transition hover:bg-[#F0F2F5] hover:border-[#5C6B5C]"
          >
            {(chip.id === "prep-tomorrow") && <CalendarCheck size={12} />}
            {(chip.id === "add-visit-notes" || chip.id === "notes") && <FileText size={12} />}
            {(chip.id === "book-overdue") && <Clock size={12} />}
            {(chip.id === "chat-kate" || chip.id === "chat") && <MessageSquare size={12} />}
            {(chip.id === "providers") && <ArrowRight size={12} />}
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
