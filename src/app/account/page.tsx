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
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#5C6B5C]">
              Quarterback AI
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-[#B0B4BC] underline underline-offset-4 hover:text-[#7A7F8A]"
            >
              Back to dashboard
            </Link>
          </div>

          <h1 className="mt-4 text-4xl tracking-tight">
            Set a password
          </h1>

          <p className="mt-3 text-base text-[#7A7F8A]">
            Once set, you can sign in with your email and password instead of a
            magic link.
          </p>

          {done ? (
            <div className="mt-8 rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
              <div className="text-sm font-medium text-[#1A1D2E]">
                Password set
              </div>
              <div className="mt-1 text-sm text-[#7A7F8A]">
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
                className="w-full rounded-2xl border border-[#EBEDF0] bg-[#F0F2F5] px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
              />

              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                required
                className="w-full rounded-2xl border border-[#EBEDF0] bg-[#F0F2F5] px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
              />

              <button
                type="submit"
                disabled={submitting || !password.trim() || !confirm.trim()}
                className="w-full rounded-2xl px-6 py-3 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)", boxShadow: "0 8px 24px rgba(92,107,92,0.35)" }}
              >
                {submitting ? "Saving..." : "Set password"}
              </button>

              {error ? (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
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
