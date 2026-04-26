export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const appUserId = session.metadata?.app_user_id;
        const subscriptionId = session.subscription as string;
        if (appUserId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await supabaseAdmin
            .from("app_users")
            .update({
              stripe_subscription_id: subscriptionId,
              stripe_plan: session.metadata?.plan || "solo",
              subscription_status: sub.status,
            })
            .eq("id", appUserId);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = sub.customer as string;
        const { data: users } = await supabaseAdmin
          .from("app_users")
          .select("id")
          .eq("stripe_customer_id", customerId);

        if (users && users.length > 0) {
          await supabaseAdmin
            .from("app_users")
            .update({
              subscription_status: sub.status,
              stripe_subscription_id: sub.id,
            })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;
        await supabaseAdmin
          .from("app_users")
          .update({ subscription_status: "past_due" })
          .eq("stripe_customer_id", customerId);
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook] processing error:", err);
  }

  return NextResponse.json({ received: true });
}
