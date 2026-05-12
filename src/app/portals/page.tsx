"use client";

/**
 * /portals — Future integration preview for medical records + cross-
 * link to the insurance preview on /coverage.
 *
 * Everything here is DEMO DATA. The underlying data layer isn't
 * wired to real backends yet. The page shows what the experience
 * will look like once integrations are live, with explicit "future
 * integration preview" framing throughout. Action buttons confirm
 * they're demo-only; no real submissions, no real records pulled.
 */

import { useState } from "react";
import Link from "next/link";
import BrandShell from "../../components/brand/BrandShell";
import UserAvatar from "../../components/qbh/UserAvatar";
import { GlassCard, SectionLabel, AustinHeading } from "../../components/brand/cards";
import { T } from "../../components/brand";
import { FileText, FlaskConical, Stethoscope, Sparkles, ArrowRight, Building2 } from "lucide-react";

function PreviewPill({ label = "Demo data · Future integration preview" }: { label?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        background: "rgba(22,119,255,0.10)",
        color: T.electric,
        border: "1px solid rgba(22,119,255,0.20)",
      }}
    >
      {label}
    </span>
  );
}

function DemoNoticeFooter() {
  return (
    <div
      style={{
        marginTop: 24,
        padding: "10px 14px",
        background: "#F8F9FB",
        border: `1px solid ${T.lightBorder}`,
        borderRadius: 10,
        fontSize: 12,
        color: T.lightMuted,
        lineHeight: 1.5,
      }}
    >
      This demo uses sample data to preview the intended experience once integrations are live.
      Records and insurance data shown here are illustrative only. The underlying integrations are not yet active.
    </div>
  );
}

/* ── Demo data ── */

type DemoRecord = {
  id: string;
  type: "lab" | "visit_summary" | "medication_list";
  title: string;
  source: string;
  date: string;
  status: "added" | "needs_review" | "follow_up_pending";
};

const DEMO_RECORDS: DemoRecord[] = [
  {
    id: "rec-1",
    type: "lab",
    title: "Ferritin",
    source: "Quest Diagnostics",
    date: "April 18, 2026",
    status: "needs_review",
  },
  {
    id: "rec-2",
    type: "lab",
    title: "TSH",
    source: "Quest Diagnostics",
    date: "April 18, 2026",
    status: "added",
  },
  {
    id: "rec-3",
    type: "visit_summary",
    title: "Annual physical",
    source: "Primary Care",
    date: "March 22, 2026",
    status: "added",
  },
  {
    id: "rec-4",
    type: "medication_list",
    title: "Medication list",
    source: "Primary Care",
    date: "Updated March 22, 2026",
    status: "added",
  },
  {
    id: "rec-5",
    type: "visit_summary",
    title: "Dermatology visit summary",
    source: "Coastal Dermatology",
    date: "April 20, 2026",
    status: "follow_up_pending",
  },
];

function recordIcon(type: DemoRecord["type"]) {
  if (type === "lab") return <FlaskConical size={16} color={T.electric} />;
  if (type === "visit_summary") return <Stethoscope size={16} color={T.electric} />;
  return <FileText size={16} color={T.electric} />;
}

