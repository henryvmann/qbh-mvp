"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export default function PlaidOAuthRedirectPage() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const receivedRedirectUri =
    typeof window !== "undefined" ? window.location.href : undefined;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedLinkToken =
      window.sessionStorage.getItem("qbh_plaid_link_token");

    if (!storedLinkToken) {
      setError("Missing stored Plaid link token for OAuth resume.");
      return;
    }

    setLinkToken(storedLinkToken);
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess: async (public_token) => {
      try {
        setSubmitting(true);
        setError(null);

        const effectiveUserId =
          window.sessionStorage.getItem("qbh_user_id") || "";

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

        const discoveryResponse = await fetch("/api/discovery/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            app_user_id: effectiveUserId,
          }),
        });

        const discoveryData = await discoveryResponse.json();

        if (!discoveryResponse.ok || !discoveryData?.ok) {
          throw new Error(discoveryData?.error || "Failed to run discovery.");
        }

        window.sessionStorage.removeItem("qbh_user_id");
        window.location.href = `/dashboard?user_id=${encodeURIComponent(
          effectiveUserId
        )}`;
      } catch (err) {
        console.log("Plaid OAuth resume failed:", err);
        setError(
          err instanceof Error ? err.message : "Failed to complete connection."
        );
      } finally {
        setSubmitting(false);
      }
    },
    onExit: (err, metadata) => {
      if (err) {
        console.log("Plaid OAuth exit error:", {
          error_code: err.error_code,
          error_message: err.error_message,
          error_type: err.error_type,
          request_id: (err as any)?.request_id,
          status: metadata?.status,
          institution: metadata?.institution,
          link_session_id: metadata?.link_session_id,
        });

        setError(err.error_message || "Plaid Link exited before completion.");
      }
    },
  });

  useEffect(() => {
    if (ready && linkToken && receivedRedirectUri && !submitting) {
      open();
    }
  }, [ready, linkToken, receivedRedirectUri, open, submitting]);

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 pt-16 pb-16">
        <h1
          className="text-4xl tracking-tight sm:text-5xl"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Returning to Quarterback
        </h1>

        <p className="mt-4 max-w-xl text-lg text-neutral-700">
          We’re securely completing your bank connection.
        </p>

        <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <div className="text-sm text-neutral-700">
            {submitting ? "Finishing connection..." : "Resuming secure sign-in..."}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}