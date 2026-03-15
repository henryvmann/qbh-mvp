// src/lib/QBH/queries/dashboard.ts

import { supabaseAdmin } from "../../supabase-server";
import type {
  ProviderDashboardSnapshot,
  Provider,
  ScheduleAttemptSnapshot,
  CalendarEventSnapshot,
} from "../../../app/lib/QBH/types";

/**
 * Phase A (clean UUID world):
 * - providers.id is uuid
 * - schedule_attempts.provider_id is uuid
 * - calendar_events.provider_id is uuid
 *
 * No fallbacks, no casts, no drift.
 */
export async function getDashboardProvidersForUser(
  _userId: string
): Promise<ProviderDashboardSnapshot[]> {
  // 1) Providers (active) — demo-safe unscoped for now
  const { data: providers, error: providersError } = await supabaseAdmin
    .from("providers")
    .select("id,name,status,created_at,user_id")
    .eq("user_id", _userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (providersError) throw providersError;

  const providerRows = (providers ?? []) as Array<{
    id: string;
    user_id: string;
    name: string;
    status: string;
    created_at: string;
  }>;

  if (providerRows.length === 0) return [];

  const providerIds = providerRows.map((p) => p.id);

  // 2) Latest schedule attempt per provider (uuid provider_id)
  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from("schedule_attempts")
    .select("id,provider_id,status,created_at")
    .in("provider_id", providerIds)
    .order("created_at", { ascending: false });

  if (attemptsError) throw attemptsError;

  const latestAttemptByProvider = new Map<string, ScheduleAttemptSnapshot>();

  for (const row of (attempts ?? []) as Array<{
    id: number;
    provider_id: string;
    status: string;
    created_at: string;
  }>) {
    if (!latestAttemptByProvider.has(row.provider_id)) {
      latestAttemptByProvider.set(row.provider_id, {
        id: Number(row.id),
        status: row.status as any,
        created_at: row.created_at,
      });
    }
  }

  // 3) Nearest future confirmed calendar event per provider (uuid provider_id)
  const nowIso = new Date().toISOString();

  const { data: events, error: eventsError } = await supabaseAdmin
    .from("calendar_events")
    .select("id,provider_id,start_at,end_at,status,created_at")
    .in("provider_id", providerIds)
    .eq("status", "confirmed")
    .gte("start_at", nowIso)
    .order("start_at", { ascending: true });

  if (eventsError) throw eventsError;

  const futureConfirmedByProvider = new Map<string, CalendarEventSnapshot>();

  for (const row of (events ?? []) as Array<{
    id: string;
    provider_id: string;
    start_at: string;
    end_at: string;
    status: string;
    created_at: string;
  }>) {
    if (!futureConfirmedByProvider.has(row.provider_id)) {
      futureConfirmedByProvider.set(row.provider_id, {
        id: row.id,
        start_at: row.start_at,
        end_at: row.end_at,
        status: row.status as any,
      });
    }
  }

  // 4) Compose snapshots
  return providerRows.map((pRow) => {
    const provider: Provider = {
      id: pRow.id,
      name: pRow.name,
      phone: null,
      specialty: null,
      location: null,
    };

    const futureConfirmedEvent =
      futureConfirmedByProvider.get(pRow.id) ?? null;

    const latestAttempt = latestAttemptByProvider.get(pRow.id) ?? null;

    return {
      provider,
      followUpNeeded: !futureConfirmedEvent,
      latestAttempt,
      futureConfirmedEvent,
    };
  });
}