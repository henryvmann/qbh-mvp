"use client";

/**
 * Personalized "where do you want to start?" card shown on a new
 * user's first dashboard visit. Generates 3 concrete actions drawn
 * from the user's actual data (overdue providers, missing intake,
 * etc.) so capabilities show up as real next steps, not a feature
 * list. Dismissible; once dismissed, never returns.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { T } from "../brand";
import { Phone, ClipboardList, Pill, MessageSquare, Stethoscope, X, Calendar } from "lucide-react";

const DISMISSED_KEY = "qbh_dashboard_welcome_dismissed";

type StarterAction = {
  id: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  hint: string;
  href: string;
  cta: string;
};

type DashboardSnapshot = {
  provider: { id: string; name: string; provider_type?: string | null };
  followUpNeeded?: boolean;
  futureConfirmedEvent?: { start_at: string } | null;
  lastVisitDate?: string | null;
  booking_state?: { status?: string };
};

function monthsSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (!then) return 0;
  return Math.round((Date.now() - then) / (1000 * 60 * 60 * 24 * 30));
}

export default function DashboardWelcomeCard() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [snapshots, setSnapshots] = useState<DashboardSnapshot[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(DISMISSED_KEY);
    setDismissed(v === "1");
  }, []);

  useEffect(() => {
    if (dismissed) return;
    Promise.all([
      apiFetch("/api/dashboard/data").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch("/api/patient-profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([dash, prof]) => {
      if (dash?.ok && Array.isArray(dash.snapshots)) setSnapshots(dash.snapshots);
      if (prof?.profile) setProfile(prof.profile);
      setLoaded(true);
    });
  }, [dismissed]);

  const actions: StarterAction[] = useMemo(() => {
    if (!loaded) return [];

    const out: StarterAction[] = [];
    const doctors = snapshots.filter((s) => s.provider.provider_type !== "pharmacy");

    // 1. Most-overdue provider — gives "wow, Kate noticed" right away
    const overdue = doctors
      .filter(
        (s) =>
          s.followUpNeeded &&
          s.booking_state?.status !== "BOOKED" &&
          s.booking_state?.status !== "IN_PROGRESS" &&
          s.lastVisitDate
      )
      .map((s) => ({ s, months: monthsSince(s.lastVisitDate!) }))
      .filter((x) => x.months >= 3)
      .sort((a, b) => b.months - a.months);
    if (overdue.length > 0) {
      const lead = overdue[0];
      out.push({
        id: "book-overdue",
        icon: <Phone size={16} color={T.electric} />,
        title: (
          <>
            Book <strong>{lead.s.provider.name}</strong>
          </>
        ),
        hint: `It's been about ${lead.months} months. Kate can call.`,
        href: `/providers/${lead.s.provider.id}?action=book`,
        cta: "Book it",
      });
    } else if (doctors.length > 0) {
      // No overdue but has providers — surface "ask Kate to prep next visit"
      const upcoming = doctors.find((s) => s.futureConfirmedEvent);
      if (upcoming) {
        out.push({
          id: "prep-visit",
          icon: <Stethoscope size={16} color={T.electric} />,
          title: <>Prep for your visit with <strong>{upcoming.provider.name}</strong></>,
          hint: "Kate will pull what you need to bring.",
          href: "/kate?prefill=prep",
          cta: "Get prep",
        });
      }
    } else {
      // No providers at all yet
      out.push({
        id: "add-provider",
        icon: <Stethoscope size={16} color={T.electric} />,
        title: <>Add your first provider</>,
        hint: "Search by name and Kate takes it from there.",
        href: "/providers?add=true",
        cta: "Add",
      });
    }

    // 2. Intake — only if not started or barely started
    const intake = (profile?.intake as { answers?: Record<string, unknown>; completed_at?: string | null } | undefined) || null;
    const answeredCount = intake?.answers ? Object.keys(intake.answers).length : 0;
    if (!intake?.completed_at && answeredCount < 5) {
      out.push({
        id: "intake",
        icon: <ClipboardList size={16} color={T.electric} />,
        title: <>Tell me about you</>,
        hint: "A few short questions. Makes Kate smarter.",
        href: "/intake",
        cta: "Open",
      });
    }

    // 3. Medications — if none on file
    const medsRaw = profile?.current_medications;
    const hasMeds = typeof medsRaw === "string" ? medsRaw.trim().length > 0 : Array.isArray(medsRaw) ? medsRaw.length > 0 : false;
    if (!hasMeds) {
      out.push({
        id: "meds",
        icon: <Pill size={16} color={T.electric} />,
        title: <>Add your prescriptions</>,
        hint: "Kate can call your pharmacy for refills.",
        href: "/medications",
        cta: "Add",
      });
    }

    // 4. Calendar — if not connected
    // (We don't reliably know calendar status from snapshot data; pull from
    // hasGoogleCalendarConnection if it surfaces, otherwise skip.)
    // For now, leave as a fallback if we still have room.
    if (out.length < 3) {
      out.push({
        id: "calendar",
        icon: <Calendar size={16} color={T.electric} />,
        title: <>Connect your calendar</>,
        hint: "So Kate doesn't double-book you.",
        href: "/account",
        cta: "Connect",
      });
    }

    // Always last: ask Kate anything (catch-all)
    out.push({
      id: "ask-kate",
      icon: <MessageSquare size={16} color={T.electric} />,
      title: <>Ask me anything</>,
      hint: "Open chat with Kate.",
      href: "/kate",
      cta: "Open",
    });

    // Cap at 4 total so it doesn't read as a feature list.
    return out.slice(0, 4);
  }, [loaded, snapshots, profile]);

  function handleDismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    }
    setDismissed(true);
  }

  if (dismissed || dismissed === null) return null;
  if (!loaded) return null;
  if (actions.length === 0) return null;

  return (
    <div
      style={{
        position: "relative",
        background: "white",
        border: `1px solid ${T.lightBorder}`,
        borderRadius: 16,
        padding: 16,
        marginBottom: 18,
        boxShadow: "0 2px 8px rgba(7,24,50,0.04)",
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "transparent",
          border: "none",
          color: T.lightMuted,
          cursor: "pointer",
          padding: 4,
          lineHeight: 0,
        }}
      >
        <X size={14} />
      </button>

      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: T.electric,
          marginBottom: 4,
        }}
      >
        Where do you want to start?
      </div>
      <p style={{ fontSize: 13, color: T.lightMuted, lineHeight: 1.4, marginBottom: 14 }}>
        Tap any of these — or none. I&rsquo;m here whenever you&rsquo;re ready.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {actions.map((a) => (
          <Link
            key={a.id}
            href={a.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              background: "#F8F9FB",
              border: `1px solid ${T.lightBorder}`,
              borderRadius: 12,
              textDecoration: "none",
              color: T.lightText,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "rgba(22,119,255,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {a.icon}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{a.title}</span>
              <span style={{ display: "block", fontSize: 12, color: T.lightMuted, marginTop: 1 }}>
                {a.hint}
              </span>
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.electric,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {a.cta} →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
