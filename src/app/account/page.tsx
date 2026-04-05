"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

export default function AccountPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#1E2228] text-[#F0F2F5]">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#7BA59A]">
              Quarterback AI
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-[#4D6480] underline underline-offset-4 hover:text-[#8A9BAE]"
            >
              Back to dashboard
            </Link>
          </div>

          <h1 className="mt-4 text-4xl tracking-tight">
            Set a password
          </h1>

          <p className="mt-3 text-base text-[#8A9BAE]">
            Once set, you can sign in with your email and password instead of a
            magic link.
          </p>

          {done ? (
            <div className="mt-8 rounded-2xl bg-white/5 p-6 ring-1 ring-white/8">
              <div className="text-sm font-medium text-[#F0F2F5]">
                Password set
              </div>
              <div className="mt-1 text-sm text-[#8A9BAE]">
                You can now sign in with your email and password.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                required
                autoFocus
                className="w-full rounded-2xl border border-white/10 bg-[#162030] px-4 py-3 text-sm text-[#F0F2F5] placeholder:text-[#3D526B] focus:border-[#7BA59A] focus:outline-none focus:ring-1 focus:ring-[#7BA59A]"
              />

              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                required
                className="w-full rounded-2xl border border-white/10 bg-[#162030] px-4 py-3 text-sm text-[#F0F2F5] placeholder:text-[#3D526B] focus:border-[#7BA59A] focus:outline-none focus:ring-1 focus:ring-[#7BA59A]"
              />

              <button
                type="submit"
                disabled={submitting || !password.trim() || !confirm.trim()}
                className="w-full rounded-2xl bg-[#7BA59A] px-6 py-3 text-sm font-medium text-[#1E2228] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Set password"}
              </button>

              {error ? (
                <div className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
                  {error}
                </div>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
