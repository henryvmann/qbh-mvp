export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";

/**
 * GET /api/fsa-spend
 *
 * Sums the user's healthcare-classified Plaid transactions for
 * the current calendar year and returns:
 *   - total spend
 *   - count of transactions
 *   - per-provider breakdown
 *   - the underlying transactions (capped at 50 most recent)
 *
 * "FSA-eligible" is being used loosely — IRS-eligible expenses
 * include most of what we already classify as healthcare (copays,
 * prescriptions, dental, vision, mental health). Some categories
 * like over-the-counter pharmacy items are partial-eligible and we
 * include them — the user reviews their FSA-portal upload anyway.
 *
 * Phase 1 hookup: when we add Plaid HSA/FSA account linking, we
 * can match transactions against actual reimbursements and split
 * "claimed" vs "still claimable".
 */
export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  // Pull active healthcare providers (transactions joined back via
  // discovered_providers metadata isn't reliable across re-scans —
  // safer to roll up by provider id from provider_visits.)
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, name, provider_type")
    .eq("app_user_id", appUserId)
    .eq("status", "active");
  const providerRows = providers ?? [];
  const providerIds = providerRows.map((p) => p.id);
  if (providerIds.length === 0) {
    return NextResponse.json({
      ok: true,
      year_total: 0,
      transaction_count: 0,
      by_provider: [],
      transactions: [],
    });
  }

  const { data: visits } = await supabaseAdmin
    .from("provider_visits")
    .select("provider_id, visit_date, amount, plaid_transaction_id")
    .eq("app_user_id", appUserId)
    .in("provider_id", providerIds)
    .gte("visit_date", yearStart)
    .order("visit_date", { ascending: false });

  const visitRows = visits ?? [];
  const total = visitRows.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);

  // Per-provider rollup
  const byProviderMap = new Map<string, { amount: number; count: number }>();
  for (const v of visitRows) {
    const existing = byProviderMap.get(v.provider_id) ?? { amount: 0, count: 0 };
    existing.amount += Number(v.amount) || 0;
    existing.count += 1;
    byProviderMap.set(v.provider_id, existing);
  }
  const providerById = new Map(providerRows.map((p) => [p.id, p]));
  const byProvider = Array.from(byProviderMap.entries())
    .map(([providerId, agg]) => ({
      provider_id: providerId,
      provider_name: providerById.get(providerId)?.name ?? "(unknown)",
      provider_type: providerById.get(providerId)?.provider_type ?? null,
      amount: Math.round(agg.amount * 100) / 100,
      count: agg.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  return NextResponse.json({
    ok: true,
    year_total: Math.round(total * 100) / 100,
    transaction_count: visitRows.length,
    by_provider: byProvider,
    // Most recent 50 individual transactions for the drill-down
    transactions: visitRows.slice(0, 50).map((v) => ({
      provider_id: v.provider_id,
      provider_name: providerById.get(v.provider_id)?.name ?? "(unknown)",
      date: v.visit_date,
      amount: Number(v.amount) || 0,
    })),
  });
}
