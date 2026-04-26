export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { stripe } from "../../../../lib/stripe";

/** Creates a Stripe Customer Portal session so users can manage their subscription */
export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("app_users")
    .select("stripe_customer_id")
    .eq("id", appUserId)
    .single();

  const customerId = (profile as Record<string, unknown>)?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  const baseUrl = process.env.QBH_BASE_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
