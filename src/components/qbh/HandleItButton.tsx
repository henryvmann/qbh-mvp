// src/components/qbh/HandleItButton.tsx
"use client";

import * as React from "react";
import { apiFetch } from "../../lib/api";
import WhyWeAsk from "./WhyWeAsk";

type Props = {
  userId?: string | null;
  providerId: string;
  providerName?: string | null;
  phoneNumber?: string | null;
  attemptId?: number | null;
  label?: string;
};

type PatientProfile = {
  full_name?: string | null;
  date_of_birth?: string | null;
  insurance_provider?: string | null;
  insurance_member_id?: string | null;
  callback_phone?: string | null;
};

function isProfileComplete(p: PatientProfile): boolean {
  return !!(
    p.full_name?.trim()?.includes(" ") &&
    p.date_of_birth?.trim() &&
    p.insurance_provider?.trim()
  );
}

export default function HandleItButton({
  userId,
  providerId,
  providerName,
  phoneNumber,
  attemptId,
  label = "Handle It",
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = React.useState(false);

  // Pre-call info collection
  const [showForm, setShowForm] = React.useState(false);
  const [profileChecked, setProfileChecked] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [insuranceProvider, setInsuranceProvider] = React.useState("");
  const [insuranceMemberId, setInsuranceMemberId] = React.useState("");
  const [callbackPhone, setCallbackPhone] = React.useState("");
  const [patientStatus, setPatientStatus] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function checkSubscriptionAndProceed() {
    if (loading) return;
    setToast(null);
    try {
      const res = await apiFetch("/api/dashboard/data");
      const data = await res.json();
      const status = data?.subscription_status;
      const freeCallsUsed = data?.free_calls_used || 0;
      if (status === "active" || status === "trialing") {
        checkProfileAndProceed();
      } else if (freeCallsUsed < 1) {
        // Allow one free call
        checkProfileAndProceed();
      } else {
        setShowUpgradePrompt(true);
      }
    } catch {
      // If check fails, let them proceed
      checkProfileAndProceed();
    }
  }

  async function checkProfileAndProceed() {
    if (loading) return;
    setToast(null);

    // If we already checked and profile is complete, go straight to call
    if (profileChecked) {
      startCall();
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch("/api/patient-profile");
      const data = await res.json();
      const profile: PatientProfile = data?.profile || {};

      if (isProfileComplete(profile)) {
        setProfileChecked(true);
        startCall();
      } else {
        // Pre-fill whatever we have
        setFullName(profile.full_name || "");
        setDob(profile.date_of_birth || "");
        setInsuranceProvider(profile.insurance_provider || "");
        setInsuranceMemberId(profile.insurance_member_id || "");
        setCallbackPhone(profile.callback_phone || "");
        setShowForm(true);
        setLoading(false);
      }
    } catch {
      // If profile check fails, still let them call
      setProfileChecked(true);
      startCall();
    }
  }

  async function handleFormSubmit() {
    setSaving(true);

    try {
      // Save profile
      await apiFetch("/api/patient-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            full_name: fullName.trim() || null,
            date_of_birth: dob.trim() || null,
            insurance_provider: insuranceProvider.trim() || null,
            insurance_member_id: insuranceMemberId.trim() || null,
            callback_phone: callbackPhone.trim() || null,
          },
          // Save patient status for this provider
          ...(patientStatus && providerId ? {
            provider_status: { provider_id: providerId, status: patientStatus },
          } : {}),
        }),
      });

      setProfileChecked(true);
      setShowForm(false);
      setSaving(false);

      // Now start the call
      startCall();
    } catch {
      setSaving(false);
      setToast({ kind: "error", text: "Failed to save — try again." });
    }
  }

  function handleSkip() {
    setProfileChecked(true);
    setShowForm(false);
    startCall();
  }

  async function startCall() {
    setLoading(true);
    setToast(null);

    try {
      const body = {
        ...(userId ? { app_user_id: userId } : {}),
        provider_id: providerId,
        ...(providerName ? { provider_name: providerName } : {}),
        ...(phoneNumber ? { office_number: phoneNumber } : {}),
        ...(attemptId ? { attempt_id: attemptId } : {}),
      };

      const res = await apiFetch("/api/vapi/start-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const ct = res.headers.get("content-type") || "";
      const payload = ct.includes("application/json")
        ? await res.json().catch(() => null)
        : await res.text().catch(() => "");

      if (!res.ok) {
        const msg =
          (payload && (payload.error || payload.message)) ||
          (typeof payload === "string" ? payload : "") ||
          `Request failed (${res.status})`;
        setToast({ kind: "error", text: String(msg) });
        return;
      }

      const msg =
        (payload && (payload.message || payload.status)) ||
        "Queued — Kate is placing the call.";
      setToast({ kind: "ok", text: String(msg) });
    } catch (e: any) {
      setToast({ kind: "error", text: e?.message || "Network error" });
    } finally {
      setLoading(false);
      window.setTimeout(() => setToast(null), 3500);
    }
  }

  const inputClass =
    "w-full rounded-xl bg-white px-3 py-2.5 text-sm text-[#1A1D2E] border border-[#EBEDF0] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]";

  return (
    <div className="mt-4">
      {/* Pre-call info form */}
      {showForm && (
        <div className="mb-4 rounded-2xl border border-[#EBEDF0] bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-[#1A1D2E]">
            Before Kate calls
          </div>
          <div className="mt-1 text-xs text-[#7A7F8A]">
            The office will ask for these — it helps Kate book successfully.
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#7A7F8A]">
                Full name (first and last)
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jenny Mann"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#7A7F8A]">
                Date of birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className={inputClass}
              />
              <WhyWeAsk text="Offices verify your identity with this before scheduling" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#7A7F8A]">
                Insurance provider
              </label>
              <input
                type="text"
                value={insuranceProvider}
                onChange={(e) => setInsuranceProvider(e.target.value)}
                placeholder="e.g. Aetna, Blue Cross, UnitedHealthcare"
                className={inputClass}
              />
              <WhyWeAsk text="Kate will share this when booking so they can check coverage" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#7A7F8A]">
                Member ID <span className="text-[#B0B4BC]">(optional)</span>
              </label>
              <input
                type="text"
                value={insuranceMemberId}
                onChange={(e) => setInsuranceMemberId(e.target.value)}
                placeholder="Found on your insurance card"
                className={inputClass}
              />
              <WhyWeAsk text="Some offices need this upfront — others will ask at check-in" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#7A7F8A]">
                Your phone number
              </label>
              <input
                type="tel"
                value={callbackPhone}
                onChange={(e) => setCallbackPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className={inputClass}
              />
              <WhyWeAsk text="We share this with offices in case they need to reach you directly" />
            </div>

            {/* New/existing patient */}
            {providerName && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#7A7F8A]">
                  Have you visited this provider before?
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "existing", label: "Yes, existing patient" },
                    { value: "likely_new", label: "No, I'm new" },
                    { value: "unknown", label: "Not sure" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPatientStatus(opt.value)}
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition"
                      style={{
                        backgroundColor: patientStatus === opt.value ? "#5C6B5C" : "#F0F2F5",
                        color: patientStatus === opt.value ? "#FFFFFF" : "#7A7F8A",
                        border: `1px solid ${patientStatus === opt.value ? "#5C6B5C" : "#EBEDF0"}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <WhyWeAsk text="This helps Kate introduce you correctly to the office" />
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={saving || (!dob.trim() && !insuranceProvider.trim())}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)",
              }}
            >
              {saving ? "Saving..." : "Save & call"}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-xl border border-[#EBEDF0] px-4 py-2.5 text-sm text-[#7A7F8A] transition hover:bg-[#F0F2F5]"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Upgrade prompt for free users */}
      {showUpgradePrompt && (
        <div className="rounded-2xl border border-[#EBEDF0] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#1A1D2E]">You&apos;ve used your one free Kate call.</p>
          <p className="mt-1 text-xs text-[#7A7F8A]">
            Free accounts get one trial call to test out Kate. To have her keep scheduling for you, upgrade to Solo or Family.
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href="/billing"
              className="flex-1 rounded-xl py-2.5 text-center text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
            >
              View Plans
            </a>
            <button
              onClick={() => setShowUpgradePrompt(false)}
              className="rounded-xl px-4 py-2.5 text-sm text-[#7A7F8A] hover:text-[#1A1D2E]"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Main call button */}
      {!showForm && !showUpgradePrompt && (
        <button
          type="button"
          onClick={checkSubscriptionAndProceed}
          disabled={loading}
          className="group relative w-full overflow-hidden rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[0.98] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
        >
          <span className="relative z-10">
            {loading ? "One moment…" : label}
          </span>
          <span className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
            <span className="absolute -left-1/3 top-0 h-full w-1/2 rotate-12 bg-white/20 blur-xl" />
          </span>
        </button>
      )}

      {toast ? (
        <div
          className={
            "mt-2 rounded-xl px-3 py-2 text-xs shadow-sm " +
            (toast.kind === "ok"
              ? "bg-[#5C6B5C]/15 text-[#5C6B5C]"
              : "bg-amber-50 text-[#1A1D2E] border border-amber-200")
          }
        >
          {toast.kind === "error" && toast.text.toLowerCase().includes("name") ? (
            <span>
              Kate needs your full name to call. {" "}
              <a href="/settings" className="font-semibold text-[#5C6B5C] underline underline-offset-2">
                Add it in Settings →
              </a>
            </span>
          ) : toast.kind === "error" && (toast.text.toLowerCase().includes("profile") || toast.text.toLowerCase().includes("dob") || toast.text.toLowerCase().includes("insurance")) ? (
            <span>
              {toast.text} {" "}
              <a href="/settings" className="font-semibold text-[#5C6B5C] underline underline-offset-2">
                Update in Settings →
              </a>
            </span>
          ) : (
            toast.text
          )}
        </div>
      ) : null}
    </div>
  );
}
