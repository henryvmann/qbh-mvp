export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { stripe } from "../../../../lib/stripe";

/**
 * Returns the rich state of the user's most recent subscription:
 * status, whether it's set to cancel at period end, the renewal /
 * end date, and the price id. Used by /billing to render renewal
 * timing and the Cancel vs. Resume button.
 *
 * Reads from Stripe directly rather than caching to app_users so we
 * never show a stale state after a cancel/resume round-trip.
 */
export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("app_users")
    .select("stripe_customer_id, stripe_plan")
    .eq("id", appUserId)
    .single();

  const customerId = (profile as Record<string, unknown>)?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json({ ok: true, subscription: null });
  }

  try {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });
    // current_period_end was moved off the top-level Subscription
    // type in Stripe SDK v22; the value still lives in the API
    // response (and on subscription items). Cast through unknown to
    // read it without disabling type-checking everywhere.
    function periodEnd(s: unknown): number | null {
      const top = (s as { current_period_end?: number })?.current_period_end;
      if (typeof top === "number") return top;
      const itemEnd = (s as { items?: { data?: Array<{ current_period_end?: number }> } })
        ?.items?.data?.[0]?.current_period_end;
      return typeof itemEnd === "number" ? itemEnd : null;
    }
    const ranked = subs.data
      .filter((s) => ["active", "trialing", "past_due", "canceled"].includes(s.status))
      .sort((a, b) => (periodEnd(b) ?? 0) - (periodEnd(a) ?? 0));
    const sub = ranked[0];
    if (!sub) {
      return NextResponse.json({ ok: true, subscription: null });
    }
    return NextResponse.json({
      ok: true,
      subscription: {
        id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end === true,
        current_period_end: periodEnd(sub),
        canceled_at: sub.canceled_at,
        plan: (profile as Record<string, unknown>)?.stripe_plan as string | null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load subscription";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
