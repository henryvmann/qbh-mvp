"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { Capacitor } from "@capacitor/core";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isNative = Capacitor.isNativePlatform();
  const [mode, setMode] = useState<"magic" | "password">(isNative ? "password" : "magic");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send link.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
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
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080C14] text-[#EFF4FF]">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#5DE8C5]">
            Quarterback AI
          </div>

          <h1 className="mt-4 text-4xl tracking-tight">
            Welcome back
          </h1>

          {mode === "magic" ? (
            sent ? (
              <div className="mt-8 rounded-2xl bg-[#0F1520] p-6 ring-1 ring-white/8">
                <div className="text-sm font-medium text-[#EFF4FF]">
                  Check your email
                </div>
                <div className="mt-1 text-sm text-[#6B85A8]">
                  We sent a sign-in link to <strong className="text-[#EFF4FF]">{email}</strong>. Click the
                  link to access your dashboard.
                </div>
              </div>
            ) : (
              <>
                <p className="mt-3 text-base text-[#6B85A8]">
                  Enter your email and we'll send you a sign-in link.
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
                    disabled={submitting || !email.trim()}
                    className="w-full rounded-2xl bg-[#5DE8C5] px-6 py-3 text-sm font-medium text-[#080C14] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Sending..." : "Send sign-in link"}
                  </button>

                  {error ? (
                    <div className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
                      {error}
                    </div>
                  ) : null}
                </form>

                <button
                  type="button"
                  onClick={() => { setMode("password"); setError(null); }}
                  className="mt-6 text-sm text-[#4D6480] underline underline-offset-4 hover:text-[#6B85A8]"
                >
                  Sign in with password instead
                </button>
              </>
            )
          ) : (
            <>
              <p className="mt-3 text-base text-[#6B85A8]">
                Sign in with your email and password.
              </p>

              <form onSubmit={handlePassword} className="mt-8 space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="w-full rounded-2xl border border-white/10 bg-[#162030] px-4 py-3 text-sm text-[#EFF4FF] placeholder:text-[#3D526B] focus:border-[#5DE8C5] focus:outline-none focus:ring-1 focus:ring-[#5DE8C5]"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#162030] px-4 py-3 text-sm text-[#EFF4FF] placeholder:text-[#3D526B] focus:border-[#5DE8C5] focus:outline-none focus:ring-1 focus:ring-[#5DE8C5]"
                />

                <button
                  type="submit"
                  disabled={submitting || !email.trim() || !password.trim()}
                  className="w-full rounded-2xl bg-[#5DE8C5] px-6 py-3 text-sm font-medium text-[#080C14] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Signing in..." : "Sign in"}
                </button>

                {error ? (
                  <div className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
                    {error}
                  </div>
                ) : null}
              </form>

              {!isNative ? (
                <button
                  type="button"
                  onClick={() => { setMode("magic"); setError(null); }}
                  className="mt-6 text-sm text-[#4D6480] underline underline-offset-4 hover:text-[#6B85A8]"
                >
                  Send a magic link instead
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
