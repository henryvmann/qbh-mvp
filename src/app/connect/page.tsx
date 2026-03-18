"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

function ConnectPageInner() {
  const searchParams = useSearchParams();
  const userId = (searchParams.get("user_id") || "").trim();

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function createLinkToken() {
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
      } catch (err) {
        console.error("Link token creation failed:", err);
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
        setSubmitting(true);
        setError(null);

        const exchangeResponse = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            public_token,
          }),
        });

        const exchangeData = await exchangeResponse.json();

        if (!exchangeResponse.ok || !exchangeData?.ok) {
          throw new Error(exchangeData?.error || "Failed to exchange token.");
        }

        const discoveryResponse = await fetch("/api/discovery/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
          }),
        });

        const discoveryData = await discoveryResponse.json();

        if (!discoveryResponse.ok || !discoveryData?.ok) {
          throw new Error(discoveryData?.error || "Failed to run discovery.");
        }

        window.location.href = `/dashboard?user_id=${encodeURIComponent(userId)}`;
      } catch (err) {
        console.error("Connect flow failed:", err);
        setError(
          err instanceof Error ? err.message : "Failed to complete connection."
        );
      } finally {
        setSubmitting(false);
      }
    },
    onExit: (err) => {
      if (err) {
        console.error("Plaid Link exited with error:", err);
        setError("Plaid Link was closed before completion.");
      }
    },
  });

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
                  ? "Connecting and analyzing..."
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