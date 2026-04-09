"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import EpicOrgPicker from "../../components/qbh/EpicOrgPicker";

type SelectedOrg = {
  name: string;
  fhirBaseUrl: string;
};

function PortalConnectPageInner() {
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<SelectedOrg | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerId = searchParams.get("provider_id") || "_portal_";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fromQuery = (searchParams.get("user_id") || "").trim();

    if (fromQuery) {
      window.localStorage.setItem("qbh_user_id", fromQuery);
      window.sessionStorage.setItem("qbh_user_id", fromQuery);
      setUserId(fromQuery);
      return;
    }

    const sessionUserId = window.sessionStorage.getItem("qbh_user_id") || "";
    const localUserId = window.localStorage.getItem("qbh_user_id") || "";
    const resolvedUserId = sessionUserId || localUserId;

    if (resolvedUserId) {
      setUserId(resolvedUserId);
      return;
    }

    setError("Missing user_id");
  }, [searchParams]);

  useEffect(() => {
    const portalError = (searchParams.get("portal_error") || "").trim();
    if (portalError) setError(portalError);
  }, [searchParams]);

  async function startPortalConnect() {
    if (!userId) {
      setError("Missing user_id");
      return;
    }

    if (!selectedOrg?.fhirBaseUrl) {
      setError("Please select your health system first.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await apiFetch("/api/portal/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          portal_brand: "epic_mychart",
          fhir_base_url: selectedOrg.fhirBaseUrl,
          org_name: selectedOrg.name,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok || !data?.authorize_url) {
        throw new Error(
          data?.error || "Failed to start MyChart connection."
        );
      }

      window.location.href = data.authorize_url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start MyChart connection."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canConnect = userId && selectedOrg?.fhirBaseUrl && !submitting;

  return (
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <header className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-sm text-[#7A7F8A] underline underline-offset-4"
          >
            Back
          </Link>
          <div className="text-xs text-[#B0B4BC]">Patient Portal</div>
        </header>

        <section className="mt-12">
          <h1 className="text-4xl tracking-tight sm:text-5xl">
            Connect Your Patient Portal
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-[#7A7F8A]">
            Connect your MyChart account so Quarterback can pull in your
            appointments, medications, and health records for a complete picture
            of your care.
          </p>

          <div className="mt-10 rounded-2xl bg-white shadow-sm p-8 border border-[#EBEDF0]">
            <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="text-sm font-medium text-[#1A1D2E]">
                  Why this matters
                </div>

                <div className="mt-4 space-y-4 text-sm text-[#7A7F8A]">
                  <div className="rounded-2xl bg-[#F0F2F5] px-4 py-3">
                    QBH pulls in real medical data — appointments, conditions,
                    and medications — directly from your health system.
                  </div>

                  <div className="rounded-2xl bg-[#F0F2F5] px-4 py-3">
                    This gives Kate deeper context about your care, so she can
                    make smarter scheduling decisions on your behalf.
                  </div>

                  <div className="rounded-2xl bg-[#F0F2F5] px-4 py-3">
                    Your data stays private. QBH only reads what you authorize
                    through your hospital&apos;s MyChart login.
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-[#EBEDF0] bg-[#F0F2F5] p-6">
                  <div className="text-sm font-medium text-[#1A1D2E]">
                    Epic MyChart
                  </div>
                  <div className="mb-5 mt-2 text-sm text-[#7A7F8A]">
                    Search for your health system, then sign in through MyChart.
                  </div>

                  <EpicOrgPicker
                    onSelect={setSelectedOrg}
                    selected={selectedOrg}
                  />

                  <div className="mt-6">
                    <button
                      onClick={startPortalConnect}
                      disabled={!canConnect}
                      className="w-full rounded-2xl px-6 py-3 text-white font-medium shadow-sm transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)", boxShadow: "0 8px 24px rgba(92,107,92,0.35)" }}
                    >
                      {submitting
                        ? "Redirecting to MyChart..."
                        : "Connect MyChart"}
                    </button>
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  className="block text-center text-sm text-[#B0B4BC] underline underline-offset-4"
                >
                  Return to dashboard
                </Link>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
              {error}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function PortalConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />}>
      <PortalConnectPageInner />
    </Suspense>
  );
}
