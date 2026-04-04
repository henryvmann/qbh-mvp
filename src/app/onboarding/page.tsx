"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { apiFetch } from "../../lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SurveyAnswers {
  step1: string[];
  step2: string[];
  step3: string[];
  step4: string[];
}

interface DiscoveryResult {
  label: string;
  detail?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STEP1_OPTIONS = [
  "My appointments",
  "My medications",
  "My test results",
  "My child's health",
  "My parent's health",
  "Medical history",
];

const STEP2_OPTIONS = [
  "Booking appointments",
  "Remembering follow-ups",
  "Coordinating doctors",
  "Organizing records",
  "Knowing what's due",
  "Advocating for myself",
];

const STEP3_OPTIONS = [
  "Myself",
  "My partner / spouse",
  "My child(ren)",
  "My parent(s)",
  "Someone else",
];

const STEP4_OPTIONS = [
  "Keep everything organized",
  "Tell me what's overdue",
  "Book appointments automatically",
  "Provide insights",
  "Thread care together",
];

const GOLD = "#D4A843";
const NAVY = "#0B1120";
const CARD_BG = "#131B2E";
const CARD_BORDER = "#1E2B45";

/* Survey step mapping: step 1 -> survey 1, step 3 -> survey 2, step 4 -> survey 3, step 5 -> survey 4 */
const SURVEY_STEP_MAP: Record<number, number> = { 1: 1, 3: 2, 4: 3, 5: 4 };

/* ------------------------------------------------------------------ */
/*  Shared UI pieces                                                   */
/* ------------------------------------------------------------------ */

function DecorativeCircle() {
  return (
    <div
      className="pointer-events-none fixed -right-32 -top-32 h-[500px] w-[500px] rounded-full border border-white/10"
      aria-hidden
    />
  );
}

function StepCounter({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="mb-8 text-xs font-semibold uppercase tracking-[0.25em]"
      style={{ color: GOLD }}
    >
      Step {current} of {total}
    </div>
  );
}

function GoldButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="mt-8 w-full rounded-2xl px-6 py-4 text-base font-semibold transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: GOLD, color: NAVY }}
    >
      {children}
    </button>
  );
}

function OptionRow({
  label,
  selected,
  onClick,
  multi,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  multi: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl px-5 py-4 text-left text-sm transition"
      style={{
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: selected ? GOLD : CARD_BORDER,
      }}
    >
      {/* indicator */}
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: selected ? GOLD : "#3A4A66",
          backgroundColor: selected ? GOLD : "transparent",
        }}
      >
        {selected && (
          <span
            className="block h-2 w-2 rounded-full"
            style={{ backgroundColor: multi ? "#fff" : NAVY }}
          />
        )}
      </span>
      <span className="text-[#EFF4FF]">{label}</span>
    </button>
  );
}

