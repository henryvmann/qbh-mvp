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
    <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#8B9D83]">
            Quarterback AI
          </div>

          <h1
            className="mt-4 text-4xl tracking-tight"
            style={{ fontFamily: "Playfair Display, ui-serif, serif" }}
          >
            Welcome back
          </h1>

          {mode === "magic" ? (
            sent ? (
              <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <div className="text-sm font-medium text-neutral-900">
                  Check your email
                </div>
                <div className="mt-1 text-sm text-neutral-600">
                  We sent a sign-in link to <strong>{email}</strong>. Click the
                  link to access your dashboard.
                </div>
              </div>
            ) : (
              <>
                <p className="mt-3 text-base text-neutral-600">
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
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#8B9D83] focus:outline-none focus:ring-1 focus:ring-[#8B9D83]"
                  />

                  <button
                    type="submit"
                    disabled={submitting || !email.trim()}
                    className="w-full rounded-2xl bg-[#8B9D83] px-6 py-3 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Sending..." : "Send sign-in link"}
                  </button>

                  {error ? (
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                      {error}
                    </div>
                  ) : null}
                </form>

                <button
                  type="button"
                  onClick={() => { setMode("password"); setError(null); }}
                  className="mt-6 text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-700"
                >
                  Sign in with password instead
                </button>
              </>
            )
          ) : (
            <>
              <p className="mt-3 text-base text-neutral-600">
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
                  className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#8B9D83] focus:outline-none focus:ring-1 focus:ring-[#8B9D83]"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#8B9D83] focus:outline-none focus:ring-1 focus:ring-[#8B9D83]"
                />

                <button
                  type="submit"
                  disabled={submitting || !email.trim() || !password.trim()}
                  className="w-full rounded-2xl bg-[#8B9D83] px-6 py-3 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Signing in..." : "Sign in"}
                </button>

                {error ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                    {error}
                  </div>
                ) : null}
              </form>

              {!isNative ? (
                <button
                  type="button"
                  onClick={() => { setMode("magic"); setError(null); }}
                  className="mt-6 text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-700"
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
