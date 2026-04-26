export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { stripe, PRICES, PlanType } from "../../../../lib/stripe";

export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = body?.plan as PlanType;

  if (!plan || !PRICES[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Get user email for Stripe customer
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("auth_user_id")
    .eq("id", appUserId)
    .single();

  let email: string | undefined;
  if (appUser?.auth_user_id) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(appUser.auth_user_id);
    email = authUser?.user?.email || undefined;
  }

  // Check if user already has a Stripe customer ID
  const { data: profile } = await supabaseAdmin
    .from("app_users")
    .select("stripe_customer_id")
    .eq("id", appUserId)
    .single();

  let customerId = (profile as Record<string, unknown>)?.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { app_user_id: appUserId },
    });
    customerId = customer.id;

    await supabaseAdmin
      .from("app_users")
      .update({ stripe_customer_id: customerId })
      .eq("id", appUserId);
  }

  const baseUrl = process.env.QBH_BASE_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PRICES[plan], quantity: 1 }],
    success_url: `${baseUrl}/billing?success=true`,
    cancel_url: `${baseUrl}/billing?canceled=true`,
    metadata: { app_user_id: appUserId, plan },
  });

  return NextResponse.json({ url: session.url });
}
