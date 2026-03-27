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
    <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#8B9D83]">
              Quarterback AI
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-700"
            >
              Back to dashboard
            </Link>
          </div>

          <h1
            className="mt-4 text-4xl tracking-tight"
            style={{ fontFamily: "Playfair Display, ui-serif, serif" }}
          >
            Set a password
          </h1>

          <p className="mt-3 text-base text-neutral-600">
            Once set, you can sign in with your email and password instead of a
            magic link.
          </p>

          {done ? (
            <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="text-sm font-medium text-neutral-900">
                Password set
              </div>
              <div className="mt-1 text-sm text-neutral-600">
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
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#8B9D83] focus:outline-none focus:ring-1 focus:ring-[#8B9D83]"
              />

              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                required
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#8B9D83] focus:outline-none focus:ring-1 focus:ring-[#8B9D83]"
              />

              <button
                type="submit"
                disabled={submitting || !password.trim() || !confirm.trim()}
                className="w-full rounded-2xl bg-[#8B9D83] px-6 py-3 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Set password"}
              </button>

              {error ? (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
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
