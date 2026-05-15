"use client";

/**
 * /privacy/request — the form linked from the Privacy Policy under
 * "Exercising Your Rights." Submits to /api/privacy-request which
 * emails admin@getquarterback.com.
 *
 * No auth gate. Users invoking the right to delete may not have an
 * account, or may not be able to sign into one.
 */

import { useState } from "react";
import Link from "next/link";
import LegalFooter from "../../../components/brand/LegalFooter";

const KINDS = [
  { value: "access", label: "Access — give me a copy of my data" },
  { value: "delete", label: "Delete — delete my data" },
  { value: "correct", label: "Correct — fix something in my data" },
  { value: "portability", label: "Portability — give me a portable copy" },
  { value: "appeal", label: "Appeal — appeal a previous denial" },
  { value: "other", label: "Other" },
];

export default function PrivacyRequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [kind, setKind] = useState("access");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, state, kind, details }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Couldn't send the request. Please email admin@getquarterback.com.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error. Please email admin@getquarterback.com.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold text-[#071832] mb-2">Submit a Privacy Request</h1>
        <p className="text-sm text-[#4F5F73] mb-8">
          Exercise your rights under our{" "}
          <Link href="/privacy" className="text-[#1677FF] underline">
            Privacy Policy
          </Link>{" "}
          — access, delete, correct, port, or appeal. We respond within the window required by
          applicable state privacy laws (typically 45 days).
        </p>

        {done ? (
          <div className="rounded-2xl bg-white border border-[#E5EAF2] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#071832] mb-2">Request received</h2>
            <p className="text-sm text-[#3A3F4B] leading-relaxed">
              Thanks — we&rsquo;ve received your request and will respond to{" "}
              <span className="font-medium">{email}</span> within the legally required window.
              If you need to follow up before then, email{" "}
              <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">
                admin@getquarterback.com
              </a>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white border border-[#E5EAF2] p-6 shadow-sm">
            <div>
              <label className="block text-xs font-medium text-[#071832] mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[#E5EAF2] bg-[#F8F9FB] px-3 py-2 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                placeholder="(optional, helps us find your record)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#071832] mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-[#E5EAF2] bg-[#F8F9FB] px-3 py-2 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                placeholder="you@example.com"
              />
              <p className="mt-1 text-[10px] text-[#4F5F73]">We&rsquo;ll respond here.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#071832] mb-1">State of residence</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-lg border border-[#E5EAF2] bg-[#F8F9FB] px-3 py-2 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                placeholder="e.g. California, Colorado, Texas"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#071832] mb-1">
                Request type <span className="text-red-500">*</span>
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                required
                className="w-full rounded-lg border border-[#E5EAF2] bg-white px-3 py-2 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#071832] mb-1">
                Details <span className="text-red-500">*</span>
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required
                rows={5}
                className="w-full rounded-lg border border-[#E5EAF2] bg-[#F8F9FB] px-3 py-2 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                placeholder="Briefly describe what you'd like us to do. For corrections, tell us what's wrong and what it should be."
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#1677FF] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Submit request"}
            </button>

            <p className="text-[10px] text-[#4F5F73] text-center">
              Prefer email? Send to{" "}
              <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">
                admin@getquarterback.com
              </a>
              .
            </p>
          </form>
        )}
      </div>
      <LegalFooter mode="light" />
    </div>
  );
}
