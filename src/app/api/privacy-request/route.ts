export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "../../../lib/aws/ses";

const ADMIN_EMAIL = "admin@getquarterback.com";

type RequestKind = "access" | "delete" | "correct" | "portability" | "appeal" | "other";
const VALID_KINDS: RequestKind[] = ["access", "delete", "correct", "portability", "appeal", "other"];

/**
 * Privacy-rights request intake (Privacy Policy "Exercising Your
 * Rights" section). Accepts a name/email/state/request-kind/details
 * payload, emails admin@getquarterback.com so it lands in the
 * monitored inbox, and returns ok.
 *
 * No auth required — users invoking their right to delete may not
 * have an account, or may not be able to log into one. We rate-limit
 * minimally via the inbound payload shape; spam is acceptable
 * collateral compared to blocking a real request.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim().slice(0, 200);
  const email = String(body?.email || "").trim().toLowerCase().slice(0, 320);
  const state = String(body?.state || "").trim().slice(0, 80);
  const kind = String(body?.kind || "").trim() as RequestKind;
  const details = String(body?.details || "").trim().slice(0, 5000);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required so we can respond." }, { status: 400 });
  }
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ ok: false, error: "Please pick a request type." }, { status: 400 });
  }
  if (!details || details.length < 10) {
    return NextResponse.json({ ok: false, error: "Please add a short description so we can act on the request." }, { status: 400 });
  }

  const kindLabel = {
    access: "Access (copy of my data)",
    delete: "Delete my data",
    correct: "Correct my data",
    portability: "Portable copy of my data",
    appeal: "Appeal a previous denial",
    other: "Other",
  }[kind];

  const subject = `Privacy request — ${kindLabel} — ${email}`;
  const html = `
    <p>A privacy-rights request was submitted via /privacy/request.</p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Type</td><td style="padding:4px;"><strong>${kindLabel}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Name</td><td style="padding:4px;">${name || "(not provided)"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td style="padding:4px;"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;">State</td><td style="padding:4px;">${state || "(not provided)"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;color:#666;vertical-align:top;">Details</td><td style="padding:4px;white-space:pre-wrap;">${escapeHtml(details)}</td></tr>
    </table>
    <p style="color:#888;font-size:12px;margin-top:24px;">Respond to the request within the window required by the applicable state privacy law (typically 45 days). Reply directly to this email — it routes to ${email}.</p>
  `;

  const result = await sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
    replyTo: email,
  });

  if (!result.ok) {
    console.error("[privacy-request] send failed", result);
    // Don't expose the SES error to the requester; we have it in
    // logs. The user is told to email admin@ as a fallback.
    return NextResponse.json(
      { ok: false, error: "Couldn't send the request right now. Please email admin@getquarterback.com directly." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
