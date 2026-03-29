"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { createClient } from "../../lib/supabase/client";

export default function ConnectPage() {
  const [userId, setUserId] = useState("");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [email, setEmail] = useState("");
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [capturedUserId, setCapturedUserId] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const newId = crypto.randomUUID();
    setUserId(newId);
    window.sessionStorage.setItem("qbh_user_id", newId);
  }, []);

  useEffect(() => {
    if (!analyzing) return;

    const messages = [0, 1, 2, 3];

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
            app_user_id: userId,
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
            app_user_id: effectiveUserId,
            public_token,
          }),
        });

        const exchangeData = await exchangeResponse.json();

        if (!exchangeResponse.ok || !exchangeData?.ok) {
          throw new Error(exchangeData?.error || "Failed to exchange token.");
        }

        window.sessionStorage.removeItem("qbh_plaid_link_token");

        await fetch("/api/discovery/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_user_id: effectiveUserId }),
        });

        setCapturedUserId(effectiveUserId);
        setAnalyzing(false);
        setShowEmailCapture(true);
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

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !capturedUserId) return;

    try {
      setSendingMagicLink(true);
      setError(null);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?app_user_id=${encodeURIComponent(capturedUserId)}`,
        },
      });

      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send link.");
    } finally {
      setSendingMagicLink(false);
    }
  }

  const analysisMessages = [
    "Connecting your account",
    "Pulling recent transactions",
    "Finding healthcare providers",
    "Organizing your care history",
  ];

  if (showEmailCapture) {
    return (
      <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#8B9D83]">
              Quarterback AI
            </div>

            <h1
              className="mt-4 text-3xl tracking-tight"
              style={{ fontFamily: "Playfair Display, ui-serif, serif" }}
            >
              {magicLinkSent ? "Check your email" : "Save your account"}
            </h1>

            {magicLinkSent ? (
              <div className="mt-4 text-base text-neutral-600">
                We sent a sign-in link to <strong>{email}</strong>. Click the
                link to access your dashboard.
              </div>
            ) : (
              <>
                <p className="mt-3 text-base text-neutral-600">
                  Your providers have been found. Enter your email to save your
                  account and access your dashboard.
                </p>

                <form onSubmit={handleMagicLink} className="mt-8 space-y-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#8B9D83] focus:outline-none focus:ring-1 focus:ring-[#8B9D83]"
                  />

                  <button
                    type="submit"
                    disabled={sendingMagicLink || !email.trim()}
                    className="w-full rounded-2xl bg-[#8B9D83] px-6 py-3 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sendingMagicLink ? "Sending..." : "Save and continue"}
                  </button>

                  {error ? (
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                      {error}
                    </div>
                  ) : null}
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

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
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-10">
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
            Connect your health spending
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-neutral-700">
            Quarterback uses Plaid to identify real healthcare providers from
            real transactions and build the care picture that powers your
            dashboard.
          </p>

          <div className="mt-10 max-w-2xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
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

            <div className="mt-4 text-center text-xs text-neutral-500">
              Plaid-secured connection • Real transaction discovery
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

