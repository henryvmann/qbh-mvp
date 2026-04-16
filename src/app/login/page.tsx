"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      window.location.href = "/dashboard";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full border border-[#EBEDF0]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: "#5C6B5C" }}
          >
            Quarterback AI
          </div>

          <h1 className="mt-4 text-3xl font-light tracking-tight">
            Welcome back
          </h1>

          <p className="mt-3 text-base text-[#7A7F8A]">
            Sign in with your email and password.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="w-full rounded-xl border border-[#EBEDF0] bg-white shadow-sm px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full rounded-xl border border-[#EBEDF0] bg-white shadow-sm px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
            />

            <button
              type="submit"
              disabled={submitting || !email.trim() || !password.trim()}
              className="w-full rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)", boxShadow: "0 8px 24px rgba(92,107,92,0.35)" }}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>

            {error ? (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
                {error}
              </div>
            ) : null}
          </form>

          <div className="mt-8 text-center text-sm text-[#B0B4BC]">
            New here?{" "}
            <a
              href="/onboarding"
              className="underline underline-offset-4 hover:text-[#7A7F8A]"
              style={{ color: "#5C6B5C" }}
            >
              Get started
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
