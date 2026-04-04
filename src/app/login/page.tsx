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
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1A1D23] text-[#F0F2F5]">
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full border border-white/10"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: "#7BA59A" }}
          >
            Quarterback AI
          </div>

          <h1 className="mt-4 text-3xl font-light tracking-tight">
            Welcome back
          </h1>

          <p className="mt-3 text-base text-[#8A9BAE]">
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
              className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-[#F0F2F5] placeholder:text-[#3D526B] focus:border-[#7BA59A] focus:outline-none focus:ring-1 focus:ring-[#7BA59A]"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-[#F0F2F5] placeholder:text-[#3D526B] focus:border-[#7BA59A] focus:outline-none focus:ring-1 focus:ring-[#7BA59A]"
            />

            <button
              type="submit"
              disabled={submitting || !email.trim() || !password.trim()}
              className="w-full rounded-xl px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: "#7BA59A", color: "#1A1D23" }}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>

            {error ? (
              <div className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
                {error}
              </div>
            ) : null}
          </form>

          <div className="mt-8 text-center text-sm text-[#4D6480]">
            New here?{" "}
            <a
              href="/onboarding"
              className="underline underline-offset-4 hover:text-[#8A9BAE]"
              style={{ color: "#7BA59A" }}
            >
              Get started
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
