/**
 * /caregiver/[token] — public view-only page for someone the user
 * has invited to an appointment. No auth required (the share_token
 * is the auth). Server-rendered so the link works even before any
 * client JS loads.
 *
 * Shows: who they're caring for, when/where the appointment is,
 * which provider, the asks the user flagged (ride / bring / music /
 * timing / notes), and a contact-the-user fallback. No PHI beyond
 * what the user opted to share.
 */

import { supabaseAdmin } from "../../../lib/supabase-server";
import { notFound } from "next/navigation";

type AsksShape = {
  needs_ride?: boolean;
  bring?: string[];
  music?: string;
  timing_note?: string;
};

export default async function CaregiverViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token) notFound();

  const { data: caregiver } = await supabaseAdmin
    .from("appointment_caregivers")
    .select(
      "id, caregiver_name, asks, notes, calendar_event_id, schedule_attempt_id, provider_id, app_user_id, viewed_at"
    )
    .eq("share_token", token)
    .maybeSingle();
  if (!caregiver) notFound();

  // Mark first-view timestamp (best-effort, non-blocking).
  if (!caregiver.viewed_at) {
    await supabaseAdmin
      .from("appointment_caregivers")
      .update({ viewed_at: new Date().toISOString(), status: "viewed" })
      .eq("id", caregiver.id);
  }

  // Fetch the user's name (the person the caregiver is helping).
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile, auth_user_id")
    .eq("id", caregiver.app_user_id)
    .maybeSingle();
  const profile = (appUser?.patient_profile ?? {}) as Record<string, unknown>;
  const patientName =
    (profile.full_name as string) ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "Your friend";

  // Provider details (optional — the user may have skipped attaching one)
  let providerName: string | null = null;
  let providerAddress: string | null = null;
  let providerPhone: string | null = null;
  if (caregiver.provider_id) {
    const { data: p } = await supabaseAdmin
      .from("providers")
      .select("name, address, phone_number, doctor_name")
      .eq("id", caregiver.provider_id)
      .maybeSingle();
    if (p) {
      providerName = p.doctor_name || p.name;
      providerAddress = p.address;
      providerPhone = p.phone_number;
    }
  }

  // Appointment time (calendar event preferred; fall back to attempt)
  let appointmentTime: string | null = null;
  let appointmentLocation: string | null = null;
  if (caregiver.calendar_event_id) {
    const { data: ev } = await supabaseAdmin
      .from("calendar_events")
      .select("start_at, location, title")
      .eq("id", caregiver.calendar_event_id)
      .maybeSingle();
    if (ev) {
      appointmentTime = ev.start_at;
      appointmentLocation = ev.location;
    }
  }

  const asks = (caregiver.asks ?? {}) as AsksShape;
  const askLines: Array<{ icon: string; label: string }> = [];
  if (asks.needs_ride) askLines.push({ icon: "🚗", label: `${patientName} needs a ride to and from this appointment` });
  if (Array.isArray(asks.bring) && asks.bring.length > 0) {
    askLines.push({ icon: "🎒", label: `Please bring: ${asks.bring.join(", ")}` });
  }
  if (asks.music) askLines.push({ icon: "🎵", label: `Music for the ride: ${asks.music}` });
  if (asks.timing_note) askLines.push({ icon: "⏱️", label: asks.timing_note });

  const formattedTime = appointmentTime
    ? new Date(appointmentTime).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FAF8F4",
        color: "#071832",
        padding: "48px 20px",
      }}
    >
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#1677FF",
            marginBottom: 12,
          }}
        >
          Quarterback Health · Caregiver view
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: -0.4,
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          Hi {caregiver.caregiver_name}, {patientName} could use your help.
        </h1>

        {(formattedTime || providerName || appointmentLocation) && (
          <div
            style={{
              marginTop: 24,
              padding: 20,
              background: "#FFFFFF",
              border: "1px solid #E5EAF2",
              borderRadius: 16,
              boxShadow: "0 4px 18px rgba(7,24,50,0.06)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#4F5F73", marginBottom: 10 }}>
              The appointment
            </div>
            {formattedTime && (
              <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 6 }}>{formattedTime}</div>
            )}
            {providerName && (
              <div style={{ fontSize: 14, color: "#071832" }}>{providerName}</div>
            )}
            {appointmentLocation && (
              <div style={{ fontSize: 13, color: "#4F5F73", marginTop: 4 }}>{appointmentLocation}</div>
            )}
            {providerAddress && !appointmentLocation && (
              <div style={{ fontSize: 13, color: "#4F5F73", marginTop: 4 }}>{providerAddress}</div>
            )}
            {providerPhone && (
              <div style={{ fontSize: 13, color: "#4F5F73", marginTop: 4 }}>{providerPhone}</div>
            )}
          </div>
        )}

        {askLines.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#4F5F73", marginBottom: 10 }}>
              How you can help
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {askLines.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 16px",
                    background: "#FFFFFF",
                    border: "1px solid #E5EAF2",
                    borderRadius: 14,
                    fontSize: 14.5,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1.2 }}>{a.icon}</span>
                  <span style={{ flex: 1, lineHeight: 1.5 }}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {caregiver.notes && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#4F5F73", marginBottom: 10 }}>
              Note from {patientName}
            </div>
            <div
              style={{
                padding: 16,
                background: "#FFFFFF",
                border: "1px solid #E5EAF2",
                borderRadius: 14,
                fontSize: 14.5,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {caregiver.notes}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: "1px dashed #E5EAF2",
            fontSize: 12.5,
            color: "#4F5F73",
            lineHeight: 1.6,
          }}
        >
          This page was shared with you by {patientName} through{" "}
          <a href="/" style={{ color: "#1677FF", textDecoration: "none" }}>
            Quarterback Health
          </a>
          . Only this single appointment is visible — no other health information is shared.
        </div>
      </div>
    </main>
  );
}
