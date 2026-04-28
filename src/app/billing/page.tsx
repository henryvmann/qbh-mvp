"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageShell from "../../components/qbh/PageShell";
import { apiFetch } from "../../lib/api";

const PLANS = [
  {
    id: "free" as const,
    name: "QB Free",
    price: "$0",
    period: "",
    description: "See everything — take action when you're ready",
    features: [
      "Unlimited providers",
      "Calendar integration",
      "Limited Kate chat",
      "Basic care gap recommendations",
    ],
    excluded: [
      "AI appointment scheduling",
      "Health document summaries",
    ],
  },
  {
    id: "solo" as const,
    name: "QB Solo",
    price: "$24",
    period: "/ month",
    description: "For individuals managing their own healthcare",
    features: [
      "Everything in Free, plus:",
      "Unlimited Kate chat",
      "AI appointment scheduling",
      "Health document summaries",
      "Advanced care gap recommendations",
    ],
  },
  {
    id: "family" as const,
    name: "QB Family",
    price: "$49",
    period: "/ month",
    description: "Manage care for your whole household",
    features: [
      "Everything in Solo, plus:",
      "Up to 5 care recipients",
      "Family calendar coordination",
      "Per-person provider tracking",
      "Shared care team view",
      "Priority Kate support",
    ],
  },
];

export default function BillingPage() {
  return (
    <Suspense fallback={<PageShell><div /></PageShell>}>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    async function loadSubscription() {
      try {
        const res = await apiFetch("/api/dashboard/data");
        const data = await res.json();
        if (data?.subscription_status) {
          setSubscriptionStatus(data.subscription_status);
          setCurrentPlan(data.stripe_plan || null);
        }
      } catch {
        // No subscription data
      }
    }
    loadSubscription();
  }, []);

  async function handleCheckout(plan: "solo" | "family") {
    setLoading(plan);
    try {
      const res = await apiFetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(null);
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const res = await apiFetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Portal error:", err);
    } finally {
      setPortalLoading(false);
    }
  }

  const isActive = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  return (
    <PageShell maxWidth="max-w-3xl">
        <h1 className="text-2xl font-bold text-[#1A1D2E]">Choose Your Plan</h1>
        <p className="mt-2 text-sm text-[#7A7F8A]">
          Start managing your healthcare with Kate by your side.
        </p>

        {success && (
          <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            Welcome aboard! Your subscription is active.
          </div>
        )}

        {canceled && (
          <div className="mt-4 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Checkout canceled. You can try again anytime.
          </div>
        )}

        {isActive && (
          <div className="mt-4 rounded-xl bg-[#F0F4F0] border border-[#D0D8D0] px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-[#1A1D2E]">
                  Current plan: {currentPlan === "family" ? "QB Family" : "QB Solo"}
                </span>
                <span className="ml-2 inline-block rounded-full bg-[#5C6B5C] px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                  Active
                </span>
              </div>
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="text-sm text-[#5C6B5C] font-medium hover:underline"
              >
                {portalLoading ? "Loading..." : "Manage Subscription"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = isActive && currentPlan === plan.id;
            const isFree = plan.id === "free";
            const isCurrentFree = !isActive && isFree;
            const excluded = "excluded" in plan ? (plan as { excluded: string[] }).excluded : [];
            return (
              <div
                key={plan.id}
                className={`rounded-2xl bg-white border p-6 shadow-sm ${
                  plan.id === "family" ? "border-[#5C6B5C] ring-1 ring-[#5C6B5C]" : "border-[#EBEDF0]"
                }`}
              >
                {plan.id === "family" && (
                  <div className="mb-3 inline-block rounded-full bg-[#5C6B5C] px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <h2 className="text-lg font-bold text-[#1A1D2E]">{plan.name}</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-[#1A1D2E]">{plan.price}</span>
                  {plan.period && <span className="text-sm text-[#7A7F8A]">{plan.period}</span>}
                </div>
                <p className="mt-2 text-xs text-[#7A7F8A]">{plan.description}</p>

                <ul className="mt-5 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#3A3F4B]">
                      <span className="mt-0.5 text-[#5C6B5C]">&#10003;</span>
                      {f}
                    </li>
                  ))}
                  {excluded.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#B0B4BC]">
                      <span className="mt-0.5">&#10005;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !isFree && handleCheckout(plan.id as "solo" | "family")}
                  disabled={!!loading || isCurrent || isCurrentFree}
                  className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition ${
                    isCurrent || isCurrentFree
                      ? "bg-[#EBEDF0] text-[#7A7F8A] cursor-default"
                      : isFree
                      ? "bg-white border border-[#EBEDF0] text-[#1A1D2E] hover:bg-[#F4F5F7]"
                      : "bg-[#5C6B5C] text-white hover:bg-[#4A5A4A]"
                  }`}
                >
                  {isCurrent || isCurrentFree
                    ? "Current Plan"
                    : loading === plan.id
                    ? "Redirecting..."
                    : isFree
                    ? "Your Current Plan"
                    : `Get ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-[#B0B4BC]">
          Cancel anytime. No long-term contracts. Prices shown in USD.
        </p>
    </PageShell>
  );
}
