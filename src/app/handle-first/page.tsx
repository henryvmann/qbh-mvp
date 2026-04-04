"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

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
  if (next === 4 && !hasOverdue) next = 5;
  if (next === 5 && hasCalendar) next = 6;
  return next;
}

/* ------------------------------------------------------------------ */
/*  SVG Character                                                      */
/* ------------------------------------------------------------------ */

type Pose = "waving" | "thinking" | "pointing" | "celebrating";

function Character({ pose }: { pose: Pose }) {
  const armProps = {
    stroke: "#1E2B45",
    strokeWidth: 4,
    strokeLinecap: "round" as const,
    fill: "none",
  };

  function renderArms() {
    switch (pose) {
      case "waving":
        return (
          <>
            <path d="M35 68 L20 85" {...armProps} />
            <path d="M65 68 L80 50 L85 40" {...armProps} />
          </>
        );
      case "thinking":
        return (
          <>
            <path d="M35 68 L20 85" {...armProps} />
            <path d="M65 68 L72 58 L62 45" {...armProps} />
          </>
        );
      case "pointing":
        return (
          <>
            <path d="M35 68 L20 85" {...armProps} />
            <path d="M65 68 L90 68" {...armProps} />
          </>
        );
      case "celebrating":
        return (
          <>
            <path d="M35 68 L15 42" {...armProps} />
            <path d="M65 68 L85 42" {...armProps} />
            {/* sparkle dots */}
            <circle cx="12" cy="35" r="2.5" fill="#D4A843" />
            <circle cx="88" cy="35" r="2.5" fill="#D4A843" />
            <circle cx="50" cy="18" r="2" fill="#D4A843" />
            <circle cx="30" cy="25" r="1.5" fill="#D4A843" />
            <circle cx="70" cy="25" r="1.5" fill="#D4A843" />
          </>
        );
    }
  }

  return (
    <svg
      width="100"
      height="140"
      viewBox="0 0 100 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Head */}
      <circle cx="50" cy="32" r="16" fill="#1E2B45" />
      {/* Body */}
      <rect x="32" y="55" width="36" height="50" rx="10" fill="#1E2B45" />
      {/* Gold badge */}
      <circle cx="50" cy="70" r="4" fill="#D4A843" />
      {/* Arms */}
      {renderArms()}
      {/* Legs */}
      <path
        d="M42 105 L38 130"
        stroke="#1E2B45"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M58 105 L62 130"
        stroke="#1E2B45"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Talk Bubble                                                        */
/* ------------------------------------------------------------------ */

function TalkBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1">
      {/* Tail pointing left */}
      <div
        className="absolute left-0 top-5 -translate-x-full hidden sm:block"
        style={{
          width: 0,
          height: 0,
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderRight: "10px solid #1E2B45",
        }}
      />
      <div className="rounded-2xl border border-[#1E2B45] bg-[#131B2E] p-5">
        <div className="text-base text-[#EFF4FF]">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Character With Bubble                                              */
/* ------------------------------------------------------------------ */

function CharacterWithBubble({
  pose,
  children,
}: {
  pose: Pose;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
      <Character pose={pose} />
      <TalkBubble>{children}</TalkBubble>
    </div>
  );
}

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
              ? "bg-[#D4A843]"
              : i + 1 < active
              ? "bg-[#D4A843]/50"
              : "border border-[#1E2B45] bg-transparent"
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
          ? "border border-[#1E2B45] bg-transparent text-[#6B85A8] hover:bg-[#131B2E]"
          : "bg-[#D4A843] text-[#0B1120] hover:bg-[#D4A843]/90"
      }`}
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
        active ? "bg-[#D4A843]" : "bg-[#1E2B45]"
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

  // Fire calls when reaching step 7
  useEffect(() => {
    if (step !== 7 || !data || calledRef.current) return;
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
    return <div className="min-h-screen bg-[#0B1120]" />;
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
  if (!hasGoogleCalendarConnection) visibleSteps.push(5);
  visibleSteps.push(6, 7);
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
                  className="flex items-center justify-between rounded-xl border border-[#1E2B45] bg-[#131B2E] px-4 py-3"
                >
                  <span className="text-sm font-medium text-[#EFF4FF]">
                    {s.provider.name}
                  </span>
                  <span className="rounded-full bg-[#1E2B45] px-2.5 py-0.5 text-xs text-[#6B85A8]">
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
                  className="flex items-center justify-between rounded-xl border border-[#1E2B45] bg-[#131B2E] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[#EFF4FF]">
                      {s.provider.name}
                    </p>
                    <p className="text-xs text-[#6B85A8]">
                      {formatDate(s.lastVisitDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#1E2B45] px-2.5 py-0.5 text-xs text-[#6B85A8]">
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
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#D4A843]">
                    Might be overdue
                  </h3>
                  <div className="space-y-2">
                    {overdueProviders.map((s) => (
                      <div
                        key={s.provider.id}
                        className="flex items-center justify-between rounded-xl border border-[#1E2B45] bg-[#131B2E] px-4 py-3"
                      >
                        <span className="text-sm font-medium text-[#EFF4FF]">
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
                        className="flex items-center justify-between rounded-xl border border-[#1E2B45] bg-[#131B2E] px-4 py-3"
                      >
                        <span className="text-sm font-medium text-[#EFF4FF]">
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
                  className="flex items-center justify-between rounded-xl border border-[#1E2B45] bg-[#131B2E] px-4 py-3"
                >
                  <span className="text-sm font-medium text-[#EFF4FF]">
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

      /* ---- Screen 5: Calendar connect ---- */
      case 5:
        return (
          <>
            <CharacterWithBubble pose="thinking">
              One more thing — connect your calendar so we book during your free
              times.
            </CharacterWithBubble>

            <div className="mt-6 rounded-xl border border-[#1E2B45] bg-[#131B2E] p-5">
              <p className="text-sm text-[#6B85A8]">
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

      /* ---- Screen 6: Current providers ---- */
      case 6:
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
                    className="flex items-center justify-between rounded-xl border border-[#1E2B45] bg-[#131B2E] px-4 py-3"
                  >
                    <span className="text-sm font-medium text-[#EFF4FF]">
                      {s.provider.name}
                    </span>
                    {selectedProviders.has(s.provider.id) ? (
                      <span className="text-xs text-[#D4A843]">Added</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleProvider(s.provider.id)}
                        className="rounded-full border border-[#D4A843] px-3 py-1 text-xs font-medium text-[#D4A843] transition hover:bg-[#D4A843]/10"
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

      /* ---- Screen 7: Confirmation ---- */
      case 7: {
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
                    className="flex items-center gap-3 rounded-xl border border-[#1E2B45] bg-[#131B2E] px-4 py-3"
                  >
                    <span className="text-[#D4A843]">
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
                    <span className="text-sm font-medium text-[#EFF4FF]">
                      {s.provider.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-sm text-[#6B85A8]">
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
    <div className="relative min-h-screen bg-[#0B1120] text-white overflow-hidden">
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-[#D4A843]/10 blur-3xl" />

      <div className="relative mx-auto max-w-lg px-5 py-10">
        {/* Progress dots */}
        <ProgressDots total={visibleSteps.length} active={activeIndex} />

        {/* Branding */}
        <p className="text-xs font-semibold uppercase tracking-widest text-[#D4A843] mb-6">
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
