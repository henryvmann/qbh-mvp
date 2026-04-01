"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { createClient } from "../../lib/supabase/client";
import { apiFetch } from "../../lib/api";

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

        const response = await apiFetch("/api/plaid/link-token", {
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

        const exchangeResponse = await apiFetch("/api/plaid/exchange-token", {
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

        await apiFetch("/api/discovery/run", {
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
      <main className="min-h-screen bg-[#080C14] text-[#EFF4FF]">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-3xl bg-[#0F1520] p-10 ring-1 ring-white/8">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#5DE8C5]">
              Quarterback AI
            </div>

            <h1 className="mt-4 text-3xl tracking-tight">
              {magicLinkSent ? "Check your email" : "Save your account"}
            </h1>

            {magicLinkSent ? (
              <div className="mt-4 text-base text-[#6B85A8]">
                We sent a sign-in link to <strong className="text-[#EFF4FF]">{email}</strong>. Click the
                link to access your dashboard.
              </div>
            ) : (
              <>
                <p className="mt-3 text-base text-[#6B85A8]">
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
                    className="w-full rounded-2xl border border-white/10 bg-[#162030] px-4 py-3 text-sm text-[#EFF4FF] placeholder:text-[#3D526B] focus:border-[#5DE8C5] focus:outline-none focus:ring-1 focus:ring-[#5DE8C5]"
                  />

                  <button
                    type="submit"
                    disabled={sendingMagicLink || !email.trim()}
                    className="w-full rounded-2xl bg-[#5DE8C5] px-6 py-3 text-sm font-medium text-[#080C14] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sendingMagicLink ? "Sending..." : "Save and continue"}
                  </button>

                  {error ? (
                    <div className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
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
      <main className="min-h-screen bg-[#080C14] text-[#EFF4FF]">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl rounded-3xl bg-[#0F1520] p-10 ring-1 ring-white/8">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#5DE8C5]">
              Quarterback AI
            </div>

            <h1 className="mt-4 text-4xl tracking-tight sm:text-5xl">
              Analyzing your healthcare spending
            </h1>

            <p className="mt-4 text-lg text-[#6B85A8]">
              We're securely reviewing your recent transactions, identifying
              providers, and preparing your dashboard.
            </p>

            <div className="mt-8 h-3 w-full overflow-hidden rounded-full bg-white/8">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-[#5DE8C5]" />
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
                        ? "bg-[#0D2825] text-[#EFF4FF]"
                        : "bg-[#162030] text-[#4D6480]",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "h-2.5 w-2.5 rounded-full",
                        isActive ? "bg-[#5DE8C5]" : "bg-white/15",
                      ].join(" ")}
                    />
                    <span>{message}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-sm text-[#4D6480]">
              This usually takes a few seconds.
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080C14] text-[#EFF4FF]">
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <header className="flex items-center justify-between">
          <Link
            href="/start"
            className="text-sm text-[#6B85A8] underline underline-offset-4"
          >
            Back
          </Link>

          <div className="text-xs text-[#4D6480]">Step 2 of 3</div>
        </header>

        <section className="mt-12">
          <h1 className="text-4xl tracking-tight sm:text-5xl">
            Connect your health spending
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-[#6B85A8]">
            Quarterback uses Plaid to identify real healthcare providers from
            real transactions and build the care picture that powers your
            dashboard.
          </p>

          <div className="mt-10 max-w-2xl rounded-2xl bg-[#0F1520] p-8 ring-1 ring-white/8">
            <div>
              <div className="text-sm font-medium text-[#EFF4FF]">
                Secure account connection
              </div>
              <div className="mt-1 text-sm text-[#6B85A8]">
                Your account is connected through Plaid. QBH never asks for your
                banking username or password directly.
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => open()}
                disabled={!ready || !linkToken || loadingToken || submitting}
                className="w-full rounded-2xl bg-[#5DE8C5] px-6 py-3 text-[#080C14] font-medium shadow-sm transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingToken
                  ? "Preparing secure connection..."
                  : submitting
                  ? "Connecting..."
                  : "Connect account with Plaid"}
              </button>
            </div>

            <div className="mt-4 text-center text-xs text-[#4D6480]">
              Plaid-secured connection • Real transaction discovery
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
              {error}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
