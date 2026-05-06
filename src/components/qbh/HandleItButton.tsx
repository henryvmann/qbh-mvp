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
  const [fullName, setFullName] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [insuranceProvider, setInsuranceProvider] = React.useState("");
  const [insuranceMemberId, setInsuranceMemberId] = React.useState("");
  const [callbackPhone, setCallbackPhone] = React.useState("");
  const [patientStatus, setPatientStatus] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  // Per-booking specifics. These aren't saved to the profile — they're
  // passed to Kate as call-context for THIS booking only. Timing matters
  // a lot when the user already has a date in mind ("around next April,
  // not anytime soon"); reason helps Kate frame the request to the office.
  const [bookingTimeframe, setBookingTimeframe] = React.useState("");
  const [bookingTimeframePreset, setBookingTimeframePreset] = React.useState<string>("");
  const [bookingReason, setBookingReason] = React.useState("");
  // We always show the form on tap so the user can give per-booking
  // context. The profile-completeness gate then decides whether the
  // form is "lite" (just timing + reason) or "full" (also DOB / insurance).
  const [profileNeedsFilling, setProfileNeedsFilling] = React.useState(false);
  // Care recipient resolution. When a user manages multiple people
  // (Self + Partner + Child), the booking has to be FOR someone —
  // Kate can't dial a pediatrician using the parent's name. We:
  //  1. Load the user's care_recipients list from patient_profile
  //  2. Default to whichever recipient the provider is already tagged for
  //  3. Force pick when the provider has no tag and the user has 2+ recipients
  type CareRecipient = { id: string; name: string; relationship: string; dob?: string | null };
  const [careRecipients, setCareRecipients] = React.useState<CareRecipient[]>([]);
  const [bookingForName, setBookingForName] = React.useState<string | null>(null);
  const [providerCareRecipients, setProviderCareRecipients] = React.useState<string[]>([]);

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

    // Always show the form on every tap. Timing + reason are
    // per-booking — even if the user filled them once already this
    // session, the next booking is a new context. The profile-
    // completeness check only decides whether to also collapse-in
    // the DOB/insurance/patient-status fields.
    try {
      setLoading(true);
      const res = await apiFetch(
        providerId ? `/api/patient-profile?provider_id=${encodeURIComponent(providerId)}` : "/api/patient-profile"
      );
      const data = await res.json();
      const profile: PatientProfile & { care_recipients?: CareRecipient[] } =
        data?.profile || {};
      const providerVisitCount: number = typeof data?.provider_visit_count === "number" ? data.provider_visit_count : 0;
      const patientStatusKnown = providerVisitCount > 0;
      const profileIncomplete =
        !isProfileComplete(profile) || !patientStatusKnown;

      const recipients: CareRecipient[] = Array.isArray(profile.care_recipients) ? profile.care_recipients : [];
      setCareRecipients(recipients);

      // Pull provider's care_recipient tagging so we can default the
      // "Booking for" picker. Quick separate fetch — we already
      // have the provider id.
      let providerTagged: string[] = [];
      if (providerId) {
        try {
          const detailRes = await apiFetch(`/api/providers/detail?id=${encodeURIComponent(providerId)}`);
          const detail = await detailRes.json().catch(() => ({}));
          const raw = detail?.provider?.care_recipient;
          if (raw) {
            const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (Array.isArray(arr)) providerTagged = arr;
          }
        } catch {
          // best effort
        }
      }
      setProviderCareRecipients(providerTagged);

      // Default booking-for selection:
      //   • If the provider has exactly one tagged recipient → preselect it
      //   • Else if the user has only one care recipient → preselect it
      //   • Else → leave null and force the user to pick before submit
      let initialFor: string | null = null;
      if (providerTagged.length === 1) {
        initialFor = providerTagged[0];
      } else if (recipients.length === 1) {
        initialFor = recipients[0].name;
      } else if (recipients.length === 0) {
        initialFor = profile.full_name?.split(" ")[0] || null;
      }
      setBookingForName(initialFor);

      setFullName(profile.full_name || "");
      setDob(profile.date_of_birth || "");
      setInsuranceProvider(profile.insurance_provider || "");
      setInsuranceMemberId(profile.insurance_member_id || "");
      setCallbackPhone(profile.callback_phone || "");
      setProfileNeedsFilling(profileIncomplete);
      // Reset per-booking inputs so a previous booking's timing/reason
      // doesn't leak into this one.
      setBookingTimeframe("");
      setBookingTimeframePreset("");
      setBookingReason("");
      setPatientStatus(null);
      setShowForm(true);
      setLoading(false);
    } catch {
      // Profile fetch failed — still open the form (with profile
      // fields visible) instead of silently dialing. Failing to fetch
      // is rare; surfacing the form lets the user give context and
      // retry, and avoids the "tapped book, it just called" surprise.
      setProfileNeedsFilling(true);
      setBookingTimeframe("");
      setBookingTimeframePreset("");
      setBookingReason("");
      setPatientStatus(null);
      setBookingForName(null);
      setShowForm(true);
      setLoading(false);
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
    // "Cancel" — close the form and don't call. The user can re-tap
    // the button if they change their mind. (Used to call straight
    // through which surprised users who tapped Cancel by mistake.)
    setShowForm(false);
    setLoading(false);
  }

  function buildPreferredTimeframe(): string | null {
    // Prefer the free-text override if the user filled it in. Falls
    // back to the chip preset. Returns null if neither — start-call
    // will then fall back to profile.availability_*.
    const free = bookingTimeframe.trim();
    if (free) {
      return bookingTimeframePreset
        ? `${bookingTimeframePreset} (${free})`
        : free;
    }
    return bookingTimeframePreset || null;
  }

  async function startCall() {
    setLoading(true);
    setToast(null);

    try {
      const preferredTimeframe = buildPreferredTimeframe();
      const reasonForVisit = bookingReason.trim() || null;

      // Resolve who Kate is calling FOR. When the user picked a
      // care recipient (Wyatt, the child), pass their name + DOB
      // so Kate doesn't introduce the call as the parent. The Self
      // recipient is treated like the user — name/DOB pulled from
      // patient_profile by start-call.
      const selectedRecipient = bookingForName
        ? careRecipients.find((r) => r.name === bookingForName)
        : null;
      const isNonSelf =
        !!selectedRecipient && selectedRecipient.relationship !== "Self";

      const body: Record<string, unknown> = {
        ...(userId ? { app_user_id: userId } : {}),
        provider_id: providerId,
        ...(providerName ? { provider_name: providerName } : {}),
        ...(phoneNumber ? { office_number: phoneNumber } : {}),
        ...(attemptId ? { attempt_id: attemptId } : {}),
        ...(preferredTimeframe ? { preferred_timeframe: preferredTimeframe } : {}),
        ...(reasonForVisit ? { reason_for_visit: reasonForVisit } : {}),
        ...(bookingForName ? { booking_for_name: bookingForName } : {}),
        ...(isNonSelf
          ? {
              patient_name: selectedRecipient.name,
              ...(selectedRecipient.dob ? { patient_date_of_birth: selectedRecipient.dob } : {}),
            }
          : {}),
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
    "w-full rounded-xl bg-white px-3 py-2.5 text-sm text-[#071832] border border-[#E5EAF2] placeholder:text-[#4F5F73] focus:outline-none focus:ring-1 focus:ring-[#1677FF]";

  return (
    <div className="mt-4">
      {/* Pre-call info form */}
      {showForm && (
        <div className="mb-4 rounded-2xl border border-[#E5EAF2] bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-[#071832]">
            Before Kate calls
          </div>
          <div className="mt-1 text-xs text-[#4F5F73]">
            Anything specific Kate should mention or aim for? Skip what you don&apos;t need.
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {/* Booking-for picker — required when the user manages
                multiple people. Without this, Kate would call a
                pediatrician and introduce herself as the parent
                instead of "calling for [child's name]." */}
            {careRecipients.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#4F5F73]">
                  Who is this appointment for?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {careRecipients.map((r) => {
                    const selected = bookingForName === r.name;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setBookingForName(r.name)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium transition"
                        style={{
                          backgroundColor: selected ? "#1677FF" : "#F0F2F5",
                          color: selected ? "#FFFFFF" : "#4F5F73",
                          border: `1px solid ${selected ? "#1677FF" : "#E5EAF2"}`,
                        }}
                      >
                        {selected ? "✓ " : ""}{r.name}
                        {r.relationship && r.relationship !== "Self" && (
                          <span className="ml-1 opacity-70">· {r.relationship}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!bookingForName && (
                  <div className="mt-1 text-[11px] text-[#E04030]">
                    Pick who this appointment is for before Kate calls.
                  </div>
                )}
              </div>
            )}

            {/* Timing window — always shown. The user-driven case for this
                is "I want to book it now but it's not urgent — schedule
                for around April next year." Without this Kate just takes
                the next-available slot. */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#4F5F73]">
                When should Kate aim for?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "", label: "No preference" },
                  { value: "ASAP — next available", label: "ASAP" },
                  { value: "within 2 weeks", label: "Next 2 weeks" },
                  { value: "within 1 month", label: "Next month" },
                  { value: "within 3 months", label: "~3 months" },
                  { value: "around 6 months from now", label: "~6 months" },
                  { value: "around 12 months from now", label: "~1 year" },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setBookingTimeframePreset(opt.value)}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium transition"
                    style={{
                      backgroundColor: bookingTimeframePreset === opt.value ? "#1677FF" : "#F0F2F5",
                      color: bookingTimeframePreset === opt.value ? "#FFFFFF" : "#4F5F73",
                      border: `1px solid ${bookingTimeframePreset === opt.value ? "#1677FF" : "#E5EAF2"}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={bookingTimeframe}
                onChange={(e) => setBookingTimeframe(e.target.value)}
                placeholder="Or describe — e.g. 'around April 2027' or 'after the holidays'"
                className={`${inputClass} mt-2`}
              />
            </div>

            {/* Reason / specifics — always shown. Helps Kate frame the
                ask ("annual checkup" vs "follow-up on rash" vs "just
                booking ahead, no urgent issues"). */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[#4F5F73]">
                What&apos;s this visit for? <span className="text-[#4F5F73]">(optional)</span>
              </label>
              <textarea
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value)}
                placeholder="e.g. annual checkup, no urgent issues — booking ahead"
                rows={2}
                className={`${inputClass} resize-none`}
              />
              <WhyWeAsk text="Kate uses this when introducing your reason to the office." />
            </div>

            {/* Profile fields below are only shown when missing — once
                a profile is complete and we know patient_status for
                this provider, the user goes straight to the timing/
                reason fields. */}
            {profileNeedsFilling && (
              <>
                <div className="mt-2 border-t border-[#E5EAF2] pt-3 text-xs text-[#4F5F73]">
                  We&apos;ll also need a few one-time details so the office can verify you.
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4F5F73]">
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
                  <label className="mb-1 block text-xs font-medium text-[#4F5F73]">
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
                  <label className="mb-1 block text-xs font-medium text-[#4F5F73]">
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
                  <label className="mb-1 block text-xs font-medium text-[#4F5F73]">
                    Member ID <span className="text-[#4F5F73]">(optional)</span>
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
                  <label className="mb-1 block text-xs font-medium text-[#4F5F73]">
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

                {providerName && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#4F5F73]">
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
                            backgroundColor: patientStatus === opt.value ? "#1677FF" : "#F0F2F5",
                            color: patientStatus === opt.value ? "#FFFFFF" : "#4F5F73",
                            border: `1px solid ${patientStatus === opt.value ? "#1677FF" : "#E5EAF2"}`,
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <WhyWeAsk text="This helps Kate introduce you correctly to the office" />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={
                saving ||
                (profileNeedsFilling && !dob.trim() && !insuranceProvider.trim()) ||
                (careRecipients.length > 1 && !bookingForName)
              }
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "#1677FF",
              }}
            >
              {saving ? "Saving..." : profileNeedsFilling ? "Save & call" : "Call now"}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-xl border border-[#E5EAF2] px-4 py-2.5 text-sm text-[#4F5F73] transition hover:bg-[#F0F2F5]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upgrade prompt for free users */}
      {showUpgradePrompt && (
        <div className="rounded-2xl border border-[#E5EAF2] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#071832]">You&apos;ve used your one free Kate call.</p>
          <p className="mt-1 text-xs text-[#4F5F73]">
            Free accounts get one trial call to test out Kate. To have her keep scheduling for you, upgrade to Solo or Family.
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href="/billing"
              className="flex-1 rounded-xl py-2.5 text-center text-sm font-semibold text-white"
              style={{ background: "#1677FF" }}
            >
              View Plans
            </a>
            <button
              onClick={() => setShowUpgradePrompt(false)}
              className="rounded-xl px-4 py-2.5 text-sm text-[#4F5F73] hover:text-[#071832]"
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
          style={{ background: "#1677FF" }}
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
              ? "bg-[#1677FF]/15 text-[#1677FF]"
              : "bg-amber-50 text-[#071832] border border-amber-200")
          }
        >
          {toast.kind === "error" && toast.text.toLowerCase().includes("name") ? (
            <span>
              Kate needs your full name to call. {" "}
              <a href="/settings" className="font-semibold text-[#1677FF] underline underline-offset-2">
                Add it in Settings →
              </a>
            </span>
          ) : toast.kind === "error" && (toast.text.toLowerCase().includes("profile") || toast.text.toLowerCase().includes("dob") || toast.text.toLowerCase().includes("insurance")) ? (
            <span>
              {toast.text} {" "}
              <a href="/settings" className="font-semibold text-[#1677FF] underline underline-offset-2">
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
