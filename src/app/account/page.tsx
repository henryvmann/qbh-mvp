"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
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
  const [editingInsurance, setEditingInsurance] = useState(false);
  const [editInsProvider, setEditInsProvider] = useState("");
  const [editMemberId, setEditMemberId] = useState("");
  const [savingInsurance, setSavingInsurance] = useState(false);

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

  // 2FA / MFA. Supabase Auth ships TOTP support out of the box; this
  // section enrolls a single TOTP factor per user. Once verified, the
  // login flow elevates to AAL2 and prompts for the 6-digit code.
  type MfaFactor = { id: string; status: string; friendly_name?: string | null };
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[] | null>(null);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaEnrollSecret, setMfaEnrollSecret] = useState<string | null>(null);
  const [mfaEnrollUri, setMfaEnrollUri] = useState<string | null>(null);
  const [mfaEnrollFactorId, setMfaEnrollFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaWorking, setMfaWorking] = useState(false);

  async function refreshMfaFactors() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setMfaError(error.message);
      return;
    }
    setMfaFactors((data?.totp ?? []) as MfaFactor[]);
  }

  async function startMfaEnrollment() {
    setMfaError(null);
    setMfaWorking(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Quarterback Health",
      });
      if (error) throw error;
      setMfaEnrollFactorId(data.id);
      setMfaEnrollSecret(data.totp.secret);
      setMfaEnrollUri(data.totp.uri);
      setMfaEnrolling(true);
    } catch (e) {
      setMfaError(e instanceof Error ? e.message : "Couldn't start 2FA setup.");
    } finally {
      setMfaWorking(false);
    }
  }

  async function verifyMfaEnrollment() {
    if (!mfaEnrollFactorId || mfaCode.trim().length !== 6) return;
    setMfaError(null);
    setMfaWorking(true);
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId: mfaEnrollFactorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId: mfaEnrollFactorId,
        challengeId: challenge.data.id,
        code: mfaCode.trim(),
      });
      if (verify.error) throw verify.error;
      setMfaEnrolling(false);
      setMfaEnrollSecret(null);
      setMfaEnrollUri(null);
      setMfaEnrollFactorId(null);
      setMfaCode("");
      await refreshMfaFactors();
    } catch (e) {
      setMfaError(e instanceof Error ? e.message : "Couldn't verify code.");
    } finally {
      setMfaWorking(false);
    }
  }

  async function cancelMfaEnrollment() {
    if (!mfaEnrollFactorId) {
      setMfaEnrolling(false);
      return;
    }
    try {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: mfaEnrollFactorId });
    } catch {}
    setMfaEnrolling(false);
    setMfaEnrollSecret(null);
    setMfaEnrollUri(null);
    setMfaEnrollFactorId(null);
    setMfaCode("");
    setMfaError(null);
  }

  async function disableMfaFactor(factorId: string) {
    if (!window.confirm("Disable two-factor authentication?")) return;
    setMfaWorking(true);
    setMfaError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await refreshMfaFactors();
    } catch (e) {
      setMfaError(e instanceof Error ? e.message : "Couldn't disable 2FA.");
    } finally {
      setMfaWorking(false);
    }
  }

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
    refreshMfaFactors().catch(() => {});
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
      <PageShell><div /></PageShell>
    );
  }

  return (
    <PageShell>
      
      <div className="mx-auto max-w-2xl px-5 pt-8 pb-20">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-3xl tracking-tighter font-medium text-[#071832]">
            Account
          </h1>
          <button
            type="button"
            onClick={async () => {
              try {
                const supabase = createClient();
                await supabase.auth.signOut();
              } finally {
                window.location.href = "/";
              }
            }}
            className="rounded-xl border border-[#E5EAF2] bg-white px-4 py-2 text-sm font-semibold text-[#071832] transition hover:border-[#1677FF] hover:text-[#1677FF]"
          >
            Log out
          </button>
        </div>

        {/* Personal Info */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#E5EAF2] mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#1677FF] mb-4">
            Personal Information
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#4F5F73]">Name</span>
              <span className="text-sm font-medium text-[#071832]">
                {fullName || userName || "Not set"}
              </span>
            </div>
            <div className="h-px bg-[#E5EAF2]" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#4F5F73]">Email</span>
              <span className="text-sm font-medium text-[#071832]">
                {email || "Not set"}
              </span>
            </div>
          </div>
        </div>

        {/* Connected Services */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#E5EAF2] mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#1677FF] mb-4">
            Connected Services
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#071832]">Google Calendar</span>
              {hasGoogleCalendar ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                  Connected
                </span>
              ) : (
                <Link
                  href="/calendar-connect"
                  className="text-xs font-medium text-[#1677FF] underline underline-offset-4"
                >
                  Connect
                </Link>
              )}
            </div>
            <div className="h-px bg-[#E5EAF2]" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#071832]">Outlook Calendar</span>
              <Link
                href="/calendar-connect"
                className="text-xs font-medium text-[#1677FF] underline underline-offset-4"
              >
                Connect
              </Link>
            </div>
          </div>
        </div>

        {/* Insurance Info — editable */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#E5EAF2] mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#1677FF]">
              Insurance
            </h2>
            {!editingInsurance && (
              <button
                onClick={() => {
                  setEditInsProvider(insuranceProvider || "");
                  setEditMemberId(memberId || "");
                  setEditingInsurance(true);
                }}
                className="text-xs text-[#1677FF] underline underline-offset-2"
              >
                Edit
              </button>
            )}
          </div>
          {editingInsurance ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#4F5F73] mb-1">Insurance Provider</label>
                <input
                  type="text"
                  value={editInsProvider}
                  onChange={(e) => setEditInsProvider(e.target.value)}
                  placeholder="Start typing your insurance..."
                  autoComplete="off"
                  className="w-full rounded-xl bg-[#F0F2F5] border border-[#E5EAF2] px-4 py-2.5 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                />
                {editInsProvider.trim().length >= 2 && (() => {
                  const matches = ["Aetna","Anthem","Blue Cross Blue Shield","Cigna","Humana","Kaiser Permanente","Medicare","Medicaid","Molina Healthcare","Oscar Health","Oxford","United Healthcare","WellCare","Ambetter","Centene","CareFirst","EmblemHealth","Florida Blue","Highmark","Horizon BCBS","Independence Blue Cross","TRICARE"]
                    .filter((ins) => ins.toLowerCase().includes(editInsProvider.trim().toLowerCase()));
                  if (matches.length === 0 || matches.some((m) => m.toLowerCase() === editInsProvider.trim().toLowerCase())) return null;
                  return (
                    <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-[#E5EAF2] bg-white divide-y divide-[#E5EAF2]">
                      {matches.slice(0, 5).map((ins) => (
                        <button key={ins} type="button" onClick={() => setEditInsProvider(ins)} className="w-full px-3 py-2 text-left text-sm text-[#071832] hover:bg-[#F8F9FA] transition">
                          {ins}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="block text-xs text-[#4F5F73] mb-1">Member / Policy ID</label>
                <input
                  type="text"
                  value={editMemberId}
                  onChange={(e) => setEditMemberId(e.target.value)}
                  placeholder="Found on your insurance card"
                  className="w-full rounded-xl bg-[#F0F2F5] border border-[#E5EAF2] px-4 py-2.5 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setSavingInsurance(true);
                    try {
                      await apiFetch("/api/patient-profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          profile: {
                            insurance_provider: editInsProvider.trim() || null,
                            insurance_member_id: editMemberId.trim() || null,
                          },
                        }),
                      });
                      setInsuranceProvider(editInsProvider.trim() || null);
                      setMemberId(editMemberId.trim() || null);
                      setEditingInsurance(false);
                    } finally {
                      setSavingInsurance(false);
                    }
                  }}
                  disabled={savingInsurance}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#1677FF" }}
                >
                  {savingInsurance ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setEditingInsurance(false)}
                  className="rounded-xl px-4 py-2 text-xs text-[#4F5F73] hover:bg-[#F0F2F5]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : insuranceProvider || memberId ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#4F5F73]">Provider</span>
                <span className="text-sm font-medium text-[#071832]">
                  {insuranceProvider || "Not set"}
                </span>
              </div>
              <div className="h-px bg-[#E5EAF2]" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#4F5F73]">Member ID</span>
                <span className="text-sm font-medium text-[#071832]">
                  {memberId || "Not set"}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-[#4F5F73]">No insurance on file.</p>
              <button
                onClick={() => setEditingInsurance(true)}
                className="mt-2 text-xs font-semibold text-[#1677FF] underline underline-offset-2"
              >
                Add Insurance
              </button>
            </div>
          )}
        </div>

        {/* Care & Settings — links to the existing dedicated pages.
            Surfacing them here makes /account a real "You" hub instead
            of just a profile-edit page. */}
        <div className="rounded-2xl bg-white shadow-sm border border-[#E5EAF2] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#1677FF] mb-4">
            Care & Settings
          </h2>
          <div className="divide-y divide-[#E5EAF2]">
            {[
              { href: "/care-recipients", label: "Care recipients", sub: "Who you're managing care for" },
              { href: "/providers", label: "Care team", sub: "Doctors, dentists, specialists" },
              { href: "/documents", label: "Documents & labs", sub: "Uploads, imports, history" },
              { href: "/billing", label: "Plan & billing", sub: "Subscription and payment method" },
              { href: "/settings", label: "Notifications & preferences", sub: "Quiet hours, Kate focus areas" },
            ].map((row) => (
              <Link
                key={row.href}
                href={row.href}
                className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0 hover:bg-[#FAFBFC] -mx-6 px-6 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#071832]">{row.label}</div>
                  <div className="text-xs text-[#4F5F73] mt-0.5">{row.sub}</div>
                </div>
                <span className="text-[#4F5F73] text-lg leading-none">›</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Trust card — exact copy from the v5 design spec. */}
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: "rgba(167,199,231,0.22)" }}
        >
          <div className="text-base font-serif font-medium text-[#0F2A44] mb-1">
            Your data is yours.
          </div>
          <div className="text-sm text-[#5A6675] leading-relaxed">
            QBH works for you. Nothing leaves without your say-so.
          </div>
        </div>

        {/* Two-factor authentication */}
        <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#E5EAF2] mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#1677FF]">
              Two-factor authentication
            </h2>
            {mfaFactors && mfaFactors.some((f) => f.status === "verified") && (
              <span className="text-xs font-semibold text-[#27C46B]">Enabled</span>
            )}
          </div>
          <p className="text-xs text-[#4F5F73] mb-4 leading-relaxed">
            Adds a 6-digit code from your phone&rsquo;s authenticator app on
            top of your password. Recommended for healthcare data.
          </p>

          {!mfaFactors ? (
            <div className="text-sm text-[#4F5F73]">Loading…</div>
          ) : mfaFactors.some((f) => f.status === "verified") ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#071832]">Two-factor is on for this account.</span>
              <button
                type="button"
                onClick={() =>
                  disableMfaFactor(
                    mfaFactors.find((f) => f.status === "verified")!.id
                  )
                }
                disabled={mfaWorking}
                className="text-xs font-semibold underline underline-offset-2 text-[#E04030] hover:opacity-80 disabled:opacity-50"
              >
                Disable
              </button>
            </div>
          ) : !mfaEnrolling ? (
            <button
              type="button"
              onClick={startMfaEnrollment}
              disabled={mfaWorking}
              className="rounded-xl bg-[#1677FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
            >
              {mfaWorking ? "Setting up…" : "Enable two-factor"}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#071832]">
                Open your authenticator app (1Password, Authy, Google
                Authenticator, etc.) and add this account.
              </p>
              {mfaEnrollUri && (
                <a
                  href={mfaEnrollUri}
                  className="block rounded-lg border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-2 text-xs font-medium text-[#1677FF] underline break-all"
                >
                  Tap here on phone to add to authenticator
                </a>
              )}
              {mfaEnrollSecret && (
                <div className="rounded-lg border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#4F5F73] mb-1">
                    Or enter this secret manually
                  </div>
                  <div className="text-sm font-mono text-[#071832] break-all select-all">
                    {mfaEnrollSecret}
                  </div>
                </div>
              )}
              <div>
                <label
                  htmlFor="mfa-code"
                  className="block text-[10px] font-bold uppercase tracking-wider text-[#4F5F73] mb-1"
                >
                  6-digit code from your authenticator
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full rounded-xl border border-[#E5EAF2] bg-white px-4 py-2.5 text-base font-mono text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={verifyMfaEnrollment}
                  disabled={mfaWorking || mfaCode.trim().length !== 6}
                  className="rounded-xl bg-[#1677FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
                >
                  {mfaWorking ? "Verifying…" : "Verify and enable"}
                </button>
                <button
                  type="button"
                  onClick={cancelMfaEnrollment}
                  disabled={mfaWorking}
                  className="text-xs font-semibold text-[#4F5F73] hover:text-[#071832] underline underline-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {mfaError && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {mfaError}
            </div>
          )}
        </div>

        {/* Password Section (collapsible) */}
        <div className="rounded-2xl bg-white shadow-sm border border-[#E5EAF2]">
          <button
            type="button"
            onClick={() => setPasswordOpen(!passwordOpen)}
            className="flex w-full items-center justify-between p-6 text-left"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#1677FF]">
              Password
            </h2>
            <svg
              className={`h-4 w-4 text-[#4F5F73] transition-transform ${passwordOpen ? "rotate-180" : ""}`}
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
              <p className="text-sm text-[#4F5F73] mb-4">
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
                    className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-4 py-3 text-sm text-[#071832] placeholder:text-[#4F5F73] focus:border-[#1677FF] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                  />

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    required
                    className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-4 py-3 text-sm text-[#071832] placeholder:text-[#4F5F73] focus:border-[#1677FF] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                  />

                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Confirm password"
                    required
                    className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-4 py-3 text-sm text-[#071832] placeholder:text-[#4F5F73] focus:border-[#1677FF] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                  />

                  <button
                    type="submit"
                    disabled={submitting || !currentPassword.trim() || !password.trim() || !confirm.trim()}
                    className="w-full rounded-xl px-6 py-3 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ background: "#1677FF", boxShadow: "0 8px 24px rgba(22,119,255,0.28)" }}
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
            className="text-xs text-[#4F5F73] underline underline-offset-4 hover:text-red-500 transition"
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
              <h3 className="text-lg font-semibold text-[#071832]">Are you sure?</h3>
            </div>
            <p className="text-sm text-[#4F5F73] mb-4">
              This action is irreversible. All your data, providers, call history, and profile information will be permanently deleted.
            </p>
            <p className="text-sm font-medium text-[#071832] mb-2">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-4 py-3 text-sm text-[#071832] placeholder:text-[#4F5F73] focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
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
                className="flex-1 rounded-xl border border-[#E5EAF2] px-4 py-2.5 text-sm font-medium text-[#4F5F73] hover:bg-[#F0F2F5] transition-colors"
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
    </PageShell>
  );
}
