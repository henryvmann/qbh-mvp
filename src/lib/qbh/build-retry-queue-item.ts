import { supabaseAdmin } from "../supabase-server";
import { deriveRetryDecision } from "./derive-retry-decision";

export type RetryQueueItem = {
  original_attempt_id: number;
  app_user_id: string;
  provider_id: string;
  office_phone: string;
  patient_name: string | null;
  provider_name: string | null;
  preferred_timeframe: string | null;
  demo_autoconfirm: boolean;
  failure_class: string;
  retry_strategy: string;
  retry_after_iso: string | null;
};

const MAX_AUTO_RETRIES = 3;

type AttemptRow = {
  id: number;
  app_user_id: string;
  provider_id: string;
  office_phone: string | null;
  patient_name: string | null;
  provider_name: string | null;
  preferred_timeframe: string | null;
  demo_autoconfirm: boolean;
  metadata: unknown;
};

export async function buildRetryQueueItems(): Promise<RetryQueueItem[]> {
  const now = new Date().toISOString();

  const { data: failedAttempts, error } = await supabaseAdmin
    .from("schedule_attempts")
    .select(
      "id,app_user_id,provider_id,office_phone,patient_name,provider_name,preferred_timeframe,demo_autoconfirm,metadata"
    )
    .eq("status", "FAILED")
    .not("metadata->openai_call_classification", "is", null);

  if (error || !failedAttempts?.length) return [];

  const queue: RetryQueueItem[] = [];

  for (const row of failedAttempts as AttemptRow[]) {
    if (!row.app_user_id || !row.provider_id || !row.office_phone) continue;

    // 1. Derive retry decision from classification
    const decision = deriveRetryDecision(row.metadata);
    if (!decision || decision.next_action !== "AUTO_RETRY") continue;

    // 2. Timing: skip if retry window has not yet opened
    if (decision.retry_after_iso && decision.retry_after_iso > now) continue;

    // 3. Idempotency: skip if an active attempt already exists
    const { count: activeCount } = await supabaseAdmin
      .from("schedule_attempts")
      .select("*", { count: "exact", head: true })
      .eq("app_user_id", row.app_user_id)
      .eq("provider_id", row.provider_id)
      .in("status", ["CREATED", "CALLING", "PROPOSED"]);

    if ((activeCount ?? 0) > 0) continue;

    // 4. Invariant: skip if a future confirmed event already exists
    const { count: confirmedCount } = await supabaseAdmin
      .from("calendar_events")
      .select("*", { count: "exact", head: true })
      .eq("app_user_id", row.app_user_id)
      .eq("provider_id", row.provider_id)
      .eq("status", "confirmed")
      .gte("start_at", now);

    if ((confirmedCount ?? 0) > 0) continue;

    // 5. Bounded: skip if prior auto-retries have reached the limit
    const { count: priorRetryCount } = await supabaseAdmin
      .from("schedule_attempts")
      .select("*", { count: "exact", head: true })
      .eq("app_user_id", row.app_user_id)
      .eq("provider_id", row.provider_id)
      .filter("metadata->>source", "eq", "auto-retry");

    if ((priorRetryCount ?? 0) >= MAX_AUTO_RETRIES) continue;

    queue.push({
      original_attempt_id: row.id,
      app_user_id: row.app_user_id,
      provider_id: row.provider_id,
      office_phone: row.office_phone,
      patient_name: row.patient_name,
      provider_name: row.provider_name,
      preferred_timeframe: row.preferred_timeframe,
      demo_autoconfirm: row.demo_autoconfirm,
      failure_class: decision.reason,
      retry_strategy: decision.retry_strategy,
      retry_after_iso: decision.retry_after_iso,
    });
  }

  return queue;
}
