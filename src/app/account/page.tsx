"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import { apiFetch } from "../../lib/api";
import TopNav from "../../components/qbh/TopNav";
import { AlertTriangle } from "lucide-react";

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // User info
  const [userName, setUserName] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // Calendar connections
  const [hasGoogleCalendar, setHasGoogleCalendar] = useState(false);

  // Insurance / patient profile
  const [insuranceProvider, setInsuranceProvider] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  // Password section
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Get email from supabase auth
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) setEmail(user.email);

        // Fetch dashboard data for name and calendar status
        const dashRes = await apiFetch("/api/dashboard/data");
        if (dashRes.status === 401) { router.push("/login"); return; }
        const dashJson = await dashRes.json();
        if (dashJson?.ok) {
          setUserName(dashJson.userName || null);
          setFullName(dashJson.fullName || null);
          setHasGoogleCalendar(!!dashJson.hasGoogleCalendarConnection);
        }

        // Fetch patient profile for insurance
        const profRes = await apiFetch("/api/patient-profile");
        if (profRes.ok) {
          const profJson = await profRes.json();
          if (profJson?.ok && profJson.profile) {
            const p = profJson.profile;
            setInsuranceProvider(p.insurance_provider || p.insuranceProvider || null);
            setMemberId(p.member_id || p.memberId || null);
          }
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    if (!currentPassword.trim()) {
      setError("Please enter your current password.");
      return;
    }

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

      // Verify current password first
      if (!email) {
        setError("Unable to verify current password. Email not found.");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) {
        setError("Current password is incorrect.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;
      setDone(true);
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <TopNav />
      <div className="mx-auto max-w-2xl px-5 pt-8 pb-20">
        <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E] mb-8">
          Account
        </h1>

        {/* Personal Info */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#5C6B5C] mb-4">
            Personal Information
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#7A7F8A]">Name</span>
              <span className="text-sm font-medium text-[#1A1D2E]">
                {fullName || userName || "Not set"}
              </span>
            </div>
            <div className="h-px bg-[#EBEDF0]" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#7A7F8A]">Email</span>
              <span className="text-sm font-medium text-[#1A1D2E]">
                {email || "Not set"}
              </span>
            </div>
          </div>
        </div>

        {/* Connected Services */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#5C6B5C] mb-4">
            Connected Services
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#1A1D2E]">Google Calendar</span>
              {hasGoogleCalendar ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                  Connected
                </span>
              ) : (
                <Link
                  href="/calendar-connect"
                  className="text-xs font-medium text-[#5C6B5C] underline underline-offset-4"
                >
                  Connect
                </Link>
              )}
            </div>
            <div className="h-px bg-[#EBEDF0]" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#1A1D2E]">Outlook Calendar</span>
              <Link
                href="/calendar-connect"
                className="text-xs font-medium text-[#5C6B5C] underline underline-offset-4"
              >
                Connect
              </Link>
            </div>
          </div>
        </div>

        {/* Insurance Info */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0] mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#5C6B5C] mb-4">
            Insurance
          </h2>
          {insuranceProvider || memberId ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#7A7F8A]">Provider</span>
                <span className="text-sm font-medium text-[#1A1D2E]">
                  {insuranceProvider || "Not set"}
                </span>
              </div>
              <div className="h-px bg-[#EBEDF0]" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#7A7F8A]">Member ID</span>
                <span className="text-sm font-medium text-[#1A1D2E]">
                  {memberId || "Not set"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#7A7F8A]">
              No insurance information on file. You can add this through your health profile or by talking to Kate.
            </p>
          )}
        </div>

        {/* Password Section (collapsible) */}
        <div className="rounded-2xl bg-white shadow-sm border border-[#EBEDF0]">
          <button
            type="button"
            onClick={() => setPasswordOpen(!passwordOpen)}
            className="flex w-full items-center justify-between p-6 text-left"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#5C6B5C]">
              Password
            </h2>
            <svg
              className={`h-4 w-4 text-[#7A7F8A] transition-transform ${passwordOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {passwordOpen && (
            <div className="px-6 pb-6">
              <p className="text-sm text-[#7A7F8A] mb-4">
                Set a password to sign in with your email and password instead of a magic link.
              </p>

              {done ? (
                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
                  Password updated successfully.
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    required
                    className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  />

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    required
                    className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  />

                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Confirm password"
                    required
                    className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-[#5C6B5C] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                  />

                  <button
                    type="submit"
                    disabled={submitting || !currentPassword.trim() || !password.trim() || !confirm.trim()}
                    className="w-full rounded-xl px-6 py-3 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
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
          )}
        </div>

        {/* Delete Account — subtle, at the bottom */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="text-xs text-[#B0B4BC] underline underline-offset-4 hover:text-red-500 transition"
          >
            Delete my account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h3 className="text-lg font-semibold text-[#1A1D2E]">Are you sure?</h3>
            </div>
            <p className="text-sm text-[#7A7F8A] mb-4">
              This action is irreversible. All your data, providers, call history, and profile information will be permanently deleted.
            </p>
            <p className="text-sm font-medium text-[#1A1D2E] mb-2">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
            />

            {deleteError && (
              <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
                {deleteError}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                  setDeleteError(null);
                }}
                className="flex-1 rounded-xl border border-[#EBEDF0] px-4 py-2.5 text-sm font-medium text-[#7A7F8A] hover:bg-[#F0F2F5] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== "DELETE" || deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    const res = await apiFetch("/api/account/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ confirm: true }),
                    });
                    const data = await res.json();
                    if (!res.ok || !data?.ok) {
                      throw new Error(data?.error || "Failed to delete account.");
                    }
                    // Sign out and redirect
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    router.push("/");
                  } catch (err) {
                    setDeleteError(err instanceof Error ? err.message : "Failed to delete account.");
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
              >
                {deleting ? "Deleting..." : "Permanently delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
