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
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(false);
  const [periodEndIso, setPeriodEndIso] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState<"cancel" | "resume" | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  async function refreshStatus() {
    try {
      const [dashRes, subRes] = await Promise.all([
        apiFetch("/api/dashboard/data").then((r) => r.json()).catch(() => null),
        apiFetch("/api/stripe/subscription-status").then((r) => r.json()).catch(() => null),
      ]);
      if (dashRes?.subscription_status) {
        setSubscriptionStatus(dashRes.subscription_status);
        setCurrentPlan(dashRes.stripe_plan || null);
      }
      const sub = subRes?.subscription;
      if (sub) {
        setCancelAtPeriodEnd(sub.cancel_at_period_end === true);
        setPeriodEndIso(
          sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        );
      }
    } catch {
      // best-effort — UI will render whatever loaded
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function handleCancelSubscription(cancel: boolean) {
    if (cancelBusy) return;
    if (cancel && !confirm("Cancel your subscription? You'll keep access through the end of your current billing period, then it won't renew.")) {
      return;
    }
    setCancelBusy(cancel ? "cancel" : "resume");
    setCancelError(null);
    try {
      const res = await apiFetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Couldn't update subscription");
      }
      await refreshStatus();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCancelBusy(null);
    }
  }

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
        <h1 className="text-2xl font-bold text-[#071832]">Choose Your Plan</h1>
        <p className="mt-2 text-sm text-[#4F5F73]">
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-sm font-semibold text-[#071832]">
                  Current plan: {currentPlan === "family" ? "QB Family" : "QB Solo"}
                </span>
                <span
                  className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    cancelAtPeriodEnd ? "bg-[#9B6B00] text-white" : "bg-[#1677FF] text-white"
                  }`}
                >
                  {cancelAtPeriodEnd ? "Ends Soon" : "Active"}
                </span>
                {periodEndIso && (
                  <div className="mt-1 text-xs text-[#4F5F73]">
                    {cancelAtPeriodEnd ? "Cancels on " : "Renews on "}
                    {new Date(periodEndIso).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    .
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="text-sm text-[#1677FF] font-medium hover:underline"
                >
                  {portalLoading ? "Loading..." : "Manage payment"}
                </button>
                {cancelAtPeriodEnd ? (
                  <button
                    onClick={() => handleCancelSubscription(false)}
                    disabled={cancelBusy !== null}
                    className="rounded-lg bg-[#1677FF] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {cancelBusy === "resume" ? "Resuming..." : "Resume subscription"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCancelSubscription(true)}
                    disabled={cancelBusy !== null}
                    className="rounded-lg border border-[#E5EAF2] px-3 py-1.5 text-xs font-medium text-[#4F5F73] hover:bg-[#F0F2F5] disabled:opacity-50"
                  >
                    {cancelBusy === "cancel" ? "Canceling..." : "Cancel subscription"}
                  </button>
                )}
              </div>
            </div>
            {cancelError && (
              <div className="mt-2 text-xs text-red-600">{cancelError}</div>
            )}
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
                  plan.id === "family" ? "border-[#1677FF] ring-1 ring-[#1677FF]" : "border-[#E5EAF2]"
                }`}
              >
                {plan.id === "family" && (
                  <div className="mb-3 inline-block rounded-full bg-[#1677FF] px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <h2 className="text-lg font-bold text-[#071832]">{plan.name}</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-[#071832]">{plan.price}</span>
                  {plan.period && <span className="text-sm text-[#4F5F73]">{plan.period}</span>}
                </div>
                <p className="mt-2 text-xs text-[#4F5F73]">{plan.description}</p>

                <ul className="mt-5 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#3A3F4B]">
                      <span className="mt-0.5 text-[#1677FF]">&#10003;</span>
                      {f}
                    </li>
                  ))}
                  {excluded.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#4F5F73]">
                      <span className="mt-0.5">&#10005;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/*
                  Button states:
                    - Card matches user's active paid plan → greyed-out "Current Plan"
                    - User on Free, looking at Free card → greyed-out "Current Plan"
                    - User on paid plan, looking at Free card → "Downgrade to Free" link to portal
                    - Card is a paid plan the user isn't on → "Get [Plan]" → checkout
                */}
                {(isCurrent || isCurrentFree) ? (
                  <button
                    disabled
                    className="mt-6 w-full rounded-xl py-3 text-sm font-semibold bg-[#E5EAF2] text-[#4F5F73] cursor-default"
                  >
                    Current Plan
                  </button>
                ) : isFree && isActive ? (
                  <button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="mt-6 w-full rounded-xl py-3 text-sm font-semibold bg-white border border-[#E5EAF2] text-[#071832] hover:bg-[#F4F5F7]"
                  >
                    {portalLoading ? "Loading..." : "Downgrade to Free"}
                  </button>
                ) : (
                  <button
                    onClick={() => !isFree && handleCheckout(plan.id as "solo" | "family")}
                    disabled={!!loading || isFree}
                    className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition ${
                      isFree
                        ? "bg-white border border-[#E5EAF2] text-[#4F5F73] cursor-default"
                        : "bg-[#1677FF] text-white hover:bg-[#006BFF]"
                    }`}
                  >
                    {loading === plan.id ? "Redirecting..." : `Get ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-[#4F5F73]">
          Cancel anytime. No long-term contracts. Prices shown in USD.
        </p>
    </PageShell>
  );
}
