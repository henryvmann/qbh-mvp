"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

function ConnectPageInner() {
  const searchParams = useSearchParams();

const [userId, setUserId] = useState("");

useEffect(() => {
  if (typeof window === "undefined") return;

  // 1. Query param (highest priority)
  const fromQuery = (searchParams.get("user_id") || "").trim();

  if (fromQuery) {
    window.localStorage.setItem("qbh_user_id", fromQuery);
    setUserId(fromQuery);
    return;
  }

  // 2. Existing stored user
  const existing = window.localStorage.getItem("qbh_user_id");

  if (existing) {
    setUserId(existing);
    return;
  }

  // 3. Create new user_id
  const newId = crypto.randomUUID();
  window.localStorage.setItem("qbh_user_id", newId);
  setUserId(newId);
}, [searchParams]);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (userId) {
      window.sessionStorage.setItem("qbh_user_id", userId);
    }
  }, [userId]);

  useEffect(() => {
    if (!analyzing) return;

    const messages = [
      0, // Connecting your account
      1, // Pulling transactions
      2, // Finding providers
      3, // Organizing your care history
    ];

    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      if (index >= messages.length) {
        window.clearInterval(interval);
        return;
      }
      setAnalysisStep(messages[index]);
    }, 1400);

    return () => window.clearInterval(interval);
  }, [analyzing]);

  useEffect(() => {
    async function createLinkToken() {
      if (typeof window === "undefined") return;

      if (!userId) {
        setError("Missing user_id");
        return;
      }

      try {
        setLoadingToken(true);
        setError(null);

        const response = await fetch("/api/plaid/link-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data?.ok || !data?.link_token) {
          throw new Error(data?.error || "Failed to create Plaid Link token.");
        }

        setLinkToken(data.link_token);
        window.sessionStorage.setItem("qbh_plaid_link_token", data.link_token);
      } catch (err) {
        console.log("Link token creation failed:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to create Plaid Link token."
        );
      } finally {
        setLoadingToken(false);
      }
    }

    createLinkToken();
  }, [userId]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      try {
        if (typeof window === "undefined") return;

        setSubmitting(true);
        setAnalyzing(true);
        setAnalysisStep(0);
        setError(null);

        const effectiveUserId =
          userId || window.sessionStorage.getItem("qbh_user_id") || "";

        if (!effectiveUserId) {
          throw new Error("Missing user_id");
        }

        const exchangeResponse = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: effectiveUserId,
            public_token,
          }),
        });

        const exchangeData = await exchangeResponse.json();

        if (!exchangeResponse.ok || !exchangeData?.ok) {
          throw new Error(exchangeData?.error || "Failed to exchange token.");
        }

        window.sessionStorage.removeItem("qbh_plaid_link_token");

        window.location.href = `/dashboard?user_id=${encodeURIComponent(
          effectiveUserId
        )}&analyzing=1`;
      } catch (err) {
        console.log("Connect flow failed:", err);
        setError(
          err instanceof Error ? err.message : "Failed to complete connection."
        );
        setAnalyzing(false);
      } finally {
        setSubmitting(false);
      }
    },
    onExit: (err, metadata) => {
      if (err) {
        console.log("Plaid Link exit error:", {
          error_code: err.error_code,
          error_message: err.error_message,
          error_type: err.error_type,
          request_id: (err as any)?.request_id,
          status: metadata?.status,
          institution: metadata?.institution,
          link_session_id: metadata?.link_session_id,
        });

        setError(err.error_message || "Plaid Link exited before completion.");
        return;
      }

      console.log("Plaid Link exited without error:", metadata);
    },
  });

  const analysisMessages = [
    "Connecting your account",
    "Pulling recent transactions",
    "Finding healthcare providers",
    "Organizing your care history",
  ];

  if (analyzing) {
    return (
      <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-10 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#8B9D83]">
              Quarterback AI
            </div>

            <h1
              className="mt-4 text-4xl tracking-tight sm:text-5xl"
              style={{ fontFamily: "Playfair Display, serif" }}
            >
              Analyzing your healthcare spending
            </h1>

            <p className="mt-4 text-lg text-neutral-700">
              We’re securely reviewing your recent transactions, identifying
              providers, and preparing your dashboard.
            </p>

            <div className="mt-8 h-3 w-full overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-[#8B9D83]" />
            </div>

            <div className="mt-8 space-y-3">
              {analysisMessages.map((message, index) => {
                const isActive = index <= analysisStep;

                return (
                  <div
                    key={message}
                    className={[
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                      isActive
                        ? "bg-[#F3F7F1] text-neutral-900"
                        : "bg-neutral-50 text-neutral-400",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "h-2.5 w-2.5 rounded-full",
                        isActive ? "bg-[#8B9D83]" : "bg-neutral-300",
                      ].join(" ")}
                    />
                    <span>{message}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-sm text-neutral-500">
              This usually takes a few seconds.
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
      <div className="mx-auto max-w-4xl px-6 pt-10 pb-16">
        <header className="flex items-center justify-between">
          <Link
            href="/start"
            className="text-sm text-neutral-700 underline underline-offset-4"
          >
            Back
          </Link>

          <div className="text-xs text-neutral-500">Step 2 of 3</div>
        </header>

        <section className="mt-12">
          <h1
            className="text-4xl tracking-tight sm:text-5xl"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Connect the account you use for healthcare spending
          </h1>

          <p className="mt-4 max-w-xl text-lg text-neutral-700">
            Quarterback uses Plaid to securely connect your account so we can
            identify real healthcare providers from real transactions.
          </p>

          <div className="mt-10 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div>
              <div className="text-sm font-medium text-neutral-900">
                Secure account connection
              </div>
              <div className="mt-1 text-sm text-neutral-600">
                Your account is connected through Plaid. QBH never asks for your
                banking username or password directly.
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => open()}
                disabled={!ready || !linkToken || loadingToken || submitting}
                className="w-full rounded-2xl bg-[#8B9D83] px-6 py-3 text-white shadow-sm transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingToken
                  ? "Preparing secure connection..."
                  : submitting
                  ? "Connecting..."
                  : "Connect account with Plaid"}
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-4 text-center text-xs text-neutral-500">
              Plaid-secured connection • Real transaction discovery
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F1E8]" />}>
      <ConnectPageInner />
    </Suspense>
  );
}