export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { stripe } from "../../../../lib/stripe";

/**
 * Direct in-app cancellation. Sets every active subscription on the
 * customer to cancel_at_period_end=true so the user keeps the service
 * through the end of their paid period, then nothing renews.
 *
 * Counsel required a "simple cancellation mechanism" — one button,
 * no friction. The Stripe Customer Portal works but adds a hop
 * (Manage Subscription → find Cancel → confirm); this endpoint does
 * it in a single POST.
 *
 * Reversible: if the user changes their mind, they can hit "Resume
 * subscription" (handled by the same code path with cancel: false)
 * before the period ends.
 */
export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const cancel = body?.cancel !== false; // default true (cancel). Pass {cancel:false} to undo.

  const { data: profile } = await supabaseAdmin
    .from("app_users")
    .select("stripe_customer_id")
    .eq("id", appUserId)
    .single();

  const customerId = (profile as Record<string, unknown>)?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json({ ok: false, error: "No subscription on file" }, { status: 404 });
  }

  try {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const activeSubs = subs.data.filter(
      (s) => s.status === "active" || s.status === "trialing" || s.status === "past_due",
    );
    if (activeSubs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No active subscription to update" },
        { status: 404 },
      );
    }

    const updated = [];
    for (const s of activeSubs) {
      const next = await stripe.subscriptions.update(s.id, {
        cancel_at_period_end: cancel,
      });
      // current_period_end moved off the top-level Subscription type
      // in Stripe SDK v22; pull from items as fallback.
      const periodEnd =
        (next as { current_period_end?: number }).current_period_end ??
        (next as { items?: { data?: Array<{ current_period_end?: number }> } })
          ?.items?.data?.[0]?.current_period_end ??
        null;
      updated.push({
        id: next.id,
        cancel_at_period_end: next.cancel_at_period_end,
        current_period_end: periodEnd,
      });
    }

    return NextResponse.json({
      ok: true,
      cancel_at_period_end: cancel,
      subscriptions: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update subscription";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
