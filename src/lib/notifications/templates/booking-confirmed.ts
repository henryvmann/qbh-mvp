/**
 * Sent when Kate confirms a booking on a call. Goes to the user
 * (the patient) — not the caregiver. Caregiver linked separately.
 */

export type BookingConfirmedParams = {
  patientFirstName: string;
  appointmentWhen: string;
  providerLabel?: string;
  /** Confirmation number from the office, if Kate captured one. */
  confirmationNumber?: string;
  /** Deep-link to the visit detail page. */
  visitUrl: string;
  /** Deep-link to add a caregiver for this visit. */
  addCaregiverUrl: string;
};

export function renderBookingConfirmed(p: BookingConfirmedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `You're booked — ${p.appointmentWhen}`;

  const lines: string[] = [];
  lines.push(`Hi ${escape(p.patientFirstName)},`);
  lines.push("");
  lines.push("I just confirmed your appointment.");
  lines.push("");
  lines.push("<strong>When</strong>");
  lines.push(escape(p.appointmentWhen));
  if (p.providerLabel) {
    lines.push("");
    lines.push("<strong>Who</strong>");
    lines.push(escape(p.providerLabel));
  }
  if (p.confirmationNumber) {
    lines.push("");
    lines.push("<strong>Confirmation</strong>");
    lines.push(escape(p.confirmationNumber));
  }
  lines.push("");
  lines.push(
    `<a href="${escapeAttr(p.visitUrl)}" style="display:inline-block;padding:12px 20px;background:#1677FF;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open the appointment</a>`
  );
  lines.push("");
  lines.push(
    `Want someone to know about this — a spouse, a parent, a friend? <a href="${escapeAttr(p.addCaregiverUrl)}" style="color:#1677FF">Loop them in</a> with a view-only link. Takes a minute.`
  );
  lines.push("");
  lines.push("I'll send a reminder before the visit.");
  lines.push("");
  lines.push(`— Kate`);
  lines.push(`Quarterback Health`);

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#071832;line-height:1.55;max-width:560px;margin:0 auto;padding:24px">
${lines.join("<br>")}
</body></html>`;

  const text = [
    `Hi ${p.patientFirstName},`,
    ``,
    `I just confirmed your appointment.`,
    ``,
    `When: ${p.appointmentWhen}`,
    p.providerLabel ? `Who: ${p.providerLabel}` : "",
    p.confirmationNumber ? `Confirmation: ${p.confirmationNumber}` : "",
    ``,
    `Open the appointment: ${p.visitUrl}`,
    ``,
    `Want someone to know about this? Loop them in with a view-only link: ${p.addCaregiverUrl}`,
    ``,
    `I'll send a reminder before the visit.`,
    ``,
    `— Kate`,
    `Quarterback Health`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escape(s).replace(/"/g, "&quot;");
}
