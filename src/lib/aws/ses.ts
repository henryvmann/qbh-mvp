import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

/**
 * AWS SES wrapper for transactional email.
 *
 * Sends from kate@getquarterback.com (or whatever NOTIFICATION_FROM
 * resolves to). Domain SPF/DKIM/DMARC must be configured in SES so
 * Gmail/Outlook accept the mail. Same AWS account + BAA we already
 * have for S3 — no new vendor.
 *
 * Operator action items (one-time, in AWS console):
 *   1. SES → Verified identities → add getquarterback.com as a
 *      domain identity. Copy the CNAMEs SES gives you and add them
 *      to your DNS (Vercel / wherever DNS lives).
 *   2. SES → Account dashboard → Request production access. Until
 *      this is granted you're in sandbox mode and can only send to
 *      verified addresses (your own + a few you add manually for
 *      testing). The form is short — fill in use case ("transactional
 *      healthcare-coordination notifications, opt-in only").
 *   3. SES → Configuration sets → optional but useful for tracking
 *      bounces/complaints.
 *   4. Set env vars on Vercel:
 *        AWS_SES_REGION         (e.g. us-east-1)
 *        NOTIFICATION_FROM      (kate@getquarterback.com)
 *        NOTIFICATION_FROM_NAME (Kate at Quarterback Health)
 */

const ses = new SESClient({
  region: process.env.AWS_SES_REGION || process.env.AWS_REGION || "us-east-1",
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined, // fall back to instance profile / env-default chain
});

const FROM_ADDRESS = process.env.NOTIFICATION_FROM || "kate@getquarterback.com";
const FROM_NAME = process.env.NOTIFICATION_FROM_NAME || "Kate at Quarterback Health";
// Replies go to a real monitored inbox. kate@ is send-only for now.
const REPLY_TO_DEFAULT = process.env.NOTIFICATION_REPLY_TO || "henry@getquarterback.com";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback. Auto-derived from html if missing. */
  text?: string;
  /** Optional reply-to override. Defaults to NOTIFICATION_REPLY_TO (henry@). */
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/**
 * Send a transactional email via AWS SES. Returns ok:false (rather
 * than throwing) so the caller can decide whether to retry from the
 * notification cron. Logs to the server side for debugging.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailParams): Promise<SendEmailResult> {
  const plainText = text ?? html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  try {
    const cmd = new SendEmailCommand({
      Source: `${FROM_NAME} <${FROM_ADDRESS}>`,
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: [replyTo || REPLY_TO_DEFAULT],
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: html, Charset: "UTF-8" },
          Text: { Data: plainText, Charset: "UTF-8" },
        },
      },
    });
    const out = await ses.send(cmd);
    return { ok: true, messageId: out.MessageId ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ses.sendEmail] failed", { to, subject, error: msg });
    return { ok: false, error: msg };
  }
}
