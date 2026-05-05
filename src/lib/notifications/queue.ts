import { supabaseAdmin } from "../supabase-server";

/**
 * Notification queue helpers — the only sanctioned way to send
 * email or SMS from app code. Callers insert a row and let the
 * /api/cron/notifications-drain cron actually deliver it.
 *
 * Why a queue and not a direct send:
 *   - Single audit trail (every email/SMS is one DB row).
 *   - Retry on transient SES/Twilio failures without tying up the
 *     request that triggered the notification.
 *   - Schedule sends in the future (reminders).
 *   - Idempotency — if a webhook fires twice, we only enqueue once.
 */

export type EnqueueEmailInput = {
  appUserId?: string | null;
  to: string;
  toName?: string;
  subject: string;
  /** HTML body. Plain-text auto-derived if textBody not set. */
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
  /** Template name for analytics — e.g. "caregiver_invite". */
  template: string;
  /** Defaults to now (send ASAP). Set future to schedule. */
  sendAt?: Date;
  metadata?: Record<string, unknown>;
};

export async function enqueueEmail(input: EnqueueEmailInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { error, data } = await supabaseAdmin
    .from("notifications")
    .insert({
      app_user_id: input.appUserId ?? null,
      channel: "email",
      recipient: input.to,
      recipient_name: input.toName ?? null,
      subject: input.subject,
      body: input.htmlBody,
      body_text: input.textBody ?? null,
      reply_to: input.replyTo ?? null,
      template: input.template,
      send_at: (input.sendAt ?? new Date()).toISOString(),
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export type EnqueueSmsInput = {
  appUserId?: string | null;
  to: string; // E.164 phone
  body: string;
  template: string;
  sendAt?: Date;
  metadata?: Record<string, unknown>;
};

export async function enqueueSms(input: EnqueueSmsInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { error, data } = await supabaseAdmin
    .from("notifications")
    .insert({
      app_user_id: input.appUserId ?? null,
      channel: "sms",
      recipient: input.to,
      body: input.body,
      template: input.template,
      send_at: (input.sendAt ?? new Date()).toISOString(),
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}
