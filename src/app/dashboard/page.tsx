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

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UserAvatar from "../../components/qbh/UserAvatar";
import { apiFetch } from "../../lib/api";
import HandleItButton from "../../components/qbh/HandleItButton";
import BestNextStep from "../../components/qbh/BestNextStep";
import ProviderLink from "../../components/qbh/ProviderLink";
import HealthScoreRing from "../../components/qbh/HealthScoreRing";
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
} from "../../components/brand/icons";
import { T } from "../../components/brand";

type Provider = { id: string; name: string; provider_type?: string; specialty?: string | null };
type BookingState = { status?: string };
type Snapshot = {
  provider: Provider;
  followUpNeeded?: boolean;
  booking_state?: BookingState;
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

    // Care recipients drive the scope chips. Best-effort — if the
    // fetch fails we just don't render the toggle.
    apiFetch("/api/patient-profile")
      .then((r) => r.json())
      .then((p) => {
        const list = p?.profile?.care_recipients;
        if (Array.isArray(list)) setCareRecipients(list);
      })
      .catch(() => {});
  }, [router]);

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
  // than a static "Today." Matches the typeform signal — users want
  // relief, not a wall of tiles.
  const checkIn =
    actionCount === 0 && upcomingCount === 0
      ? "All clear this week."
      : actionCount === 0
      ? `${upcomingCount} appointment${upcomingCount === 1 ? "" : "s"} coming up. Nothing else needs you.`
      : actionCount === 1
      ? "Found 1 thing for you this week."
      : `Found ${actionCount} things for you this week.`;

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
          recompute against the selected scope. Without this, the
          dashboard's "7 providers, 5 overdue" was ambiguous when a
          user is managing a household. */}
      {careRecipients.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          <ScopeChip label="All" active={scope === null} onClick={() => setScope(null)} />
          {careRecipients.map((r) => (
            <ScopeChip
              key={r.id}
              label={r.name}
              sublabel={r.relationship && r.relationship !== "Self" ? r.relationship : undefined}
              active={scope === r.name}
              onClick={() => setScope(scope === r.name ? null : r.name)}
            />
          ))}
        </div>
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
            label="Overdue"
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
              Hand off your first provider →
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
                      <div style={{ fontSize: 14.5, fontWeight: 500, color: T.lightText }}>
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
            { href: "/providers", title: "Providers", desc: "Your care team", icon: <StethoscopeIcon color={T.electric} /> },
            { href: "/visits", title: "Visits", desc: "Upcoming & past", icon: <CalendarIcon color={T.electric} /> },
            { href: "/coverage", title: "Coverage", desc: "EOBs & claims", icon: <DocumentIcon color={T.electric} size={18} /> },
            { href: "/caregivers", title: "Caregivers", desc: "People who help", icon: <UsersIcon color={T.electric} size={18} /> },
            { href: "/goals", title: "Goals", desc: "Track progress", icon: <InsightsIcon color={T.electric} size={18} /> },
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

function ScopeChip({
  label,
  sublabel,
  active,
  onClick,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
