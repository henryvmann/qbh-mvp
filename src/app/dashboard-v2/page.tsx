"use client";

/**
 * Dashboard v2 — simplified.
 *
 * One thing on top, the rest collapsed below. Per the philosophy:
 * the user should be able to scan in 2 seconds and know what's next
 * (or that nothing's needed). No score ring, no quick-stats row, no
 * 2x2 "what to do next" grid, no week strip.
 *
 * Surfaces, top to bottom:
 *   - Greeting (small)
 *   - One "today" card — the most urgent stuck item, OR
 *     a compact upcoming-appointment summary, OR
 *     "Nothing pressing today"
 *   - Compact care-team list
 *   - "More" link → existing /dashboard for power users
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import UserAvatar from "../../components/qbh/UserAvatar";
import BrandShell from "../../components/brand/BrandShell";
import ProviderLink from "../../components/qbh/ProviderLink";
import { T } from "../../components/brand";

type Provider = {
  id: string;
  name: string;
  display_name?: string | null;
  provider_type?: string;
  specialty?: string | null;
  is_primary?: boolean | null;
  phone_number?: string | null;
};
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
};

type PausedMap = Record<string, { until: string; kind: string }>;

function isStuck(s: Snapshot, paused: PausedMap): boolean {
  if (!s.followUpNeeded) return false;
  const status = s.booking_state?.status;
  if (status === "BOOKED" || status === "IN_PROGRESS") return false;
  const p = paused[s.provider.id];
  if (p && Date.parse(p.until) > Date.now()) return false;
  return true;
}

export default function DashboardV2Page() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [paused, setPaused] = useState<PausedMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await apiFetch("/api/dashboard/data");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (json?.ok) setData(json);
      setLoading(false);

      apiFetch("/api/patient-profile")
        .then((r) => r.json())
        .then((p) => {
          const pp = p?.profile?.paused_providers;
          if (pp && typeof pp === "object") setPaused(pp);
        })
        .catch(() => {});
    }
    load().catch(() => setLoading(false));
  }, [router]);

  const stuckProviders = useMemo(
    () => (data?.snapshots || []).filter((s) => isStuck(s, paused)),
    [data, paused]
  );

  // Active care team: non-pharmacy, non-calendar, status=active.
  const careTeam = useMemo(
    () =>
      (data?.snapshots || []).filter(
        (s) => s.provider.provider_type !== "pharmacy" && s.provider.provider_type !== "calendar"
      ),
    [data]
  );

  const firstName = data?.userName?.split(" ")[0] || null;

  if (loading) {
    return (
      <BrandShell topRight={<UserAvatar />}>
        <div style={{ height: 240 }} />
      </BrandShell>
    );
  }

  return (
    <BrandShell topRight={<UserAvatar />}>
      <div style={{ paddingTop: 8, paddingBottom: 80 }}>
        {/* Greeting — small, no big number, no fanfare. */}
        <div style={{ marginBottom: 18 }}>
          <h1
            style={{
              fontFamily: "var(--font-fraunces, serif)",
              fontSize: 26,
              fontWeight: 500,
              color: T.lightText,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            {greetingFor(firstName)}
          </h1>
        </div>

        {/* The one "today" card. */}
        <TodayCard stuck={stuckProviders} />

        {/* Care team — compact list, just the names + the most useful action. */}
        {careTeam.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                color: T.lightMuted,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Your team
            </div>
            <div
              style={{
                background: "white",
                border: `1px solid ${T.lightBorder}`,
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {careTeam.map((s, idx) => {
                const stuck = isStuck(s, paused);
                return (
                  <Link
                    key={s.provider.id}
                    href={`/providers/${s.provider.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "14px 16px",
                      borderBottom: idx < careTeam.length - 1 ? `1px solid ${T.lightBorder}` : "none",
                      textDecoration: "none",
                      color: T.lightText,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: stuck ? "#E08A1F" : T.electric,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: T.lightText }}>
                        {s.provider.display_name || s.provider.name}
                      </div>
                      {s.provider.specialty && (
                        <div style={{ fontSize: 11, color: T.lightMuted, marginTop: 1 }}>
                          {s.provider.specialty}
                        </div>
                      )}
                    </div>
                    {stuck && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#9C5A0A",
                          background: "rgba(224,138,31,0.12)",
                          padding: "3px 8px",
                          borderRadius: 999,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Waiting
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Single secondary link — power users dig deeper from here. */}
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link
            href="/dashboard"
            style={{
              fontSize: 12,
              color: T.lightMuted,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            See the full dashboard
          </Link>
        </div>
      </div>
    </BrandShell>
  );
}

function greetingFor(firstName: string | null): string {
  const hour = new Date().getHours();
  const tod = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  return firstName ? `${tod}, ${firstName}.` : `${tod}.`;
}

function TodayCard({ stuck }: { stuck: Snapshot[] }) {
  if (stuck.length === 0) {
    return (
      <div
        style={{
          background: "white",
          border: `1px solid ${T.lightBorder}`,
          borderRadius: 16,
          padding: 18,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, color: T.lightText, lineHeight: 1.5 }}>
          Nothing pressing today. I&rsquo;ll surface anything that comes up.
        </div>
      </div>
    );
  }

  const lead = stuck[0];
  const others = stuck.length - 1;
  const providerName = lead.provider.display_name || lead.provider.name;

  return (
    <div
      style={{
        background: "rgba(22,119,255,0.06)",
        border: `1px solid rgba(22,119,255,0.18)`,
        borderRadius: 16,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          aria-hidden
          style={{
            width: 4,
            alignSelf: "stretch",
            background: T.electric,
            borderRadius: 999,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: T.lightText, lineHeight: 1.5 }}>
            <strong>{providerName}</strong> has been on your list for a bit
            {others > 0 ? ` (and ${others} other${others > 1 ? "s" : ""})` : ""}.
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <Link
              href={`/providers/${lead.provider.id}?action=book`}
              style={{
                background: T.electric,
                color: T.white,
                fontSize: 13.5,
                fontWeight: 600,
                padding: "10px 14px",
                borderRadius: 10,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Book it now
            </Link>
            <details style={{ marginTop: 4 }}>
              <summary
                style={{
                  fontSize: 12,
                  color: T.lightMuted,
                  cursor: "pointer",
                  listStyle: "none",
                }}
              >
                More options
              </summary>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <Link
                  href={`/kate?prefill=stuck&provider_id=${lead.provider.id}&provider_name=${encodeURIComponent(providerName)}`}
                  style={{
                    fontSize: 12.5,
                    color: T.lightText,
                    background: "white",
                    border: `1px solid ${T.lightBorder}`,
                    padding: "8px 12px",
                    borderRadius: 8,
                    textDecoration: "none",
                  }}
                >
                  Let&rsquo;s break it down with Kate
                </Link>
                <Link
                  href={`/kate?prefill=help&provider_id=${lead.provider.id}&provider_name=${encodeURIComponent(providerName)}`}
                  style={{
                    fontSize: 12.5,
                    color: T.lightText,
                    background: "white",
                    border: `1px solid ${T.lightBorder}`,
                    padding: "8px 12px",
                    borderRadius: 8,
                    textDecoration: "none",
                  }}
                >
                  Tell Kate what would help
                </Link>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
