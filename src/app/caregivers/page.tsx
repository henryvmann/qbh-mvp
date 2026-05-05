"use client";

/**
 * /caregivers — hub for the people who help the user at appointments.
 *
 * What lives here:
 *   1. Explanation of how caregivers work in QBH (view-only link, asks
 *      checklist, no account needed)
 *   2. Active invites — caregivers attached to upcoming/pending visits,
 *      with one-click copy + resend
 *   3. The "Rolodex" — unique people from past invites, ready to reuse
 *      on the next appointment
 *
 * The actual per-appointment add UI lives inline on /calendar-view.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import { T } from "../../components/brand";
import { UserPlus, Copy, Calendar, Mail, Eye, Check, Loader2 } from "lucide-react";

type Caregiver = {
  id: string;
  caregiver_name: string;
  caregiver_email: string | null;
  caregiver_phone: string | null;
  calendar_event_id: string | null;
  schedule_attempt_id: number | null;
  provider_id: string | null;
  asks: Record<string, unknown>;
  notes: string | null;
  share_token: string;
  invited_at: string;
  viewed_at: string | null;
  status: string;
};

type EventInfo = {
  startAt: string;
  providerId: string;
  providerName: string;
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CaregiversPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [events, setEvents] = useState<Record<string, EventInfo>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await apiFetch("/api/appointment-caregivers");
    if (r.status === 401) {
      router.push("/login");
      return;
    }
    const j = await r.json().catch(() => ({}));
    if (j?.ok) {
      const list: Caregiver[] = j.caregivers ?? [];
      setCaregivers(list);

      // Hydrate appointment context for each row. Best-effort — if visits/data
      // fails we just render rows without the time/provider line.
      const visitsRes = await apiFetch(`/api/visits/data`).then((r) => r.json()).catch(() => null);
      const upcoming: Array<{
        eventId: string;
        startAt: string;
        providerId: string;
        providerName: string;
      }> = visitsRes?.upcoming ?? [];
      const map: Record<string, EventInfo> = {};
      for (const ev of upcoming) {
        map[ev.eventId] = {
          startAt: ev.startAt,
          providerId: ev.providerId,
          providerName: ev.providerName,
        };
      }
      setEvents(map);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function shareUrlFor(c: Caregiver): string {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/caregiver/${c.share_token}`;
  }

  async function copyShare(c: Caregiver) {
    const url = shareUrlFor(c);
    await navigator.clipboard.writeText(url);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  async function resendInvite(c: Caregiver) {
    if (!c.caregiver_email) return;
    // Re-issue a POST against the same appointment. The backend
    // creates a fresh row + queues a new email so the resend is
    // auditable separately from the original invite.
    await apiFetch("/api/appointment-caregivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caregiver_name: c.caregiver_name,
        caregiver_email: c.caregiver_email,
        caregiver_phone: c.caregiver_phone,
        calendar_event_id: c.calendar_event_id,
        schedule_attempt_id: c.schedule_attempt_id,
        provider_id: c.provider_id,
        asks: c.asks,
        notes: c.notes,
      }),
    });
    await refresh();
  }

  // Rolodex: unique people from past invites, ranked by recency.
  const rolodex = (() => {
    const seen = new Map<
      string,
      { name: string; email: string | null; phone: string | null; uses: number; lastInvitedAt: string }
    >();
    for (const c of caregivers) {
      const key = (c.caregiver_email || c.caregiver_phone || c.caregiver_name).toLowerCase();
      const prev = seen.get(key);
      if (prev) {
        prev.uses++;
        if (c.invited_at > prev.lastInvitedAt) prev.lastInvitedAt = c.invited_at;
      } else {
        seen.set(key, {
          name: c.caregiver_name,
          email: c.caregiver_email,
          phone: c.caregiver_phone,
          uses: 1,
          lastInvitedAt: c.invited_at,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.lastInvitedAt < b.lastInvitedAt ? 1 : -1
    );
  })();

  return (
    <PageShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 80 }}>
        <header>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: T.lightText, marginBottom: 8 }}>
            Caregivers
          </h1>
          <p style={{ color: T.lightMuted, fontSize: 16, lineHeight: 1.5, maxWidth: 540 }}>
            People who help you at appointments — a spouse, a parent, a friend.
            Loop them in for a single visit and they get a view-only page with
            the time, the place, and what would help. No login. No app.
          </p>
        </header>

        <Section title="How it works">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <Step n={1} title="Add to a visit" body="Open an upcoming appointment and tap 'Add a caregiver'." />
            <Step n={2} title="Pick what would help" body="A ride? Bringing something? Music? Whatever's useful." />
            <Step n={3} title="Kate sends the link" body="kate@getquarterback.com emails them a view-only page. Or copy it yourself." />
            <Step n={4} title="They show up ready" body="The link updates if anything changes. You'll see when they open it." />
          </div>
        </Section>

        <Section
          title="Active invites"
          right={
            <Link
              href="/calendar-view"
              style={{
                fontSize: 13,
                color: T.electric,
                textDecoration: "none",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <UserPlus size={14} />
              Add to a visit
            </Link>
          }
        >
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.lightMuted }}>
              <Loader2 size={16} className="animate-spin" />
              Loading…
            </div>
          ) : caregivers.length === 0 ? (
            <Empty
              icon={<UserPlus size={28} color={T.lightMuted} />}
              title="No active caregiver invites"
              body="When you add a caregiver to an appointment, they'll show up here."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {caregivers.map((c) => {
                const ev = c.calendar_event_id ? events[c.calendar_event_id] : null;
                return (
                  <div
                    key={c.id}
                    style={{
                      background: "rgba(255,255,255,0.85)",
                      border: `1px solid ${T.lightBorder}`,
                      borderRadius: 14,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: T.lightText, fontSize: 16 }}>
                        {c.caregiver_name}
                      </div>
                      <div style={{ fontSize: 12, color: T.lightMuted }}>
                        invited {fmtRelative(c.invited_at)}
                      </div>
                    </div>
                    {c.caregiver_email && (
                      <div
                        style={{
                          fontSize: 13,
                          color: T.lightMuted,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Mail size={12} />
                        {c.caregiver_email}
                      </div>
                    )}
                    {ev && (
                      <div
                        style={{
                          fontSize: 13,
                          color: T.lightMuted,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Calendar size={12} />
                        {fmtWhen(ev.startAt)} · {ev.providerName}
                      </div>
                    )}
                    {c.viewed_at ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: T.green,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Eye size={12} />
                        Viewed {fmtRelative(c.viewed_at)}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 12,
                          color: T.lightMuted,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Eye size={12} />
                        Not opened yet
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      <button onClick={() => copyShare(c)} style={btnSecondary}>
                        {copiedId === c.id ? <Check size={14} /> : <Copy size={14} />}
                        {copiedId === c.id ? "Copied" : "Copy link"}
                      </button>
                      {c.caregiver_email && (
                        <button onClick={() => resendInvite(c)} style={btnSecondary}>
                          <Mail size={14} />
                          Resend email
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {rolodex.length > 0 && (
          <Section title="Your people">
            <p style={{ color: T.lightMuted, fontSize: 14, marginBottom: 12 }}>
              Folks you've looped in before. When you add a caregiver to your
              next appointment, you can pick from this list instead of retyping.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {rolodex.map((p) => (
                <div
                  key={`${p.name}-${p.email ?? p.phone ?? "n"}`}
                  style={{
                    background: "rgba(255,255,255,0.85)",
                    border: `1px solid ${T.lightBorder}`,
                    borderRadius: 14,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ fontWeight: 600, color: T.lightText }}>{p.name}</div>
                  {p.email && <div style={{ fontSize: 13, color: T.lightMuted }}>{p.email}</div>}
                  {!p.email && p.phone && (
                    <div style={{ fontSize: 13, color: T.lightMuted }}>{p.phone}</div>
                  )}
                  <div style={{ fontSize: 12, color: T.lightMuted, marginTop: 4 }}>
                    {p.uses} {p.uses === 1 ? "appointment" : "appointments"} · last{" "}
                    {fmtRelative(p.lastInvitedAt)}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </PageShell>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.lightText, margin: 0 }}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div
      style={{
        background: "rgba(22,119,255,0.06)",
        border: `1px solid ${T.lightBorder}`,
        borderRadius: 14,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          background: T.electric,
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {n}
      </div>
      <div style={{ fontWeight: 600, color: T.lightText, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.lightMuted, lineHeight: 1.45 }}>{body}</div>
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.7)",
        border: `1px dashed ${T.lightBorder}`,
        borderRadius: 14,
        padding: 24,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon}
      <div style={{ fontWeight: 600, color: T.lightText }}>{title}</div>
      <div style={{ fontSize: 14, color: T.lightMuted, maxWidth: 360 }}>{body}</div>
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  background: "rgba(22,119,255,0.08)",
  color: T.electric,
  border: `1px solid ${T.lightBorder}`,
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
