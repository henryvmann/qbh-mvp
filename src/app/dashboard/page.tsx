"use client";

/**
 * Dashboard — Quarterback Health brand sweep (v5 design language).
 *
 * Replaces the legacy sage-green layout with BrandShell + glass cards
 * in cream + electric blue. Pulls live data from /api/dashboard/data
 * just like before; only the chrome and the rendering change.
 *
 * Layout:
 *   - Top app bar (BrandShell): wordmark + user avatar
 *   - Greeting + Health Coordination Score (HealthScoreRing reused)
 *   - Kate's #1 suggestion (BestNextStep reused)
 *   - Week strip → /calendar-view
 *   - Quick stats row (Providers / Overdue / Upcoming)
 *   - Care team list (provider rows in a single GlassCard)
 *   - "What to do next" 2x2 grid
 *   - Bottom nav (5 tabs)
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UserAvatar from "../../components/qbh/UserAvatar";
import { apiFetch } from "../../lib/api";
import HandleItButton from "../../components/qbh/HandleItButton";
import BestNextStep from "../../components/qbh/BestNextStep";
import ProviderLink from "../../components/qbh/ProviderLink";
import HealthScoreRing from "../../components/qbh/HealthScoreRing";
import StuckPrompt from "../../components/qbh/StuckPrompt";
import NewProviderWalkthrough from "../../components/qbh/NewProviderWalkthrough";
import BrandShell from "../../components/brand/BrandShell";
import {
  GlassCard,
  IconTile,
  SectionLabel,
  AustinHeading,
} from "../../components/brand/cards";
import {
  StethoscopeIcon,
  CalendarIcon,
  PersonIcon,
  DocumentIcon,
  InsightsIcon,
  UsersIcon,
  SparkleIcon,
} from "../../components/brand/icons";
import { T } from "../../components/brand";

type Provider = { id: string; name: string; provider_type?: string; specialty?: string | null; is_primary?: boolean | null };
type BookingState = { status?: string };
type Snapshot = {
  provider: Provider;
  followUpNeeded?: boolean;
  booking_state?: BookingState;
  lastVisitDate?: string | null;
  lastVisitCategory?: "just_visited" | "on_track" | "coming_due" | "overdue" | "needs_scheduling" | null;
  lastVisitLabel?: string | null;
};
type DashboardData = {
  appUserId: string;
  userName: string | null;
  snapshots: Snapshot[];
  hasGoogleCalendarConnection: boolean;
};

function isOverdue(s: Snapshot): boolean {
  return (
    !!s.followUpNeeded &&
    s.booking_state?.status !== "BOOKED" &&
    s.booking_state?.status !== "IN_PROGRESS"
  );
}
function hasConfirmedBooking(s: Snapshot): boolean {
  return s.booking_state?.status === "BOOKED";
}

const DAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function getWeekDays() {
  const today = new Date();
  const dow = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    return { abbrev: DAY_ABBREV[i], date: d.getDate(), isToday: i === dow };
  });
}

function DashboardInner() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [careRecipients, setCareRecipients] = useState<
    Array<{ id: string; name: string; relationship: string }>
  >([]);
  // Provider-level pause map for the "feeling stuck?" prompt. Read
  // from patient_profile.paused_providers. Refetched whenever the user
  // taps a snooze option so the prompt clears immediately.
  const [pausedProviders, setPausedProviders] = useState<
    Record<string, { until: string; kind: string }>
  >({});
  const [introducedIds, setIntroducedIds] = useState<string[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Scope filter — null = "All". Otherwise filters provider count,
  // overdue, upcoming, and the care-team list to providers attached
  // to that recipient. Stored only client-side; the dashboard query
  // returns everyone.
  const [scope, setScope] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Tolerate cold-start auth lag with two retries before bouncing.
      let res = await apiFetch("/api/dashboard/data");
      if (res.status === 401) {
        await new Promise((r) => setTimeout(r, 1500));
        res = await apiFetch("/api/dashboard/data");
      }
      if (res.status === 401) {
        await new Promise((r) => setTimeout(r, 3000));
        res = await apiFetch("/api/dashboard/data");
      }
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = await res.json();
      if (json?.ok) setData(json);
      setLoading(false);
    }
    load().catch(() => setLoading(false));

    refreshProfile();
  }, [router]);

  async function refreshProfile() {
    try {
      const r = await apiFetch("/api/patient-profile");
      const p = await r.json();
      const list = p?.profile?.care_recipients;
      if (Array.isArray(list)) setCareRecipients(list);
      const paused = p?.profile?.paused_providers;
      if (paused && typeof paused === "object") setPausedProviders(paused);
      const ids = p?.profile?.introduced_provider_ids;
      setIntroducedIds(Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : []);
    } catch {
      /* best-effort */
    } finally {
      // Mark profile loaded even on error so the rest of the dashboard
      // (StuckPrompt, etc.) doesn't hang waiting for a fetch that won't
      // come. introducedIds will just be [] in the failure case.
      setProfileLoaded(true);
    }
  }

  if (loading) {
    return (
      <BrandShell topRight={<UserAvatar />}>
        <div style={{ height: 200 }} />
      </BrandShell>
    );
  }

  if (!data) {
    return (
      <BrandShell topRight={<UserAvatar />}>
        <div
          style={{
            textAlign: "center",
            color: T.lightMuted,
            paddingTop: 80,
          }}
        >
          Setting up your dashboard…
        </div>
      </BrandShell>
    );
  }

  const { appUserId, userName, snapshots: allSnapshots } = data;

  // Scope filter — applies the care_recipient match the user picked
  // (null = All). Same matching rules as /providers: literal name,
  // relationship match, and Self-label aliases ("Myself", "Me").
  const SELF_LABELS = ["self", "myself", "me", "my health"];
  const snapshots = scope
    ? allSnapshots.filter((s) => {
        try {
          const raw = (s.provider as { care_recipient?: string | string[] | null }).care_recipient;
          if (!raw) return false;
          const recipients: string[] = typeof raw === "string" ? JSON.parse(raw) : raw;
          const selfRecipient = careRecipients.find((r) => r.name === scope);
          return recipients.some((r) => {
            const lower = r.toLowerCase().trim();
            if (r === scope || lower === scope.toLowerCase()) return true;
            if (selfRecipient?.relationship === "Self" && SELF_LABELS.includes(lower)) return true;
            const match = careRecipients.find((cr) => cr.name === scope);
            if (match && (match.relationship === r || match.relationship.toLowerCase() === lower)) return true;
            return false;
          });
        } catch {
          return false;
        }
      })
    : allSnapshots;

  const nonPharmacy = snapshots.filter((s) => s.provider.provider_type !== "pharmacy");
  const overdueCount = nonPharmacy.filter(isOverdue).length;
  const upcomingCount = nonPharmacy.filter(hasConfirmedBooking).length;
  const actionCount = overdueCount;
  const weekDays = getWeekDays();

  // Weekly check-in framing: lead with what Kate's surfaced rather
  // than a static "Today." First-person from Kate so the dashboard
  // reads as her speaking, not a system count. The richer inference-
  // layer copy lives in Kate's chat surfaces (floating panel + /kate)
  // — this dashboard title stays a one-line summary.
  const checkIn =
    actionCount === 0 && upcomingCount === 0
      ? "All clear this week."
      : actionCount === 0
      ? `${upcomingCount} appointment${upcomingCount === 1 ? "" : "s"} coming up. Nothing else needs you.`
      : actionCount === 1
      ? "I found 1 thing this week."
      : `I found ${actionCount} things this week.`;

  return (
    <BrandShell topRight={<UserAvatar />}>
      {/* Greeting + Kate's weekly check-in */}
      <div style={{ paddingTop: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: T.lightMuted, marginBottom: 6 }}>
          Hi, {userName || "there"}
        </div>
        <AustinHeading size={32}>{checkIn}</AustinHeading>
      </div>

      {/* Scope chips — All / Self / Partner / Child / etc.
          Provider count + overdue + upcoming + the care-team list all
          recompute against the selected scope. Default-named chips
          ("My Partner" / "My Child" / "My Parent") prompt for a real
          name on first tap so the user can personalize without
          going to settings. */}
      {careRecipients.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          <ScopeChip label="All" active={scope === null} onClick={() => setScope(null)} />
          {careRecipients.map((r) => (
            <ScopeChip
              key={r.id}
              label={r.name}
              sublabel={r.relationship && r.relationship !== "Self" ? r.relationship : undefined}
              active={scope === r.name}
              isDefault={/^my\s/i.test(r.name)}
              onClick={() => setScope(scope === r.name ? null : r.name)}
              onRename={async (newName) => {
                const trimmed = newName.trim();
                if (!trimmed || trimmed === r.name) return;
                const updated = careRecipients.map((rr) =>
                  rr.id === r.id ? { ...rr, name: trimmed } : rr
                );
                setCareRecipients(updated);
                if (scope === r.name) setScope(trimmed);
                await apiFetch("/api/patient-profile", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ profile: { care_recipients: updated } }),
                });
              }}
            />
          ))}
          <Link
            href="/care-recipients"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px dashed ${T.lightBorder}`,
              fontSize: 12.5,
              color: T.lightMuted,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            + Add another
          </Link>
        </div>
      )}

      {/* New-provider walkthrough: surfaces any provider the user hasn't
          been introduced to yet, one at a time, with date-aware framing
          ("It's been X months since you saw Y" vs "You're good for now").
          Hides the StuckPrompt while it's active so we don't double-prompt
          on the same provider. Goes away on its own once the queue empties. */}
      {data?.snapshots && (
        <NewProviderWalkthrough
          snapshots={data.snapshots}
          introducedIds={introducedIds}
          onChange={refreshProfile}
        />
      )}

      {/* Soft Kate prompt for providers waiting on follow-up. Excludes
          providers the user just walked through via NewProviderWalkthrough
          — they already got their one nudge there. No shame language, no
          urgency, and four snooze cadences. Gate on profileLoaded so the
          first render doesn't flash a stale "stuck" card before introducedIds
          has been fetched from /api/patient-profile. */}
      {data?.snapshots && profileLoaded && (
        <StuckPrompt
          snapshots={data.snapshots}
          pausedProviders={pausedProviders}
          introducedIds={introducedIds}
          onChange={refreshProfile}
        />
      )}

      {/* Health Coordination Score */}
      <GlassCard padding={20} style={{ marginBottom: 18 }}>
        <SectionLabel style={{ marginBottom: 8, textAlign: "center" }}>
          Health Coordination Score
        </SectionLabel>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <HealthScoreRing />
        </div>
      </GlassCard>

      {/* Intake CTA — sits directly under the score so it's the
          first thing the eye lands on, and uses brand-blue background
          to drive intake completion. Self-hides on completion or
          dismissal. */}
      <IntakeCTA />

      {/* Kate's #1 Suggestion */}
      <div style={{ marginBottom: 18 }} data-wizard="best-next-step">
        <BestNextStep />
      </div>

      {/* Week strip */}
      <Link
        href="/calendar-view"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
          textDecoration: "none",
          marginBottom: 18,
          padding: "8px 0",
        }}
      >
        {weekDays.map((day, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "8px 0",
              borderRadius: 12,
              background: day.isToday ? T.electric : "transparent",
              color: day.isToday ? T.white : T.lightMuted,
              boxShadow: day.isToday
                ? "0 4px 14px rgba(22,119,255,0.28)"
                : "none",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>
              {day.abbrev}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
              {day.date}
            </span>
          </div>
        ))}
      </Link>

      {/* Quick stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: overdueCount > 0 ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
          gap: 10,
          marginBottom: 22,
        }}
      >
        <StatTile
          href="/providers"
          value={snapshots.length}
          label="Providers"
          color={T.electric}
        />
        {overdueCount > 0 && (
          <StatTile
            href="/visits"
            value={overdueCount}
            label="To schedule"
            color={T.red}
          />
        )}
        <StatTile
          href="/visits"
          value={upcomingCount}
          label="Upcoming"
          color={T.green}
        />
      </div>

      {/* Care team */}
      <div style={{ marginBottom: 22 }} data-wizard="providers">
        <SectionLabel>Your care team</SectionLabel>
        {snapshots.length === 0 ? (
          <GlassCard padding={20}>
            <Link
              href="/providers?add=true"
              style={{
                display: "block",
                textAlign: "center",
                fontSize: 14,
                fontWeight: 600,
                color: T.electric,
                textDecoration: "none",
                padding: "12px 0",
              }}
            >
              {scope ? `Add ${scope}'s first provider →` : "Add your first provider →"}
            </Link>
          </GlassCard>
        ) : (
          <GlassCard padding={0} radius={20}>
            {snapshots.map((s, idx) => {
              const overdue = isOverdue(s);
              const booked = hasConfirmedBooking(s);
              const isPharmacy = s.provider.provider_type === "pharmacy";
              const isLast = idx === snapshots.length - 1;
              // "On track" only when actually booked. Without a booking
              // there's nothing to be on track for — we fall through to
              // a neutral state instead. Providers the user is no longer
              // seeing belong in the Archive (status='archived'), not in
              // this active list at all.
              const dotColor = isPharmacy
                ? T.lightMuted
                : overdue
                ? T.red
                : booked
                ? T.green
                : T.lightMuted;

              return (
                <div
                  key={s.provider.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "14px 16px",
                    borderBottom: isLast
                      ? "none"
                      : `1px solid ${T.lightBorder}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: dotColor,
                        boxShadow: `0 0 8px ${dotColor}40`,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14.5,
                          fontWeight: 500,
                          color: T.lightText,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {s.provider.is_primary && (
                          <span
                            title="Primary"
                            style={{ color: T.warn, fontSize: 14, lineHeight: 1 }}
                          >
                            ★
                          </span>
                        )}
                        <ProviderLink
                          providerId={s.provider.id}
                          providerName={s.provider.name}
                        />
                      </div>
                      {s.provider.specialty && (
                        <div style={{ fontSize: 11.5, color: T.lightMuted, marginTop: 2 }}>
                          {s.provider.specialty}
                        </div>
                      )}
                    </div>
                  </div>
                  {isPharmacy ? (
                    <span style={{ fontSize: 11, color: T.lightMuted, fontWeight: 600 }}>
                      Pharmacy
                    </span>
                  ) : overdue ? (
                    <HandleItButton
                      userId={appUserId}
                      providerId={s.provider.id}
                      providerName={s.provider.name}
                      label="Book"
                    />
                  ) : booked ? (
                    <Pill bg="rgba(39,196,107,0.14)" fg={T.green}>
                      On track
                    </Pill>
                  ) : null}
                </div>
              );
            })}
          </GlassCard>
        )}
      </div>

      {/* What to do next */}
      <div data-wizard="next-steps">
        <SectionLabel>What to do next</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
          }}
        >
          {[
            { href: "/providers", title: "View your care team", desc: "Doctors, dentists, specialists", icon: <StethoscopeIcon color={T.electric} /> },
            { href: "/visits", title: "Check your visits", desc: "Upcoming & past", icon: <CalendarIcon color={T.electric} /> },
            { href: "/coverage", title: "Review your coverage", desc: "EOBs & claims", icon: <DocumentIcon color={T.electric} size={18} /> },
            { href: "/caregivers", title: "Manage caregivers", desc: "People who help", icon: <UsersIcon color={T.electric} size={18} /> },
            { href: "/insights", title: "See Kate's insights", desc: "Her read on your week", icon: <InsightsIcon color={T.electric} size={18} /> },
            { href: "/goals", title: "Track your goals", desc: "Progress and follow-ups", icon: <SparkleIcon color={T.electric} size={18} /> },
          ].map((item) => (
            <GlassCard key={item.href} href={item.href} padding={14}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <IconTile size={36} radius={10}>
                  {item.icon}
                </IconTile>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: T.lightText }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.lightMuted, marginTop: 2 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </BrandShell>
  );
}

function StatTile({
  href,
  value,
  label,
  color,
}: {
  href: string;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <GlassCard padding={14}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color,
              lineHeight: 1,
              fontFamily: "var(--font-fraunces, serif)",
            }}
          >
            {value}
          </div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: T.lightMuted,
              marginTop: 8,
            }}
          >
            {label}
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

function IntakeCTA() {
  const [show, setShow] = useState(false);
  const [progressLabel, setProgressLabel] = useState("Help Kate get to know you");

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("qbh_intake_cta_dismissed") === "1") {
      return;
    }
    apiFetch("/api/patient-profile")
      .then((r) => r.json())
      .then((data) => {
        const intake = data?.profile?.intake;
        if (intake?.completed_at) return;
        const answered = intake?.answers ? Object.keys(intake.answers).length : 0;
        if (answered > 0) setProgressLabel(`Continue your intake (${answered} answered)`);
        setShow(true);
      })
      .catch(() => {});
  }, []);

  if (!show) return null;

  return (
    <Link
      href="/intake"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        // Solid electric blue — eye-catching primary CTA, the
        // brightest card on the dashboard so users see the path to
        // personalizing Kate.
        background: T.electric,
        color: "white",
        borderRadius: 16,
        padding: "16px 18px",
        marginBottom: 18,
        textDecoration: "none",
        boxShadow: "0 8px 24px rgba(22,119,255,0.28)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, opacity: 0.85, textTransform: "uppercase", marginBottom: 4 }}>
          {progressLabel.startsWith("Continue") ? "Pick up where you left off" : "Help Kate get to know you"}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
          {progressLabel.startsWith("Continue") ? progressLabel : "Tell me what makes you, you"}
        </div>
        <div style={{ fontSize: 12.5, marginTop: 4, opacity: 0.85 }}>
          A few questions on health, sleep, stress. Earns score points. Skip anything.
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "10px 16px",
            background: "rgba(255,255,255,0.18)",
            color: "white",
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 700,
            border: "1px solid rgba(255,255,255,0.30)",
          }}
        >
          Start →
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            localStorage.setItem("qbh_intake_cta_dismissed", "1");
            setShow(false);
          }}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.7)",
            fontSize: 20,
            cursor: "pointer",
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </Link>
  );
}

function ScopeChip({
  label,
  sublabel,
  active,
  onClick,
  isDefault,
  onRename,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
  /** True when the chip's name is still the onboarding placeholder
   *  ("My Partner" / "My Child" / "My Parent"). First tap on a
   *  default-named chip swaps the chip into rename mode instead of
   *  toggling scope, so the user can personalize without going to
   *  settings. After rename, taps toggle scope as normal. */
  isDefault?: boolean;
  onRename?: (newName: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setDraft(label);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [renaming, label]);

  if (renaming) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          background: "white",
          border: `1px solid ${T.electric}`,
          borderRadius: 999,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={sublabel ? `e.g. ${sublabel === "Partner" ? "Henry" : sublabel === "Child" ? "Wyatt" : "Mom"}` : "Name"}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const t = draft.trim();
              if (t && onRename) onRename(t);
              setRenaming(false);
            } else if (e.key === "Escape") {
              setRenaming(false);
            }
          }}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 12.5,
            fontWeight: 600,
            color: T.lightText,
            width: 110,
          }}
        />
        <button
          type="button"
          onClick={() => {
            const t = draft.trim();
            if (t && onRename) onRename(t);
            setRenaming(false);
          }}
          style={{
            border: "none",
            background: T.electric,
            color: T.white,
            borderRadius: 999,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Save
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (isDefault && onRename) {
          setRenaming(true);
        } else {
          onClick();
        }
      }}
      onDoubleClick={() => {
        if (onRename) setRenaming(true);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: active ? T.electric : "rgba(255,255,255,0.6)",
        color: active ? T.white : T.lightText,
        border: `1px solid ${active ? T.electric : T.lightBorder}`,
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
      }}
      title={isDefault && onRename ? "Tap to name this person" : undefined}
    >
      {label}
      {sublabel && (
        <span style={{ fontSize: 10, opacity: active ? 0.8 : 0.6, fontWeight: 500 }}>
          {sublabel}
        </span>
      )}
    </button>
  );
}

function Pill({
  bg,
  fg,
  children,
}: {
  bg: string;
  fg: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 600,
        padding: "5px 10px",
        borderRadius: 999,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}


export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            background: T.lightBg,
          }}
        />
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
