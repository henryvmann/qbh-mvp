export const dynamic = "force-dynamic";
// Drains a batch of pending notifications. Run frequently (every
// 1-2 min). Default Vercel cron limit is 10s for hobby / 300s for
// pro — drain is bounded to 50 rows per run to stay well under.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { sendEmail } from "../../../../lib/aws/ses";

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

/**
 * GET /api/cron/notifications-drain
 *
 * Cron entry for the unified notifications queue. Picks up rows
 * where status='pending' and send_at <= now, attempts delivery via
 * the appropriate channel, marks success or failure. Failed rows
 * with attempts < MAX_ATTEMPTS stay 'pending' for retry; those
 * past max go 'failed' permanently.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}`. Vercel
 * cron sets this automatically when configured in vercel.json.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const { data: rows, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[cron/notifications-drain] query failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const n of rows ?? []) {
    if (n.channel === "email") {
      const result = await sendEmail({
        to: n.recipient,
        subject: n.subject ?? "(no subject)",
        html: n.body,
        text: n.body_text ?? undefined,
        replyTo: n.reply_to ?? undefined,
      });
      if (result.ok) {
        await supabaseAdmin
          .from("notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: (n.attempts ?? 0) + 1,
            provider_message_id: result.messageId,
            last_error: null,
          })
          .eq("id", n.id);
        sent++;
      } else {
        const nextAttempts = (n.attempts ?? 0) + 1;
        const errorMessage = "error" in result ? result.error : "unknown error";
        await supabaseAdmin
          .from("notifications")
          .update({
            status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
            attempts: nextAttempts,
            last_error: errorMessage,
          })
          .eq("id", n.id);
        failed++;
      }
    } else if (n.channel === "sms") {
      // Twilio SMS not yet wired — fall through. Mark as failed
      // with a clear error so we know to wire Twilio when needed.
      await supabaseAdmin
        .from("notifications")
        .update({
          status: "failed",
          attempts: (n.attempts ?? 0) + 1,
          last_error: "SMS channel not yet implemented (Twilio integration pending)",
        })
        .eq("id", n.id);
      skipped++;
    }
  }

  console.log(
    `[cron/notifications-drain] ${sent} sent, ${failed} failed, ${skipped} skipped, ${Date.now() - startedAt}ms`
  );
  return NextResponse.json({
    ok: true,
    total: rows?.length ?? 0,
    sent,
    failed,
    skipped,
    elapsed_ms: Date.now() - startedAt,
  });
}
