"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { apiFetch } from "../../../lib/api";

export default function PlaidOAuthRedirectPage() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const oauthStateId = params.get("oauth_state_id");

    // If this page was opened in Safari as the Plaid OAuth redirect,
    // bounce to the custom URL scheme so iOS opens the native app.
    if (oauthStateId && !window.localStorage.getItem("qbh_plaid_redirect_uri")) {
      window.location.href = `com.getquarterback.app://plaid/oauth${window.location.search}`;
      return;
    }

    // On native, CapacitorInit stores the deep link URL in localStorage.
    // On web, fall back to the current page URL.
    const deepLinkUri = window.localStorage.getItem("qbh_plaid_redirect_uri");
    setReceivedRedirectUri(deepLinkUri || window.location.href);

    const storedLinkToken =
      window.localStorage.getItem("qbh_plaid_link_token") ||
      window.sessionStorage.getItem("qbh_plaid_link_token");

    if (!storedLinkToken) {
      setError("Session expired. Please go back and reconnect your bank account.");
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
          window.localStorage.getItem("qbh_user_id") ||
          window.sessionStorage.getItem("qbh_user_id") || "";

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

        const discoveryResponse = await apiFetch("/api/discovery/run", {
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
        window.localStorage.removeItem("qbh_plaid_redirect_uri");
        window.localStorage.removeItem("qbh_plaid_link_token");
        window.location.href = "/dashboard";
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
    <main className="min-h-screen bg-[#080C14] text-[#EFF4FF]">
      <div className="mx-auto max-w-3xl px-6 pt-16 pb-16">
        <h1 className="text-4xl tracking-tight sm:text-5xl">
          Returning to Quarterback
        </h1>

        <p className="mt-4 max-w-xl text-lg text-[#6B85A8]">
          We're securely completing your bank connection.
        </p>

        <div className="mt-8 rounded-2xl bg-[#0F1520] p-8 ring-1 ring-white/8">
          <div className="text-sm text-[#6B85A8]">
            {submitting ? "Finishing connection..." : "Resuming secure sign-in..."}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
