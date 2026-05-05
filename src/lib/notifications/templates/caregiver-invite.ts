/**
 * Caregiver invite email — sent when a user adds a caregiver with
 * an email address to one of their appointments. The body is rendered
 * once and stored on the notifications row, so future copy changes
 * don't retroactively change what was already sent.
 */

export type CaregiverInviteParams = {
  patientFirstName: string;
  caregiverName: string;
  /** Display string like "Tue, May 12 at 2:30pm". */
  appointmentWhen?: string;
  /** Provider/practice display string. */
  providerLabel?: string;
  /** Free-form asks summary, already humanized — e.g. "needs a ride; bring a magazine". */
  asksSummary?: string;
  /** Notes the user typed for the caregiver. */
  notes?: string;
  /** The full https://… link that opens the view-only caregiver page. */
  shareUrl: string;
};

export function renderCaregiverInvite(p: CaregiverInviteParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = p.appointmentWhen
    ? `${p.patientFirstName} asked me to loop you in on an appointment ${p.appointmentWhen}`
    : `${p.patientFirstName} asked me to loop you in on an appointment`;

  const lines: string[] = [];
  lines.push(`Hi ${escape(p.caregiverName)},`);
  lines.push("");
  lines.push(
    `${escape(p.patientFirstName)} asked me to share an appointment with you. I'm Kate — I help ${escape(p.patientFirstName)} keep their healthcare straight at Quarterback Health.`
  );
  if (p.appointmentWhen || p.providerLabel) {
    lines.push("");
    lines.push("<strong>The appointment</strong>");
    if (p.appointmentWhen) lines.push(escape(p.appointmentWhen));
    if (p.providerLabel) lines.push(escape(p.providerLabel));
  }
  if (p.asksSummary) {
    lines.push("");
    lines.push("<strong>What would help</strong>");
    lines.push(escape(p.asksSummary));
  }
  if (p.notes) {
    lines.push("");
    lines.push("<strong>Notes</strong>");
    lines.push(escape(p.notes));
  }
  lines.push("");
  lines.push(
    `<a href="${escapeAttr(p.shareUrl)}" style="display:inline-block;padding:12px 20px;background:#1677FF;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open the appointment details</a>`
  );
  lines.push("");
  lines.push(
    `This is a view-only link — you don't need an account. If anything changes, the same link will reflect it.`
  );
  lines.push("");
  lines.push(`— Kate`);
  lines.push(`Quarterback Health`);

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#071832;line-height:1.55;max-width:560px;margin:0 auto;padding:24px">
${lines.join("<br>")}
</body></html>`;

  const text = [
    `Hi ${p.caregiverName},`,
    ``,
    `${p.patientFirstName} asked me to share an appointment with you. I'm Kate — I help ${p.patientFirstName} keep their healthcare straight at Quarterback Health.`,
    ...(p.appointmentWhen || p.providerLabel
      ? ["", "The appointment:", p.appointmentWhen ?? "", p.providerLabel ?? ""].filter(Boolean)
      : []),
    ...(p.asksSummary ? ["", "What would help:", p.asksSummary] : []),
    ...(p.notes ? ["", "Notes:", p.notes] : []),
    ``,
    `Open the appointment details: ${p.shareUrl}`,
    ``,
    `This is a view-only link — you don't need an account.`,
    ``,
    `— Kate`,
    `Quarterback Health`,
  ].join("\n");

  return { subject, html, text };
}

export function summarizeAsks(asks: Record<string, unknown> | null | undefined): string {
  if (!asks) return "";
  const parts: string[] = [];
  if (asks.needs_ride) parts.push("needs a ride");
  const bring = Array.isArray(asks.bring) ? asks.bring.filter(Boolean) : [];
  if (bring.length) parts.push(`bring ${bring.join(", ")}`);
  if (typeof asks.music === "string" && asks.music.trim()) parts.push(`music: ${asks.music.trim()}`);
  if (typeof asks.timing_note === "string" && asks.timing_note.trim())
    parts.push(asks.timing_note.trim());
  return parts.join("; ");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escape(s).replace(/"/g, "&quot;");
}
