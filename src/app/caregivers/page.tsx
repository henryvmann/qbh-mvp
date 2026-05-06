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
import { UserPlus, Copy, Calendar, Mail, Eye, Check, Loader2, Plus, Trash2, Pencil, Phone } from "lucide-react";

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

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  notes: string | null;
  created_at: string;
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<{
    name: string;
    email: string;
    phone: string;
    relationship: string;
    notes: string;
  }>({ name: "", email: "", phone: "", relationship: "", notes: "" });
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

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

    // Load saved contacts (the rolodex). Independent fetch so failures
    // here don't gate the active-invites UI.
    try {
      const cr = await apiFetch("/api/caregiver-contacts");
      const cj = await cr.json().catch(() => ({}));
      if (cj?.ok) setContacts(cj.contacts ?? []);
    } catch {
      // best effort
    }

    setLoading(false);
  }, [router]);

  function resetContactDraft() {
    setContactDraft({ name: "", email: "", phone: "", relationship: "", notes: "" });
    setContactError(null);
  }

  async function saveContact() {
    const name = contactDraft.name.trim();
    if (!name) {
      setContactError("Name required");
      return;
    }
    setContactSaving(true);
    setContactError(null);
    try {
      const isEdit = Boolean(editingContactId);
      const res = await apiFetch("/api/caregiver-contacts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? { id: editingContactId } : {}),
          name,
          email: contactDraft.email.trim() || null,
          phone: contactDraft.phone.trim() || null,
          relationship: contactDraft.relationship.trim() || null,
          notes: contactDraft.notes.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setContactError(j?.error || "Couldn't save");
        return;
      }
      setShowAddContact(false);
      setEditingContactId(null);
      resetContactDraft();
      await refresh();
    } finally {
      setContactSaving(false);
    }
  }

  async function deleteContact(id: string) {
    if (!confirm("Remove this caregiver from your list? Existing invites you've already sent will keep working.")) return;
    await apiFetch(`/api/caregiver-contacts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await refresh();
  }

  function startEditContact(c: Contact) {
    setEditingContactId(c.id);
    setShowAddContact(true);
    setContactDraft({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      relationship: c.relationship ?? "",
      notes: c.notes ?? "",
    });
    setContactError(null);
  }

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

        {/* Saved caregivers — explicit Rolodex. The user can add people
            here without invitations attached. When they later add a
            caregiver to a visit, the per-event picker pulls from this
            list. Past-invite suggestions are still surfaced inline below
            for quick imports. */}
        <Section
          title="Your caregivers"
          right={
            !showAddContact ? (
              <button
                onClick={() => {
                  resetContactDraft();
                  setEditingContactId(null);
                  setShowAddContact(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 13,
                  color: T.electric,
                  textDecoration: "none",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Plus size={14} />
                Add a caregiver
              </button>
            ) : null
          }
        >
          <p style={{ color: T.lightMuted, fontSize: 14, marginBottom: 12 }}>
            Add the people you might want to loop in — partner, parent,
            friend, sibling. They'll show up as quick picks when you attach
            a caregiver to a visit, so you don't have to retype.
          </p>

          {showAddContact && (
            <div
              style={{
                background: "white",
                border: `1px solid ${T.lightBorder}`,
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  placeholder="Name (required)"
                  value={contactDraft.name}
                  onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })}
                  style={contactInputStyle}
                />
                <input
                  placeholder="Relationship (Mom, Spouse, Friend)"
                  value={contactDraft.relationship}
                  onChange={(e) => setContactDraft({ ...contactDraft, relationship: e.target.value })}
                  style={contactInputStyle}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  placeholder="Email (optional)"
                  type="email"
                  value={contactDraft.email}
                  onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })}
                  style={contactInputStyle}
                />
                <input
                  placeholder="Phone (optional)"
                  type="tel"
                  value={contactDraft.phone}
                  onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })}
                  style={contactInputStyle}
                />
              </div>
              <input
                placeholder="Notes (optional) — e.g. drives Wyatt to chemo"
                value={contactDraft.notes}
                onChange={(e) => setContactDraft({ ...contactDraft, notes: e.target.value })}
                style={contactInputStyle}
              />
              {contactError && (
                <div style={{ fontSize: 12, color: T.red }}>{contactError}</div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setShowAddContact(false);
                    setEditingContactId(null);
                    resetContactDraft();
                  }}
                  style={btnSecondary}
                >
                  Cancel
                </button>
                <button
                  onClick={saveContact}
                  disabled={contactSaving}
                  style={{
                    ...btnSecondary,
                    background: T.electric,
                    color: "#fff",
                    opacity: contactSaving ? 0.6 : 1,
                  }}
                >
                  {contactSaving ? "Saving…" : editingContactId ? "Save changes" : "Add"}
                </button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <Empty
              icon={<UserPlus size={28} color={T.lightMuted} />}
              title="No caregivers saved yet"
              body="Add the people you'd want to loop in — they'll be one tap away when you book a visit."
            />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 10,
              }}
            >
              {contacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: "rgba(255,255,255,0.85)",
                    border: `1px solid ${T.lightBorder}`,
                    borderRadius: 14,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 600, color: T.lightText, fontSize: 15 }}>{c.name}</div>
                    {c.relationship && (
                      <div style={{ fontSize: 11, color: T.lightMuted }}>{c.relationship}</div>
                    )}
                  </div>
                  {c.email && (
                    <div style={{ fontSize: 13, color: T.lightMuted, display: "flex", alignItems: "center", gap: 6 }}>
                      <Mail size={12} />
                      {c.email}
                    </div>
                  )}
                  {c.phone && (
                    <div style={{ fontSize: 13, color: T.lightMuted, display: "flex", alignItems: "center", gap: 6 }}>
                      <Phone size={12} />
                      {c.phone}
                    </div>
                  )}
                  {c.notes && (
                    <div style={{ fontSize: 12, color: T.lightMuted, fontStyle: "italic" }}>{c.notes}</div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button onClick={() => startEditContact(c)} style={btnIconStyle}>
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => deleteContact(c.id)} style={btnIconStyle}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

        {/* Past-invite suggestions — surface only contacts NOT already
            saved as a one-tap "Save to your list" affordance. Helps
            users migrate from the implicit-rolodex (pre-table) to the
            explicit one without retyping. */}
        {rolodex.filter((p) => {
          const key = (p.email || p.phone || p.name).toLowerCase();
          return !contacts.some(
            (c) =>
              (c.email && c.email.toLowerCase() === key) ||
              (c.phone && c.phone.toLowerCase() === key) ||
              c.name.toLowerCase() === key
          );
        }).length > 0 && (
          <Section title="From past invites">
            <p style={{ color: T.lightMuted, fontSize: 14, marginBottom: 12 }}>
              People you've looped in before but haven't saved yet. Tap to add
              to your caregivers list.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {rolodex
                .filter((p) => {
                  const key = (p.email || p.phone || p.name).toLowerCase();
                  return !contacts.some(
                    (c) =>
                      (c.email && c.email.toLowerCase() === key) ||
                      (c.phone && c.phone.toLowerCase() === key) ||
                      c.name.toLowerCase() === key
                  );
                })
                .map((p) => (
                  <button
                    key={`${p.name}-${p.email ?? p.phone ?? "n"}`}
                    onClick={async () => {
                      await apiFetch("/api/caregiver-contacts", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: p.name,
                          email: p.email,
                          phone: p.phone,
                        }),
                      });
                      await refresh();
                    }}
                    style={{
                      background: "rgba(255,255,255,0.7)",
                      border: `1px dashed ${T.lightBorder}`,
                      borderRadius: 14,
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: T.lightText }}>{p.name}</div>
                    {p.email && <div style={{ fontSize: 13, color: T.lightMuted }}>{p.email}</div>}
                    {!p.email && p.phone && (
                      <div style={{ fontSize: 13, color: T.lightMuted }}>{p.phone}</div>
                    )}
                    <div style={{ fontSize: 11, color: T.electric, marginTop: 4, fontWeight: 600 }}>
                      + Save to caregivers
                    </div>
                  </button>
                ))}
            </div>
          </Section>
        )}
      </div>
    </PageShell>
  );
}

const contactInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  color: "#071832",
  border: "1px solid #E5EAF2",
  borderRadius: 8,
  outline: "none",
  background: "#F8F9FB",
};

const btnIconStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 9px",
  background: "transparent",
  color: "#4F5F73",
  border: "1px solid #E5EAF2",
  borderRadius: 8,
  fontSize: 11.5,
  fontWeight: 500,
  cursor: "pointer",
};

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
