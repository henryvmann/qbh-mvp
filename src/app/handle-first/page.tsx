"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { CharacterWithBubble } from "../../components/qbh/CharacterBubble";
import type { Pose } from "../../components/qbh/CharacterBubble";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Snapshot = {
  provider: { id: string; name: string; phone: string | null };
  followUpNeeded: boolean;
  booking_state: {
    status: string;
    displayTime: string | null;
    appointmentStart: string | null;
  };
  futureConfirmedEvent: { start_at: string } | null;
  system_actions: {
    next: { type: string; status: string } | null;
    integrity: { hasMultipleFutureConfirmedEvents: boolean };
  };
  visitCount: number;
  lastVisitDate: string | null;
};

type DashboardData = {
  appUserId: string;
  userName: string | null;
  snapshots: Snapshot[];
  discoverySummary: { chargesAnalyzed: number; providersFound: number };
  hasGoogleCalendarConnection: boolean;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "No recent visits";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthsAgo(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.round(diff / (30 * 24 * 60 * 60 * 1000));
}

const SIX_MONTHS = 6 * 30 * 24 * 60 * 60 * 1000;

function getOverdueProviders(snapshots: Snapshot[]): Snapshot[] {
  return snapshots.filter((s) => {
    if (s.futureConfirmedEvent) return false;
    if (s.booking_state.status === "BOOKED") return false;
    if (s.followUpNeeded) return true;
    if (
      s.lastVisitDate &&
      Date.now() - new Date(s.lastVisitDate).getTime() > SIX_MONTHS
    )
      return true;
    return false;
  });
}

function getNextStep(
  current: number,
  hasCalendar: boolean,
  hasOverdue: boolean
): number {
  let next = current + 1;
  if (next === 4 && !hasOverdue) next = 5; // skip authorize if nothing overdue
  // step 5 = patient info (always show)
  if (next === 6 && hasCalendar) next = 7; // skip calendar if connected
  return next;
}

/* Character components imported from ../../components/qbh/CharacterBubble */

/* ------------------------------------------------------------------ */
/*  Progress Dots                                                      */
/* ------------------------------------------------------------------ */

function ProgressDots({
  total,
  active,
}: {
  total: number;
  active: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            i + 1 === active
              ? "bg-[#5C6B5C]"
              : i + 1 < active
              ? "bg-[#5C6B5C]/50"
              : "border border-[#EBEDF0] bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gold Button                                                        */
/* ------------------------------------------------------------------ */

function GoldButton({
  children,
  onClick,
  secondary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        secondary
          ? "border border-[#EBEDF0] bg-transparent text-[#7A7F8A] hover:bg-[#F0F2F5]"
          : "text-white shadow-lg"
      }`}
      style={
        secondary
          ? undefined
          : {
              background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)",
              boxShadow: "0 8px 24px rgba(92,107,92,0.35)",
            }
      }
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle Pill                                                        */
/* ------------------------------------------------------------------ */

function TogglePill({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        active ? "bg-[#5C6B5C]" : "bg-[#EBEDF0]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          active ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function HandleFirstPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    new Set()
  );
  const [transitioning, setTransitioning] = useState(false);
  const [visible, setVisible] = useState(true);
  const calledRef = useRef(false);

  // Patient info (optional, all skippable)
  const [patientFullName, setPatientFullName] = useState("");
  const [patientDob, setPatientDob] = useState("");
  const [patientInsurance, setPatientInsurance] = useState("");
  const [patientMemberId, setPatientMemberId] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Fetch data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await apiFetch("/api/dashboard/data");

        if (res.status === 401) {
          router.replace("/login");
          return;
        }

        const json = await res.json();
        if (!cancelled) {
          if (!json.snapshots || json.snapshots.length === 0) {
            router.replace("/dashboard");
            return;
          }
          setData(json);
          if (json.fullName) setPatientFullName(json.fullName);
          else if (json.userName) setPatientFullName(json.userName);

          // Restore session state (returning from calendar-connect)
          const savedStep = sessionStorage.getItem("guided-step");
          const savedSelected = sessionStorage.getItem("guided-selected");
          if (savedStep) {
            setStep(parseInt(savedStep, 10));
            sessionStorage.removeItem("guided-step");
          }
          if (savedSelected) {
            try {
              setSelectedProviders(
                new Set(JSON.parse(savedSelected) as string[])
              );
            } catch {
              /* ignore */
            }
            sessionStorage.removeItem("guided-selected");
          } else {
            // Initialize selected with all overdue
            const overdue = getOverdueProviders(json.snapshots);
            setSelectedProviders(
              new Set(overdue.map((s: Snapshot) => s.provider.id))
            );
          }
        }
      } catch {
        if (!cancelled) router.replace("/dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Advance step with transition
  const goToStep = useCallback(
    (next: number) => {
      if (transitioning) return;
      setTransitioning(true);
      setVisible(false);
      setTimeout(() => {
        setStep(next);
        setVisible(true);
        setTransitioning(false);
      }, 300);
    },
    [transitioning]
  );

  const advance = useCallback(() => {
    if (!data) return;
    const hasOverdue = getOverdueProviders(data.snapshots).length > 0;
    const next = getNextStep(
      step,
      data.hasGoogleCalendarConnection,
      hasOverdue
    );
    goToStep(next);
  }, [data, step, goToStep]);

  // Fire calls when reaching step 8 (confirmation)
  useEffect(() => {
    if (step !== 8 || !data || calledRef.current) return;
    calledRef.current = true;

    selectedProviders.forEach((providerId) => {
      const snap = data.snapshots.find((s) => s.provider.id === providerId);
      if (!snap) return;
      apiFetch("/api/vapi/start-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_user_id: data.appUserId,
          provider_id: snap.provider.id,
          provider_name: snap.provider.name,
          ...(snap.provider.phone
            ? { office_number: snap.provider.phone }
            : {}),
        }),
      }).catch(() => {
        /* fire and forget */
      });
    });
  }, [step, data, selectedProviders]);

  /* ---- Loading state ---- */
  if (loading || !data) {
    return <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />;
  }

  const { appUserId, userName, snapshots, hasGoogleCalendarConnection } = data;
  const overdueProviders = getOverdueProviders(snapshots);
  const currentProviders = snapshots.filter(
    (s) => !overdueProviders.includes(s)
  );
  const hasOverdue = overdueProviders.length > 0;

  // Count visible steps (skip 4 if no overdue, skip 5 if calendar connected)
  const visibleSteps: number[] = [1, 2, 3];
  if (hasOverdue) visibleSteps.push(4);
  visibleSteps.push(5); // patient info (always show)
  if (!hasGoogleCalendarConnection) visibleSteps.push(6);
  visibleSteps.push(7, 8);
  const activeIndex = visibleSteps.indexOf(step) + 1;

  function toggleProvider(id: string) {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ---- Render current screen ---- */
  function renderScreen() {
    switch (step) {
      /* ---- Screen 1: Providers found ---- */
      case 1:
        return (
          <>
            <CharacterWithBubble pose="waving">
              Hey{userName ? `, ${userName}` : ""}! We found{" "}
              {snapshots.length} healthcare provider
              {snapshots.length === 1 ? "" : "s"} from your records.
            </CharacterWithBubble>

            <div className="mt-6 space-y-3">
              {snapshots.map((s) => (
                <div
                  key={s.provider.id}
                  className="flex items-center justify-between rounded-xl border border-[#EBEDF0] bg-white shadow-sm px-4 py-3"
                >
                  <span className="text-sm font-medium text-[#1A1D2E]">
                    {s.provider.name}
                  </span>
                  <span className="rounded-full bg-[#F0F2F5] px-2.5 py-0.5 text-xs text-[#7A7F8A]">
                    {s.visitCount} visit{s.visitCount === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>

            <GoldButton onClick={advance}>This look right? →</GoldButton>
          </>
        );

      /* ---- Screen 2: Visit history ---- */
      case 2:
        return (
          <>
            <CharacterWithBubble pose="pointing">
              We pulled your last 12 months of healthcare visits. Here&apos;s
              what we see.
            </CharacterWithBubble>

            <div className="mt-6 space-y-3">
              {snapshots.map((s) => (
                <div
                  key={s.provider.id}
                  className="flex items-center justify-between rounded-xl border border-[#EBEDF0] bg-white shadow-sm px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[#1A1D2E]">
                      {s.provider.name}
                    </p>
                    <p className="text-xs text-[#7A7F8A]">
                      {formatDate(s.lastVisitDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F0F2F5] px-2.5 py-0.5 text-xs text-[#7A7F8A]">
                    {s.visitCount} visit{s.visitCount === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>

            <GoldButton onClick={advance}>Does this look right? →</GoldButton>
          </>
        );

      /* ---- Screen 3: Overdue ---- */
      case 3:
        return (
          <>
            <CharacterWithBubble pose="thinking">
              {hasOverdue
                ? "Based on your visit history, these providers haven't seen you in a while."
                : "You look pretty current! All your providers have been seen recently."}
            </CharacterWithBubble>

            <div className="mt-6 space-y-5">
              {hasOverdue && (
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#5C6B5C]">
                    Might be overdue
                  </h3>
                  <div className="space-y-2">
                    {overdueProviders.map((s) => (
                      <div
                        key={s.provider.id}
                        className="flex items-center justify-between rounded-xl border border-[#EBEDF0] bg-white shadow-sm px-4 py-3"
                      >
                        <span className="text-sm font-medium text-[#1A1D2E]">
                          {s.provider.name}
                        </span>
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                          {s.lastVisitDate
                            ? `${monthsAgo(s.lastVisitDate)} months ago`
                            : "Overdue"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentProviders.length > 0 && (
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-400">
                    Looking good
                  </h3>
                  <div className="space-y-2">
                    {currentProviders.map((s) => (
                      <div
                        key={s.provider.id}
                        className="flex items-center justify-between rounded-xl border border-[#EBEDF0] bg-white shadow-sm px-4 py-3"
                      >
                        <span className="text-sm font-medium text-[#1A1D2E]">
                          {s.provider.name}
                        </span>
                        <span className="text-emerald-400">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <path
                              d="M3 8.5L6.5 12L13 4"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <GoldButton onClick={advance}>
              {hasOverdue ? "Let's fix that →" : "Next →"}
            </GoldButton>
          </>
        );

      /* ---- Screen 4: Authorize scheduling ---- */
      case 4:
        return (
          <>
            <CharacterWithBubble pose="pointing">
              Want us to schedule appointments with your overdue providers?
            </CharacterWithBubble>

            <div className="mt-6 space-y-3">
              {overdueProviders.map((s) => (
                <div
                  key={s.provider.id}
                  className="flex items-center justify-between rounded-xl border border-[#EBEDF0] bg-white shadow-sm px-4 py-3"
                >
                  <span className="text-sm font-medium text-[#1A1D2E]">
                    {s.provider.name}
                  </span>
                  <TogglePill
                    active={selectedProviders.has(s.provider.id)}
                    onToggle={() => toggleProvider(s.provider.id)}
                  />
                </div>
              ))}
            </div>

            <GoldButton onClick={advance}>
              Schedule these ({selectedProviders.size}) →
            </GoldButton>
          </>
        );

      /* ---- Screen 5: Patient info (all optional) ---- */
      case 5:
        return (
          <>
            <CharacterWithBubble pose="thinking">
              Before I start calling, a few details will help me book faster.
              Fill in what you can — or skip anything you&apos;re not sure about.
            </CharacterWithBubble>

            <div className="mt-6 space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-[#7A7F8A]">First name</label>
                  <input
                    type="text"
                    value={patientFullName.split(" ")[0] || ""}
                    onChange={(e) => {
                      const last = patientFullName.split(" ").slice(1).join(" ");
                      setPatientFullName(`${e.target.value} ${last}`.trim());
                    }}
                    placeholder="First name"
                    className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-[#7A7F8A]">Last name</label>
                  <input
                    type="text"
                    value={patientFullName.split(" ").slice(1).join(" ") || ""}
                    onChange={(e) => {
                      const first = patientFullName.split(" ")[0] || "";
                      setPatientFullName(`${first} ${e.target.value}`.trim());
                    }}
                    placeholder="Last name"
                    className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7A7F8A]">Date of birth</label>
                <input
                  type="date"
                  value={patientDob}
                  onChange={(e) => setPatientDob(e.target.value)}
                  className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7A7F8A]">Insurance provider</label>
                <input
                  type="text"
                  value={patientInsurance}
                  onChange={(e) => setPatientInsurance(e.target.value)}
                  placeholder="e.g., Aetna, Blue Cross, United"
                  className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7A7F8A]">Member ID</label>
                <input
                  type="text"
                  value={patientMemberId}
                  onChange={(e) => setPatientMemberId(e.target.value)}
                  placeholder="Found on your insurance card"
                  className="w-full rounded-xl border border-[#EBEDF0] bg-white px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                />
              </div>
            </div>

            <GoldButton
              onClick={async () => {
                // Save whatever they filled in
                const profile: Record<string, string> = {};
                if (patientFullName.trim()) profile.full_name = patientFullName.trim();
                if (patientDob) profile.date_of_birth = patientDob;
                if (patientInsurance.trim()) profile.insurance_provider = patientInsurance.trim();
                if (patientMemberId.trim()) profile.insurance_member_id = patientMemberId.trim();

                if (Object.keys(profile).length > 0) {
                  setSavingProfile(true);
                  try {
                    await apiFetch("/api/patient-profile", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ profile, app_user_id: appUserId }),
                    });
                  } catch { /* non-critical */ }
                  setSavingProfile(false);
                }
                advance();
              }}
            >
              {savingProfile ? "Saving..." : "Continue →"}
            </GoldButton>
            <GoldButton onClick={advance} secondary>
              Skip — I&apos;ll add this later
            </GoldButton>
          </>
        );

      /* ---- Screen 6: Calendar connect ---- */
      case 6:
        return (
          <>
            <CharacterWithBubble pose="thinking">
              One more thing — connect your calendar so we book during your free
              times.
            </CharacterWithBubble>

            <div className="mt-6 rounded-xl border border-[#EBEDF0] bg-white shadow-sm p-5">
              <p className="text-sm text-[#7A7F8A]">
                We&apos;ll check your Google Calendar for conflicts before
                suggesting appointment times. Your calendar data stays private
                and is only used for scheduling.
              </p>
            </div>

            <GoldButton
              onClick={() => {
                sessionStorage.setItem("guided-step", String(step));
                sessionStorage.setItem(
                  "guided-selected",
                  JSON.stringify(Array.from(selectedProviders))
                );
                window.location.href = `/calendar-connect?user_id=${appUserId}`;
              }}
            >
              Connect Google Calendar
            </GoldButton>
            <GoldButton onClick={advance} secondary>
              Skip for now →
            </GoldButton>
          </>
        );

      /* ---- Screen 7: Current providers ---- */
      case 7:
        return (
          <>
            <CharacterWithBubble pose="pointing">
              {currentProviders.length > 0
                ? "These providers seem up-to-date. Let us know if any need attention."
                : "All your providers are being scheduled!"}
            </CharacterWithBubble>

            {currentProviders.length > 0 && (
              <div className="mt-6 space-y-3">
                {currentProviders.map((s) => (
                  <div
                    key={s.provider.id}
                    className="flex items-center justify-between rounded-xl border border-[#EBEDF0] bg-white shadow-sm px-4 py-3"
                  >
                    <span className="text-sm font-medium text-[#1A1D2E]">
                      {s.provider.name}
                    </span>
                    {selectedProviders.has(s.provider.id) ? (
                      <span className="text-xs text-[#5C6B5C]">Added</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleProvider(s.provider.id)}
                        className="rounded-full border border-[#5C6B5C] px-3 py-1 text-xs font-medium text-[#5C6B5C] transition hover:bg-[#5C6B5C]/10"
                      >
                        Schedule this one too
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <GoldButton onClick={advance}>Looks good →</GoldButton>
          </>
        );

      /* ---- Screen 8: Confirmation ---- */
      case 8: {
        const selectedSnaps = snapshots.filter((s) =>
          selectedProviders.has(s.provider.id)
        );
        return (
          <>
            <CharacterWithBubble pose="celebrating">
              {selectedSnaps.length > 0
                ? `We'll start booking with ${selectedSnaps.length} provider${selectedSnaps.length === 1 ? "" : "s"}!`
                : "You're all set!"}
            </CharacterWithBubble>

            {selectedSnaps.length > 0 && (
              <div className="mt-6 space-y-2">
                {selectedSnaps.map((s) => (
                  <div
                    key={s.provider.id}
                    className="flex items-center gap-3 rounded-xl border border-[#EBEDF0] bg-white shadow-sm px-4 py-3"
                  >
                    <span className="text-[#5C6B5C]">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M3 8.5L6.5 12L13 4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-medium text-[#1A1D2E]">
                      {s.provider.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-sm text-[#7A7F8A]">
              After these appointments are booked, we&apos;ll help you customize
              QB further.
            </p>

            <GoldButton onClick={() => router.push("/dashboard")}>
              Enter your dashboard →
            </GoldButton>
          </>
        );
      }

      default:
        return null;
    }
  }

  return (
    <div className="relative min-h-screen text-[#1A1D2E] overflow-hidden" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-[#5C6B5C]/10 blur-3xl" />

      <div className="relative mx-auto max-w-lg px-5 py-10">
        {/* Progress dots */}
        <ProgressDots total={visibleSteps.length} active={activeIndex} />

        {/* Branding */}
        <p className="text-xs font-semibold uppercase tracking-widest text-[#5C6B5C] mb-6">
          Quarterback AI
        </p>

        {/* Animated content */}
        <div
          className="transition-all duration-300"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(-20px)",
          }}
        >
          {renderScreen()}
        </div>
      </div>
    </div>
  );
}
