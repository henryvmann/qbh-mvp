import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { buildRetryQueueItems } from "../../../../lib/qbh/build-retry-queue-item";
import { getAvailabilityContext } from "../../../../lib/availability";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

async function buildAvailabilityContext(appUserId: string) {
  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const availability = await getAvailabilityContext({
      app_user_id: appUserId,
      window_start: windowStart,
      window_end: windowEnd,
      timezone: "America/New_York",
      include_sources: ["GOOGLE_CALENDAR"],
    });

    return {
      calendar_connected: availability.source_summaries.some(
        (s) => s.source === "GOOGLE_CALENDAR" && s.ok
      ),
      time_min: availability.window_start,
      time_max: availability.window_end,
      time_zone: availability.timezone,
      busy_blocks: availability.blocks,
      busy_block_count: availability.blocks.filter((b) => b.kind === "BUSY").length,
      source_summaries: availability.source_summaries,
    };
  } catch {
    return {
      calendar_connected: false,
      time_min: windowStart,
      time_max: windowEnd,
      time_zone: "America/New_York",
      busy_blocks: [],
      busy_block_count: 0,
      source_summaries: [],
    };
  }
}

async function runRetries() {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId =
    process.env.USE_TEST_ASSISTANT === "true"
      ? process.env.VAPI_ASSISTANT_ID_TEST
      : process.env.VAPI_ASSISTANT_ID;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

  if (!apiKey || !assistantId || !phoneNumberId) {
    return NextResponse.json(
      { ok: false, error: "Missing Vapi env vars" },
      { status: 500 }
    );
  }

  const queue = await buildRetryQueueItems();

  if (queue.length === 0) {
    return NextResponse.json({ ok: true, fired: 0, skipped: 0 });
  }

  let fired = 0;
  let skipped = 0;
  const results: JsonRecord[] = [];

  for (const item of queue) {
    try {
      const availabilityContext = await buildAvailabilityContext(item.app_user_id);

      const metadata: JsonRecord = {
        source: "auto-retry",
        flow_mode: "BOOK",
        last_event: "BOOKING_STARTED",
        retry_of_attempt_id: item.original_attempt_id,
        retry_reason: item.failure_class,
        retry_strategy: item.retry_strategy,
        availability_context: availabilityContext,
      };

      const { data: newAttempt, error: insertError } = await supabaseAdmin
        .from("schedule_attempts")
        .insert({
          app_user_id: item.app_user_id,
          provider_id: item.provider_id,
          patient_name: item.patient_name,
          provider_name: item.provider_name,
          preferred_timeframe: item.preferred_timeframe,
          demo_autoconfirm: item.demo_autoconfirm,
          office_phone: item.office_phone,
          status: "CREATED",
          metadata,
        })
        .select("id")
        .single();

      if (insertError || !newAttempt?.id) {
        console.error("RETRY_INSERT_ERROR:", {
          original_attempt_id: item.original_attempt_id,
          error: insertError?.message,
        });
        skipped++;
        results.push({
          original_attempt_id: item.original_attempt_id,
          status: "skipped",
          reason: "insert_failed",
        });
        continue;
      }

      const attemptId = String(newAttempt.id);

      const vapiRes = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumberId,
          assistantId,
          customer: {
            number: item.office_phone,
            numberE164CheckEnabled: false,
          },
          assistantOverrides: {
            variableValues: {
              attempt_id: attemptId,
              provider_id: item.provider_id,
              patient_name: item.patient_name,
              provider_name: item.provider_name,
              preferred_timeframe: item.preferred_timeframe,
              demo_autoconfirm: item.demo_autoconfirm,
              mode: "BOOK",
            },
          },
        }),
      });

      let vapiData: unknown = {};
      try {
        vapiData = await vapiRes.json();
      } catch {
        vapiData = {};
      }

      if (!vapiRes.ok) {
        await supabaseAdmin
          .from("schedule_attempts")
          .update({
            status: "FAILED",
            metadata: {
              ...metadata,
              last_event: "VAPI_CALL_CREATE_FAILED",
              vapi_status: vapiRes.status,
              vapi_error: vapiData,
            },
          })
          .eq("id", attemptId);

        console.error("RETRY_VAPI_ERROR:", {
          original_attempt_id: item.original_attempt_id,
          new_attempt_id: attemptId,
          vapi_status: vapiRes.status,
        });

        skipped++;
        results.push({
          original_attempt_id: item.original_attempt_id,
          new_attempt_id: attemptId,
          status: "skipped",
          reason: "vapi_call_failed",
        });
        continue;
      }

      const vapiPayload = asRecord(vapiData);
      const nestedCall = asRecord(vapiPayload?.call);
      const vapiCallId =
        (typeof vapiPayload?.id === "string" ? vapiPayload.id : null) ??
        (typeof nestedCall?.id === "string" ? nestedCall.id : null);

      await supabaseAdmin
        .from("schedule_attempts")
        .update({
          status: "CALLING",
          vapi_call_id: vapiCallId,
          vapi_assistant_id: assistantId,
          metadata: { ...metadata, last_event: "CALLING" },
        })
        .eq("id", attemptId);

      console.log("RETRY_FIRED:", {
        original_attempt_id: item.original_attempt_id,
        new_attempt_id: attemptId,
        failure_class: item.failure_class,
        retry_strategy: item.retry_strategy,
      });

      fired++;
      results.push({
        original_attempt_id: item.original_attempt_id,
        new_attempt_id: attemptId,
        status: "fired",
        failure_class: item.failure_class,
        retry_strategy: item.retry_strategy,
      });
    } catch (e) {
      console.error("RETRY_ITEM_ERROR:", {
        original_attempt_id: item.original_attempt_id,
        error: e instanceof Error ? e.message : String(e),
      });
      skipped++;
      results.push({
        original_attempt_id: item.original_attempt_id,
        status: "skipped",
        reason: "unhandled_exception",
      });
    }
  }

  return NextResponse.json({ ok: true, fired, skipped, results });
}

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${cronSecret}`;
}

// Vercel cron jobs send GET requests
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return runRetries();
}

// Allow manual POST triggering with the same auth (useful for testing)
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return runRetries();
}
