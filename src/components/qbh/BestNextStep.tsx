"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { apiFetch } from "../../lib/api";

/* ── Types ── */

type Suggestion = {
  id: string;
  text: string;
  actionLabel: string;
  actionType: "link" | "inline-phone";
  actionHref?: string;
};

type DashboardData = {
  appUserId: string;
  userName: string | null;
  snapshots: any[];
  hasGoogleCalendarConnection: boolean;
};

type PatientProfile = {
  date_of_birth?: string | null;
  insurance_provider?: string | null;
  callback_phone?: string | null;
};

/* ── Priority logic ── */

function buildSuggestions(
  dashboard: DashboardData,
  profile: PatientProfile
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // 1. Missing DOB or insurance
  if (!profile.date_of_birth?.trim() || !profile.insurance_provider?.trim()) {
    const missing: string[] = [];
    if (!profile.date_of_birth?.trim()) missing.push("DOB");
    if (!profile.insurance_provider?.trim()) missing.push("insurance");
    suggestions.push({
      id: "complete-profile",
      text: `Complete your health profile (add ${missing.join(", ")})`,
      actionLabel: "Update profile",
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
      text: `Book your overdue appointment with ${first.provider.name}`,
      actionLabel: "Book now",
      actionType: "link",
      actionHref: "/dashboard",
    });
  }

  // 3. Calendar not connected
  if (!dashboard.hasGoogleCalendarConnection) {
    suggestions.push({
      id: "connect-calendar",
      text: "Connect your Google Calendar for better scheduling",
      actionLabel: "Connect",
      actionType: "link",
      actionHref: `/calendar-connect?user_id=${dashboard.appUserId}`,
    });
  }

  // 4. Missing callback phone
  if (!profile.callback_phone?.trim()) {
    suggestions.push({
      id: "add-phone",
      text: "Add your phone number so offices can reach you",
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

  return suggestions;
}

/* ── Session storage helpers ── */

const STORAGE_KEY = "bns-dismissed";

function getDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDismissed(id: string) {
  const list = getDismissed();
  if (!list.includes(id)) list.push(id);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/* ── Component ── */

export default function BestNextStep() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
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
        const built = buildSuggestions(dashJson as DashboardData, profile);
        setSuggestions(built);
      })
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  const current = suggestions.find((s) => !dismissed.includes(s.id));
  if (!current) return null;

  function handleDismiss() {
    if (!current) return;
    addDismissed(current.id);
    setDismissed((prev) => [...prev, current.id]);
  }

  function handleAction() {
    if (!current) return;
    if (current.actionType === "link" && current.actionHref) {
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
    <div
      className="animate-slideIn mt-4 rounded-2xl bg-white shadow-sm"
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
          {current.actionType !== "inline-phone" && (
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
  );
}