function ConnectionRow({
  label,
  connected,
  pending,
  onClick,
}: {
  label: string;
  connected: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-5 py-4 text-left text-sm transition"
      style={{
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: connected ? "#34D399" : CARD_BORDER,
      }}
    >
      <span className="text-[#EFF4FF]">{label}</span>
      {connected ? (
        <span className="text-emerald-400 text-xs font-medium">Connected &#10003;</span>
      ) : pending ? (
        <span className="text-amber-400 text-xs font-medium">Pending...</span>
      ) : (
        <span className="text-xs font-medium" style={{ color: GOLD }}>
          Connect
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const router = useRouter();

  /* ---- core state ---- */
  const [step, setStep] = useState(0);
  const [survey, setSurvey] = useState<SurveyAnswers>({
    step1: [],
    step2: [],
    step3: [],
    step4: [],
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [plaidConnected, setPlaidConnected] = useState(false);
  const [calendarConnected] = useState(false); // deferred to after auth
  const [calendarPending, setCalendarPending] = useState(false);
  const [plaidPublicToken, setPlaidPublicToken] = useState<string | null>(null);
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>(
    []
  );
  const [pendingProviders, setPendingProviders] = useState<Array<{ id: string; name: string; status: string; visit_count: number }>>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [reviewingProviders, setReviewingProviders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const plaidHandlerRef = useRef<{ open: () => void } | null>(null);

  // No auth guard here — if someone explicitly navigates to /onboarding,
  // let them through. The home page handles the "authenticated -> dashboard" redirect.

  /* ---- initialise user id ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if returning from native OAuth with Plaid already connected
    const nativePlaidDone = window.localStorage.getItem("qbh_plaid_connected");
    if (nativePlaidDone) {
      setPlaidConnected(true);
      const savedId = window.localStorage.getItem("qbh_user_id") || "";
      if (savedId) setUserId(savedId);
      setStep(8); // jump to discovery
      window.localStorage.removeItem("qbh_plaid_connected");
      return;
    }

    const id = crypto.randomUUID();
    setUserId(id);
    window.localStorage.setItem("qbh_user_id", id);
  }, []);

  /* ---- toggle helpers ---- */
  function toggleMulti(
    key: "step1" | "step2" | "step3" | "step4",
    value: string
  ) {
    setSurvey((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value],
      };
    });
  }

  // setSingle removed — step3 is now multi-select

  /* ---- Plaid Link via CDN script ---- */
  const openPlaidLink = useCallback(async () => {
    if (!userId) return;
    setError(null);

    try {
      // 1. get link token
      const res = await apiFetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.link_token) {
        throw new Error(data?.error || "Failed to create Plaid Link token.");
      }

      const linkToken = data.link_token;
      window.localStorage.setItem("qbh_plaid_link_token", linkToken);
      window.localStorage.setItem("qbh_user_id", userId);
      try {
        const { Preferences } = await import("@capacitor/preferences");
        await Preferences.set({ key: "qbh_plaid_link_token", value: linkToken });
        await Preferences.set({ key: "qbh_user_id", value: userId });
      } catch {
        // non-native
      }

      // 2. load Plaid Link script if needed
      await ensurePlaidScript();

      // 3. open Plaid Link
      const Plaid = (window as unknown as Record<string, unknown>)["Plaid"] as {
        create: (config: Record<string, unknown>) => { open: () => void; destroy: () => void };
      };

      const handler = Plaid.create({
        token: linkToken,
        onSuccess: (publicToken: string) => {
          setPlaidPublicToken(publicToken);
          setPlaidConnected(true);
        },
        onExit: (err: unknown) => {
          if (err) {
            setError("Plaid Link exited before completion.");
          }
        },
      });

      plaidHandlerRef.current = handler;
      handler.open();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open Plaid Link."
      );
    }
  }, [userId]);

  // Calendar connect deferred to after auth — just a toggle at step 7

  /* ---- Step 7 continue: create user ---- */
  const handleStep7Continue = useCallback(async () => {
    if (!name.trim() || !email.trim() || password.length < 6) return;
    setError(null);

    try {
      // Create account via server API (auto-confirms email)
      const signupRes = await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          app_user_id: userId,
          name: name.trim(),
          survey_answers: JSON.stringify(survey),
        }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok || !signupData?.ok) {
        throw new Error(signupData?.error || "Failed to create account.");
      }

      // Sign in to create client session
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      setStep(8);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    }
  }, [name, email, password, userId, survey]);

  /* ---- Step 8: run discovery ---- */
  useEffect(() => {
    if (step !== 8) return;
    let cancelled = false;

    setLoadingDiscovery(true);
    setAnalysisProgress(0);

    // Animate progress items in sequence
    const timer1 = window.setTimeout(() => {
      if (!cancelled) setAnalysisProgress(1);
    }, 1000);
    const timer2 = window.setTimeout(() => {
      if (!cancelled) setAnalysisProgress(2);
    }, 3000);
    const timer3 = window.setTimeout(() => {
      if (!cancelled) setAnalysisProgress(3);
    }, 5000);

    async function runDiscovery() {
      try {
        const effectiveUserId =
          userId || window.localStorage.getItem("qbh_user_id") || "";

        console.log("[Onboarding] Starting discovery for:", effectiveUserId);
        console.log("[Onboarding] plaidPublicToken:", plaidPublicToken ? "yes" : "no");
        console.log("[Onboarding] plaidConnected:", plaidConnected);

        // Exchange Plaid token if we have one (web flow)
        if (plaidPublicToken) {
          console.log("[Onboarding] Exchanging Plaid token...");
          const exchangeRes = await apiFetch("/api/plaid/exchange-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              app_user_id: effectiveUserId,
              public_token: plaidPublicToken,
            }),
          });
          const exchangeData = await exchangeRes.json();
          console.log("[Onboarding] Exchange result:", exchangeData);
          if (!exchangeRes.ok || !exchangeData?.ok) {
            throw new Error(
              exchangeData?.error || "Failed to exchange Plaid token."
            );
          }
        }

        // Run discovery with retry logic (fresh Plaid connections often need time)
        async function tryDiscovery(attempt: number): Promise<any> {
          console.log(`[Onboarding] Running discovery (attempt ${attempt})...`);
          const res = await apiFetch("/api/discovery/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app_user_id: effectiveUserId }),
          });
          const data = await res.json();
          console.log(`[Onboarding] Discovery attempt ${attempt}:`, JSON.stringify(data));

          // Retry on PRODUCT_NOT_READY or 500 (up to 3 attempts)
          if ((data.pending || !res.ok) && attempt < 3) {
            const delay = attempt * 5000; // 5s, 10s
            console.log(`[Onboarding] Retrying in ${delay / 1000}s...`);
            await new Promise((r) => setTimeout(r, delay));
            return tryDiscovery(attempt + 1);
          }
          return data;
        }

        const discData = await tryDiscovery(1);

        // Small delay so animation feels natural
        await new Promise((r) => setTimeout(r, 1200));

        if (!cancelled) {
          // Fetch review_needed providers
          const pendingRes = await apiFetch(`/api/providers/pending?app_user_id=${encodeURIComponent(effectiveUserId)}`);
          const pendingData = await pendingRes.json();
          console.log("[Onboarding] Pending providers:", pendingData);

          if (pendingRes.ok && pendingData?.providers?.length > 0) {
            setPendingProviders(pendingData.providers);
            // Track counts for celebration screen
            const active = pendingData.providers.filter((p: { status: string }) => p.status === "active");
            setApprovedCount(active.length);
            setFollowUpCount(pendingData.providers.filter((p: { status: string }) => p.status === "review_needed").length);
            setReviewingProviders(true);
            setLoadingDiscovery(false);
            return;
          }

          setLoadingDiscovery(false);
          // Go to celebration screen instead of directly to dashboard
          setStep(9);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[Onboarding] Discovery failed:", err);
          setError(err instanceof Error ? err.message : "Discovery failed");
          setLoadingDiscovery(false);
          // Don't auto-navigate — show the error
        }
      }
    }

    runDiscovery();

    return () => {
      cancelled = true;
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
      window.clearTimeout(timer3);
    };
  }, [step, plaidPublicToken, plaidConnected, userId]);

  /* ---- render per step ---- */

  // Step 0: Enhanced Splash
  if (step === 0) {
    return (
      <Shell>
        <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: GOLD }}
          >
            QBH &#10022; Your Health Ally
          </p>
          <h1 className="mt-6 max-w-md text-3xl font-light leading-snug text-[#EFF4FF] sm:text-4xl">
            You don&apos;t have to manage this alone.
          </h1>
          <p className="mt-4 max-w-sm text-base text-[#6B85A8]">
            QB keeps track, follows up, and handles the details so you
            don&apos;t have to.
          </p>

          {/* Preview cards */}
          <div className="mt-8 flex gap-3">
            {[
              { icon: "\u25C9", label: "Find providers" },
              { icon: "\u25C9", label: "Book appointments" },
              { icon: "\u2713", label: "Stay on track" },
            ].map((card) => (
              <div
                key={card.label}
                className="flex flex-col items-center gap-2 rounded-xl px-4 py-3"
                style={{
                  backgroundColor: CARD_BG,
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: CARD_BORDER,
                  minWidth: 96,
                }}
              >
                <span className="text-lg" style={{ color: GOLD }}>{card.icon}</span>
                <span className="text-xs text-[#EFF4FF]">{card.label}</span>
              </div>
            ))}
          </div>

          <GoldButton onClick={() => setStep(1)}>Continue &rarr;</GoldButton>
        </div>
      </Shell>
    );
  }

  // Step 1: What do you want help staying on top of?
  if (step === 1) {
    return (
      <Shell>
        <StepCounter current={SURVEY_STEP_MAP[1]} total={4} />
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          What do you want help staying on top of?
        </h1>
        <div className="mt-6 flex flex-col gap-3">
          {STEP1_OPTIONS.map((opt) => (
            <OptionRow
              key={opt}
              label={opt}
              selected={survey.step1.includes(opt)}
              onClick={() => toggleMulti("step1", opt)}
              multi
            />
          ))}
        </div>
        <GoldButton
          onClick={() => setStep(2)}
          disabled={survey.step1.length === 0}
        >
          Continue &rarr;
        </GoldButton>
      </Shell>
    );
  }

  // Step 2: NEW — Social Proof / Trust interstitial
  if (step === 2) {
    return (
      <SocialProofScreen onContinue={() => setStep(3)} />
    );
  }

  // Step 3: What's hardest to manage today? (was step 2)
  if (step === 3) {
    return (
      <Shell>
        <StepCounter current={SURVEY_STEP_MAP[3]} total={4} />
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          What&apos;s hardest to manage today?
        </h1>
        <div className="mt-6 flex flex-col gap-3">
          {STEP2_OPTIONS.map((opt) => (
            <OptionRow
              key={opt}
              label={opt}
              selected={survey.step2.includes(opt)}
              onClick={() => toggleMulti("step2", opt)}
              multi
            />
          ))}
        </div>
        <GoldButton
          onClick={() => setStep(4)}
          disabled={survey.step2.length === 0}
        >
          Continue &rarr;
        </GoldButton>
      </Shell>
    );
  }

  // Step 4: Who are you managing care for? (was step 3)
  if (step === 4) {
    return (
      <Shell>
        <StepCounter current={SURVEY_STEP_MAP[4]} total={4} />
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          Who are you managing care for?
        </h1>
        <p className="mt-2 text-sm text-[#6B85A8]">Choose as many as you&apos;d like</p>
        <div className="mt-6 flex flex-col gap-3">
          {STEP3_OPTIONS.map((opt) => (
            <OptionRow
              key={opt}
              label={opt}
              selected={survey.step3.includes(opt)}
              onClick={() => toggleMulti("step3", opt)}
              multi
            />
          ))}
        </div>
        <GoldButton
          onClick={() => setStep(5)}
          disabled={survey.step3.length === 0}
        >
          Continue &rarr;
        </GoldButton>
      </Shell>
    );
  }

  // Step 5: What would you want QB to handle? (was step 4)
  if (step === 5) {
    return (
      <Shell>
        <StepCounter current={SURVEY_STEP_MAP[5]} total={4} />
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          What would you want QB to handle?
        </h1>
        <div className="mt-6 flex flex-col gap-3">
          {STEP4_OPTIONS.map((opt) => (
            <OptionRow
              key={opt}
              label={opt}
              selected={survey.step4.includes(opt)}
              onClick={() => toggleMulti("step4", opt)}
              multi
            />
          ))}
        </div>
        <GoldButton
          onClick={() => setStep(6)}
          disabled={survey.step4.length === 0}
        >
          Continue &rarr;
        </GoldButton>
      </Shell>
    );
  }

  // Step 6: NEW — "Here's what happens next" explainer
  if (step === 6) {
    const steps = [
      {
        num: 1,
        title: "Connect your bank",
        desc: "We\u2019ll scan your transactions to find healthcare providers. Read-only \u2014 we can\u2019t move money.",
      },
      {
        num: 2,
        title: "Review your providers",
        desc: "You\u2019ll see everyone we found and choose which ones to keep.",
      },
      {
        num: 3,
        title: "QB gets to work",
        desc: "We\u2019ll check what\u2019s overdue, find phone numbers, and start booking.",
      },
    ];

    return (
      <Shell>
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          Here&apos;s what happens next
        </h1>

        <div className="mt-8 flex flex-col gap-5">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-4">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                {s.num}
              </span>
              <div>
                <div className="text-sm font-medium text-[#EFF4FF]">{s.title}</div>
                <div className="mt-1 text-xs text-[#6B85A8] leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <GoldButton onClick={() => setStep(7)}>Let&apos;s do it &rarr;</GoldButton>
      </Shell>
    );
  }

  // Step 7: Account setup + Plaid connection (was step 5)
  if (step === 7) {
    const canContinue = name.trim().length > 0 && email.trim().length > 0 && password.length >= 6;
    return (
      <Shell>
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          Let&apos;s get you set up
        </h1>
        <p className="mt-2 text-sm text-[#6B85A8]">
          Name &bull; Email &bull; Connect accounts
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border px-4 py-3 text-sm text-[#EFF4FF] placeholder:text-[#3D526B] focus:outline-none focus:ring-1"
            style={{
              backgroundColor: CARD_BG,
              borderColor: CARD_BORDER,
            }}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border px-4 py-3 text-sm text-[#EFF4FF] placeholder:text-[#3D526B] focus:outline-none focus:ring-1"
            style={{
              backgroundColor: CARD_BG,
              borderColor: CARD_BORDER,
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            minLength={6}
            className="w-full rounded-xl border px-4 py-3 text-sm text-[#EFF4FF] placeholder:text-[#3D526B] focus:outline-none focus:ring-1"
            style={{
              backgroundColor: CARD_BG,
              borderColor: CARD_BORDER,
            }}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <OptionRow
            label="Connect Gmail Calendar after setup"
            selected={calendarPending}
            onClick={() => setCalendarPending((p) => !p)}
            multi
          />
          {calendarPending && (
            <p className="px-1 text-xs text-[#6B85A8]">
              We&apos;ll prompt you to connect Google Calendar once your account is verified.
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
            {error}
          </div>
        )}

        {plaidConnected ? (
          <GoldButton onClick={handleStep7Continue} disabled={!canContinue}>
            Continue &rarr;
          </GoldButton>
        ) : (
          <GoldButton onClick={() => { if (canContinue) openPlaidLink(); }} disabled={!canContinue}>
            Connect your bank &rarr;
          </GoldButton>
        )}
      </Shell>
    );
  }

  // Step 8 — Provider review (shows after discovery finds providers to review)
  if (step === 8 && reviewingProviders) {
    // Build person options from step 3 survey answers
    const personLabelMap: Record<string, string> = {
      "Myself": "Me",
      "My partner / spouse": "Partner",
      "My child(ren)": "Child",
      "My parent(s)": "Parent",
      "Someone else": "Other",
    };
    const personOptions = survey.step3
      .map((s) => ({ value: s.toLowerCase().replace(/[^a-z]/g, "_"), label: personLabelMap[s] || s }))
      .filter((o) => o.label);

    // If only "Myself" was selected, options are just "Me" and "Ignore"
    // Otherwise, show all selected people plus "Ignore"

    async function handleProviderAssign(providerId: string, careRecipient: string) {
      const effectiveUserId = userId || window.localStorage.getItem("qbh_user_id") || "";
      try {
        await apiFetch("/api/providers/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider_id: providerId,
            action: "approve",
            app_user_id: effectiveUserId,
            care_recipient: careRecipient,
          }),
        });
      } catch {
        // Best-effort
      }
      setApprovedCount((c) => c + 1);
      setPendingProviders((prev) => prev.filter((p) => p.id !== providerId));
    }

    async function handleProviderDismiss(providerId: string) {
      const effectiveUserId = userId || window.localStorage.getItem("qbh_user_id") || "";
      try {
        await apiFetch("/api/providers/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider_id: providerId, action: "dismiss", app_user_id: effectiveUserId }),
        });
      } catch {
        // Best-effort
      }
      setPendingProviders((prev) => prev.filter((p) => p.id !== providerId));
    }

    const confirmedProviders = pendingProviders.filter((p) => p.status === "active");
    const needsReview = pendingProviders.filter((p) => p.status === "review_needed");
    const allReviewed = needsReview.length === 0;

    return (
      <Shell>
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          We found your healthcare providers
        </h1>
        <p className="mt-2 text-sm text-[#6B85A8]">
          Who is each provider for? Tap to assign or ignore.
        </p>

        {confirmedProviders.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Confirmed providers
            </div>
            <div className="flex flex-col gap-2">
              {confirmedProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-xl border px-4 py-3"
                  style={{ backgroundColor: CARD_BG, borderColor: "#1A3A2A" }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[#EFF4FF]">{provider.name}</div>
                      <div className="text-xs text-[#6B85A8]">
                        {provider.visit_count} visit{provider.visit_count !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <span className="text-xs text-emerald-400">&#10003;</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {personOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleProviderAssign(provider.id, opt.value)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: GOLD, color: NAVY }}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      onClick={() => handleProviderDismiss(provider.id)}
                      className="rounded-lg border border-white/10 bg-[#1A2336] px-2.5 py-1 text-xs text-[#6B85A8]"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {needsReview.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
              Could be a provider ({needsReview.length} remaining)
            </div>
            <div className="flex flex-col gap-2">
              {needsReview.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-xl border px-4 py-3"
                  style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
                >
                  <div>
                    <div className="text-sm font-medium text-[#EFF4FF]">{provider.name}</div>
                    <div className="text-xs text-[#6B85A8]">
                      {provider.visit_count} transaction{provider.visit_count !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {personOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleProviderAssign(provider.id, opt.value)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: GOLD, color: NAVY }}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      onClick={() => handleProviderDismiss(provider.id)}
                      className="rounded-lg border border-white/10 bg-[#1A2336] px-2.5 py-1 text-xs text-[#6B85A8]"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {allReviewed && (
          <GoldButton onClick={() => setStep(9)}>
            Continue &rarr;
          </GoldButton>
        )}
      </Shell>
    );
  }

  // Step 8 — Discovery processing with animated checkmarks
  if (step === 8) {
    if (error) {
      return (
        <Shell>
          <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
            Something went wrong
          </h1>
          <div className="mt-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
            {error}
          </div>
          <GoldButton onClick={() => router.push("/handle-first")}>
            Continue to dashboard &rarr;
          </GoldButton>
        </Shell>
      );
    }

    const progressItems = [
      "Finding your healthcare providers",
      "Building your care timeline",
      "Checking for overdue care",
    ];

    return (
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
            QB is getting started
          </h1>
          <p className="mt-2 text-sm text-[#6B85A8]">
            This usually takes a few seconds
          </p>

          <div className="mt-10 flex flex-col gap-4 text-left w-full max-w-sm">
            {progressItems.map((label, i) => {
              const done = analysisProgress >= i + 1;
              return (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl px-5 py-4 transition-all duration-500"
                  style={{
                    backgroundColor: CARD_BG,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: done ? GOLD : CARD_BORDER,
                    opacity: analysisProgress >= i ? 1 : 0.3,
                  }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-500"
                    style={{
                      backgroundColor: done ? GOLD : "transparent",
                      color: done ? NAVY : "#3A4A66",
                      borderWidth: done ? 0 : 2,
                      borderStyle: "solid",
                      borderColor: "#3A4A66",
                    }}
                  >
                    {done ? "\u2713" : ""}
                  </span>
                  <span
                    className="text-sm transition-colors duration-500"
                    style={{ color: done ? "#EFF4FF" : "#6B85A8" }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Shell>
    );
  }

  // Step 9: NEW — Celebration + summary screen
  if (step === 9) {
    return (
      <Shell>
        <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
          {/* Celebratory symbol */}
          <span className="text-5xl" style={{ color: GOLD }}>&#10022;</span>

          <h1 className="mt-6 max-w-md text-2xl font-light leading-snug text-[#EFF4FF] sm:text-3xl">
            You&apos;re all set!
          </h1>
          <p className="mt-2 text-base text-[#6B85A8]">
            Here&apos;s what QB found for you
          </p>

          {/* Summary cards */}
          <div className="mt-8 flex flex-col gap-3 w-full max-w-sm">
            <div
              className="flex items-center gap-4 rounded-xl px-5 py-4 text-sm"
              style={{
                backgroundColor: CARD_BG,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: CARD_BORDER,
              }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                {approvedCount}
              </span>
              <span className="text-[#EFF4FF]">providers identified</span>
            </div>

            <div
              className="flex items-center gap-4 rounded-xl px-5 py-4 text-sm"
              style={{
                backgroundColor: CARD_BG,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: CARD_BORDER,
              }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                {followUpCount}
              </span>
              <span className="text-[#EFF4FF]">may need follow-up</span>
            </div>

            <div
              className="flex items-center gap-4 rounded-xl px-5 py-4 text-sm"
              style={{
                backgroundColor: CARD_BG,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: CARD_BORDER,
              }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                &#10003;
              </span>
              <span className="text-[#EFF4FF]">Health timeline started</span>
            </div>
          </div>

          <GoldButton onClick={() => router.push("/handle-first")}>
            See your dashboard &rarr;
          </GoldButton>
        </div>
      </Shell>
    );
  }

  // Step 10: Dashboard redirect (fallback)
  if (step === 10) {
    router.push("/handle-first");
    return null;
  }

  // Fallback (should never render)
  return null;
}

/* ------------------------------------------------------------------ */
/*  Social Proof Screen (Step 2) — auto-advances after 4s             */
/* ------------------------------------------------------------------ */

function SocialProofScreen({ onContinue }: { onContinue: () => void }) {
  const hasFired = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!hasFired.current) {
        hasFired.current = true;
        onContinue();
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [onContinue]);

  function handleClick() {
    if (!hasFired.current) {
      hasFired.current = true;
      onContinue();
    }
  }

  return (
    <Shell>
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          You&apos;re in good hands
        </h1>

        {/* Testimonial */}
        <div
          className="mt-8 rounded-xl px-6 py-5"
          style={{
            backgroundColor: CARD_BG,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: CARD_BORDER,
          }}
        >
          <p className="text-sm italic leading-relaxed text-[#EFF4FF]">
            &ldquo;QB found three providers I&apos;d completely forgotten about and booked my overdue physical in minutes.&rdquo;
          </p>
          <p className="mt-3 text-xs text-[#6B85A8]">&mdash; Early QB member</p>
        </div>

        {/* Trust points */}
        <div className="mt-8 flex gap-4">
          {[
            { icon: "\uD83D\uDD12", label: "Bank-level security" },
            { icon: "\uD83D\uDC41", label: "Read-only access" },
            { icon: "\uD83D\uDEE1", label: "No data sold" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-2" style={{ minWidth: 88 }}>
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs text-[#6B85A8]">{item.label}</span>
            </div>
          ))}
        </div>

        <GoldButton onClick={handleClick}>Continue &rarr;</GoldButton>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell layout wrapper                                               */
/* ------------------------------------------------------------------ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative min-h-screen overflow-hidden text-[#EFF4FF]"
      style={{ backgroundColor: NAVY }}
    >
      <DecorativeCircle />
      <div className="relative z-10 mx-auto max-w-lg px-6 py-12 sm:py-20">
        {children}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Plaid CDN script loader                                            */
/* ------------------------------------------------------------------ */

function ensurePlaidScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (
      (window as unknown as Record<string, unknown>)["Plaid"]
    ) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Plaid script"));
    document.head.appendChild(script);
  });
}