function statusPill(status: DemoRecord["status"]) {
  const map = {
    added: { label: "Added", bg: "rgba(39,196,107,0.14)", fg: "#27C46B" },
    needs_review: { label: "Needs review", bg: "rgba(224,138,31,0.14)", fg: "#E08A1F" },
    follow_up_pending: { label: "Follow-up pending", bg: "rgba(224,138,31,0.14)", fg: "#E08A1F" },
  } as const;
  const s = map[status];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export default function PortalsPage() {
  const [showRecordsPreview, setShowRecordsPreview] = useState(false);
  const [sharePacketOpen, setSharePacketOpen] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  function demoAction(label: string) {
    setActionToast(`${label} — demo only. This action will be supported once integrations are live.`);
    setTimeout(() => setActionToast(null), 4000);
  }

  return (
    <BrandShell topRight={<UserAvatar />}>
      <div style={{ paddingTop: 8 }}>
        <div style={{ marginBottom: 6 }}>
          <PreviewPill />
        </div>
        <AustinHeading size={32}>Connect your medical records.</AustinHeading>
        <p style={{ fontSize: 15, color: T.lightMuted, lineHeight: 1.55, marginTop: 12 }}>
          QBH is designed to securely connect your portals and health systems so Kate can bring
          labs, visit summaries, medications, conditions, providers, and care history into one
          organized view.
        </p>

        {/* Screen 1 — single integration card (records only). The
            insurance side lives on /coverage. Cross-link below. */}
        <div style={{ marginTop: 24 }}>
          <GlassCard padding={20}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(22,119,255,0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Stethoscope size={22} color={T.electric} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    color: T.lightMuted,
                    marginBottom: 4,
                  }}
                >
                  Future integration preview
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.lightText, marginBottom: 6 }}>
                  Medical Records
                </div>
                <p style={{ fontSize: 14, color: T.lightMuted, lineHeight: 1.5, margin: 0 }}>
                  Connect portals and health systems to bring labs, visit summaries, medications,
                  conditions, providers, and care history into QBH.
                </p>
                <div style={{ marginTop: 10 }}>
                  <PreviewPill label="Demo data active" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecordsPreview(true)}
                  style={{
                    marginTop: 14,
                    padding: "10px 16px",
                    background: T.electric,
                    color: T.white,
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Preview connected records <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Screen 2 — Connected Records Preview */}
        {showRecordsPreview && (
          <div style={{ marginTop: 32 }} id="records-preview">
            <div style={{ marginBottom: 6 }}>
              <PreviewPill />
            </div>
            <AustinHeading size={28}>Medical records organized by Kate.</AustinHeading>
            <p style={{ fontSize: 14.5, color: T.lightMuted, lineHeight: 1.55, marginTop: 10 }}>
              Once this integration is live, QBH will bring records from connected portals into
              one organized view.
            </p>

            <SectionLabel style={{ marginTop: 24, marginBottom: 10 }}>Recent records</SectionLabel>
            <GlassCard padding={0} radius={16}>
              <div>
                {DEMO_RECORDS.map((r, idx) => (
                  <div
                    key={r.id}
                    style={{
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      borderBottom: idx < DEMO_RECORDS.length - 1 ? `1px solid ${T.lightBorder}` : "none",
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>{recordIcon(r.type)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.lightText }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: T.lightMuted, marginTop: 2 }}>
                        {r.source} · {r.date}
                      </div>
                    </div>
                    {statusPill(r.status)}
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Kate insight card */}
            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: "rgba(22,119,255,0.06)",
                border: `1px solid rgba(22,119,255,0.18)`,
                borderRadius: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <Sparkles size={18} color={T.electric} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.lightText, marginBottom: 6 }}>
                    Kate found a possible follow-up
                  </div>
                  <p style={{ fontSize: 13.5, color: T.lightText, lineHeight: 1.55, margin: 0 }}>
                    Your ferritin result was marked low. Kate found that the lab was ordered by your
                    OB-GYN, but no follow-up appointment is currently listed in the demo data.
                  </p>
                  <button
                    type="button"
                    onClick={() => demoAction("Draft a follow-up note")}
                    style={{
                      marginTop: 10,
                      padding: "8px 14px",
                      background: T.electric,
                      color: T.white,
                      border: "none",
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Draft a follow-up note
                  </button>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {[
                { label: "Prepare a records packet", primary: true },
                { label: "Draft a follow-up note" },
                { label: "Add follow-up reminder" },
                { label: "Mark as resolved" },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => {
                    if (b.label === "Prepare a records packet") setSharePacketOpen(true);
                    else demoAction(b.label);
                  }}
                  style={{
                    padding: "10px 14px",
                    background: b.primary ? T.electric : "white",
                    color: b.primary ? T.white : T.lightText,
                    border: `1px solid ${b.primary ? T.electric : T.lightBorder}`,
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 12, color: T.lightMuted, lineHeight: 1.5, marginTop: 14 }}>
              Kate can prepare, organize, and draft next steps. <strong>User review is required before anything is sent.</strong> Not medical advice — confirm with your provider.
            </p>
          </div>
        )}

        {/* Screen 3 — Record sharing preview (modal-like inline panel) */}
        {sharePacketOpen && (
          <div style={{ marginTop: 24 }}>
            <GlassCard padding={20}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <PreviewPill />
                <button
                  type="button"
                  onClick={() => setSharePacketOpen(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: T.lightMuted,
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                >
                  ×
                </button>
              </div>
              <AustinHeading size={24}>Prepare a records packet.</AustinHeading>

              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  background: "#F8F9FB",
                  border: `1px solid ${T.lightBorder}`,
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: T.lightMuted, marginBottom: 6 }}>
                  Your request
                </div>
                <div style={{ fontSize: 14, color: T.lightText, lineHeight: 1.5, fontStyle: "italic" }}>
                  &ldquo;Pull together my recent thyroid labs and annual physical summary so I can bring them to my endocrinologist.&rdquo;
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.lightText, marginBottom: 10 }}>
                  Kate found the relevant records.
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    fontSize: 13.5,
                    color: T.lightText,
                    lineHeight: 1.7,
                  }}
                >
                  <li>TSH lab result — April 18, 2026</li>
                  <li>Free T4 lab result — April 18, 2026</li>
                  <li>Annual physical note — March 22, 2026</li>
                  <li>Current medication list</li>
                  <li>Insurance card</li>
                </ul>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: "rgba(22,119,255,0.06)",
                  border: `1px solid rgba(22,119,255,0.18)`,
                  borderRadius: 10,
                  fontSize: 13,
                  color: T.lightText,
                }}
              >
                <strong>Suggested packet name:</strong> Thyroid follow-up packet for Dr. Patel
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {["Preview packet", "Download PDF", "Add follow-up reminder"].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => demoAction(label)}
                    style={{
                      padding: "10px 14px",
                      background: i === 0 ? T.electric : "white",
                      color: i === 0 ? T.white : T.lightText,
                      border: `1px solid ${i === 0 ? T.electric : T.lightBorder}`,
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      gridColumn: i === 2 ? "1 / -1" : "auto",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p style={{ fontSize: 12, color: T.lightMuted, lineHeight: 1.5, marginTop: 14 }}>
                QBH helps you organize a records packet you can bring to your provider — preview it, download a PDF, or save for later.
                <strong> You decide how and when to share it.</strong>
              </p>
            </GlassCard>
          </div>
        )}

        {/* Screen 6 — Records-side capabilities. The matching insurance
            capabilities live on /coverage. */}
        <div style={{ marginTop: 32 }}>
          <SectionLabel style={{ marginBottom: 12 }}>What this integration unlocks</SectionLabel>
          <GlassCard padding={18}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Stethoscope size={18} color={T.electric} />
              <div style={{ fontSize: 13, fontWeight: 700, color: T.lightText }}>
                Connected medical records
              </div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: T.lightMuted, lineHeight: 1.7 }}>
              <li>Pull records from connected portals</li>
              <li>Organize labs, medications, visit summaries, providers, and care history</li>
              <li>Help users prepare records to bring to their provider</li>
              <li>Help Kate identify open loops and follow-ups</li>
            </ul>
          </GlassCard>

          <p
            style={{
              marginTop: 18,
              padding: "12px 14px",
              background: "rgba(22,119,255,0.06)",
              border: "1px solid rgba(22,119,255,0.18)",
              borderRadius: 10,
              fontSize: 13,
              color: T.lightText,
              lineHeight: 1.55,
            }}
          >
            <strong>Once live, this provides the data foundation.</strong> QBH turns that data into
            organized, user-friendly next steps. Insurance and claims previews live on the{" "}
            <Link href="/coverage" style={{ color: T.electric, fontWeight: 700, textDecoration: "none" }}>
              Coverage page →
            </Link>
          </p>
        </div>

        <DemoNoticeFooter />

        {/* Toast for demo-only actions */}
        {actionToast && (
          <div
            role="status"
            style={{
              position: "fixed",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "10px 16px",
              background: T.lightText,
              color: T.white,
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              boxShadow: "0 8px 24px rgba(7,24,50,0.18)",
              zIndex: 50,
              maxWidth: 360,
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            <Building2 size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            {actionToast}
          </div>
        )}
      </div>
    </BrandShell>
  );
}
