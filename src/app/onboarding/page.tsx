"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { apiFetch } from "../../lib/api";
import { CharacterWithBubble } from "../../components/qbh/CharacterBubble";

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

const ACCENT = "#5C6B5C";
const ACCENT_BG = "#1A1D2E";
const CARD_BG = "#FFFFFF";
const CARD_BORDER = "#EBEDF0";

/* Survey step mapping: step 1 -> survey 1, step 3 -> survey 2, step 4 -> survey 3, step 5 -> survey 4 */
const SURVEY_STEP_MAP: Record<number, number> = { 1: 1, 3: 2, 4: 3, 5: 4 };

/* ------------------------------------------------------------------ */
/*  Shared UI pieces                                                   */
/* ------------------------------------------------------------------ */

function DecorativeCircle() {
  return (
    <div
      className="pointer-events-none fixed -right-32 -top-32 h-[500px] w-[500px] rounded-full border border-[#D0D8E0]/30"
      aria-hidden
    />
  );
}

function StepCounter({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="mb-8 text-xs font-semibold uppercase tracking-[0.25em]"
      style={{ color: ACCENT }}
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
  id,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  id?: string;
}) {
  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="mt-8 w-full rounded-3xl px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)",
        boxShadow: "0 8px 24px rgba(92,107,92,0.35)",
      }}
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
      className="flex w-full items-center gap-4 rounded-xl px-5 py-4 text-left text-sm transition shadow-sm"
      style={{
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: selected ? ACCENT : CARD_BORDER,
      }}
    >
      {/* indicator */}
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: selected ? ACCENT : "#B0B4BC",
          backgroundColor: selected ? ACCENT : "transparent",
        }}
      >
        {selected && (
          <span
            className="block h-2 w-2 rounded-full"
            style={{ backgroundColor: "#fff" }}
          />
        )}
      </span>
      <span className="text-[#1A1D2E]">{label}</span>
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
      className="flex w-full items-center justify-between rounded-xl px-5 py-4 text-left text-sm transition shadow-sm"
      style={{
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: connected ? "#5C6B5C" : CARD_BORDER,
      }}
    >
      <span className="text-[#1A1D2E]">{label}</span>
      {connected ? (
        <span className="text-[#5C6B5C] text-xs font-medium">Connected &#10003;</span>
      ) : pending ? (
        <span className="text-amber-600 text-xs font-medium">Pending...</span>
      ) : (
        <span className="text-xs font-medium" style={{ color: ACCENT }}>
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
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
  const [providerPeople, setProviderPeople] = useState<Record<string, Set<string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [manualPath, setManualPath] = useState(false);
  const [manualProviders, setManualProviders] = useState<Array<{ name: string; specialty: string | null; phone: string | null; careRecipients: string[] }>>([]);
  const [npiSearchQuery, setNpiSearchQuery] = useState("");
  const [npiSearchResults, setNpiSearchResults] = useState<Array<{ npi: string; name: string; specialty: string | null; phone: string | null; city: string | null; state: string | null }>>([]);
  const [npiSearching, setNpiSearching] = useState(false);
  const [npiResultPeople, setNpiResultPeople] = useState<Record<string, Set<string>>>({});

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
          // Auto-advance: if account info is filled, trigger continue immediately
          if (firstName.trim() && lastName.trim() && email.trim() && password.length >= 6) {
            // Small delay so user sees the "connected" state briefly
            setTimeout(() => {
              document.getElementById("step7-continue-btn")?.click();
            }, 800);
          }
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
    if (!firstName.trim() || !lastName.trim() || !email.trim() || password.length < 6) return;
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
  }, [firstName, lastName, email, password, userId, survey]);

  /* ---- Step 8: run discovery ---- */
  useEffect(() => {
    if (step !== 8) return;
    let cancelled = false;

    setLoadingDiscovery(true);
    setAnalysisProgress(0);

    // Animate progress items in sequence
    // Animate 6 progress steps over ~90 seconds
    const timer1 = window.setTimeout(() => { if (!cancelled) setAnalysisProgress(1); }, 3000);
    const timer2 = window.setTimeout(() => { if (!cancelled) setAnalysisProgress(2); }, 10000);
    const timer3 = window.setTimeout(() => { if (!cancelled) setAnalysisProgress(3); }, 25000);
    const timer4 = window.setTimeout(() => { if (!cancelled) setAnalysisProgress(4); }, 45000);
    const timer5 = window.setTimeout(() => { if (!cancelled) setAnalysisProgress(5); }, 65000);
    const timer6 = window.setTimeout(() => { if (!cancelled) setAnalysisProgress(6); }, 85000);

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
      window.clearTimeout(timer4);
      window.clearTimeout(timer5);
      window.clearTimeout(timer6);
    };
  }, [step, plaidPublicToken, plaidConnected, userId]);

  /* ---- NPI search debounce ---- */
  useEffect(() => {
    if (!npiSearchQuery || npiSearchQuery.length < 2) {
      setNpiSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setNpiSearching(true);
      try {
        const res = await apiFetch(`/api/npi/search?q=${encodeURIComponent(npiSearchQuery)}`);
        const data = await res.json();
        if (data.ok) setNpiSearchResults(data.results || []);
      } catch {}
      finally { setNpiSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [npiSearchQuery]);

  /* ---- Manual path: handle continue ---- */
  const handleManualContinue = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || password.length < 6) return;
    setError(null);

    try {
      // Create account via server API
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

      // Add each manual provider
      for (const prov of manualProviders) {
        await apiFetch("/api/providers/add-manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_user_id: userId,
            name: prov.name,
            phone_number: prov.phone,
            specialty: prov.specialty,
            care_recipients: prov.careRecipients,
          }),
        });
      }

      // Skip discovery, go straight to celebration
      setApprovedCount(manualProviders.length);
      setFollowUpCount(0);
      setStep(9);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    }
  }, [firstName, lastName, email, password, userId, survey, manualProviders]);

  /* ---- render per step ---- */

  // Step 0: Enhanced Splash
  if (step === 0) {
    return (
      <Shell>
        <div className="mt-8">
          <CharacterWithBubble pose="waving">
            Hey! I&apos;m Kate and I&apos;ll walk you through this.
            Quarterback&apos;s here to help manage your health journey. After a
            few questions we&apos;ll get all your current providers, find out if
            you need to book appointments and help you (or your kids or your
            parents) stay on top of your visits. And that&apos;s just the
            beginning... Welcome to Quarterback Health.
          </CharacterWithBubble>
        </div>

        {/* Preview cards — aligned with bubble right edge */}
        <div className="mt-8 flex justify-end gap-3" style={{ paddingLeft: 56 }}>
          {[
            { icon: "\u25C9", label: "Find providers" },
            { icon: "\u25C9", label: "Book appointments" },
            { icon: "\u2713", label: "Stay on track" },
          ].map((card) => (
            <div
              key={card.label}
              className="flex flex-1 flex-col items-center gap-2 rounded-xl px-4 py-3 shadow-sm"
              style={{
                backgroundColor: CARD_BG,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: CARD_BORDER,
              }}
            >
              <span className="text-lg" style={{ color: ACCENT }}>{card.icon}</span>
              <span className="text-xs text-[#1A1D2E]">{card.label}</span>
            </div>
          ))}
        </div>

        <div style={{ paddingLeft: 56 }}>
          <GoldButton onClick={() => setStep(1)}>Let&apos;s get started &rarr;</GoldButton>
        </div>
      </Shell>
    );
  }

  // Step 1: What do you want help staying on top of?
  if (step === 1) {
    return (
      <Shell>
        <div className="mb-6">
          <CharacterWithBubble pose="waving">
            We can be as involved or as removed as you want! This helps me
            understand what part of Quarterback is going to be the most helpful
            for you. Just let me know whether you want help booking appointments,
            collecting your medical history into one place, or managing your
            child or parent&apos;s health.
          </CharacterWithBubble>
        </div>
        <StepCounter current={SURVEY_STEP_MAP[1]} total={4} />
        <h1 className="text-2xl font-light text-[#1A1D2E] sm:text-3xl">
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
        <div className="mb-6">
          <CharacterWithBubble pose="thinking">
            No judgment here &mdash; healthcare is a lot to keep track of.
            Knowing what feels hardest right now helps me figure out where to
            jump in first. I&apos;ll focus on the stuff that&apos;s slipping
            through the cracks.
          </CharacterWithBubble>
        </div>
        <StepCounter current={SURVEY_STEP_MAP[3]} total={4} />
        <h1 className="text-2xl font-light text-[#1A1D2E] sm:text-3xl">
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
        <div className="mb-6">
          <CharacterWithBubble pose="pointing">
            A lot of people aren&apos;t just managing their own health &mdash;
            they&apos;re keeping track of their kids&apos; checkups or their
            parents&apos; specialists too. Let me know who I&apos;m helping you
            look after so I can keep everything organized by person.
          </CharacterWithBubble>
        </div>
        <StepCounter current={SURVEY_STEP_MAP[4]} total={4} />
        <h1 className="text-2xl font-light text-[#1A1D2E] sm:text-3xl">
          Who are you managing care for?
        </h1>
        <p className="mt-2 text-sm text-[#7A7F8A]">Choose as many as you&apos;d like</p>
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
        <div className="mb-6">
          <CharacterWithBubble pose="waving">
            Last question! This is the fun part &mdash; tell me what you actually
            want me to do. Some people just want reminders. Others want me to
            pick up the phone and book everything. There&apos;s no wrong answer.
          </CharacterWithBubble>
        </div>
        <StepCounter current={SURVEY_STEP_MAP[5]} total={4} />
        <h1 className="text-2xl font-light text-[#1A1D2E] sm:text-3xl">
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
        <div className="mt-4">
          <CharacterWithBubble pose="pointing">
            Here&apos;s what happens next. Three quick steps and you&apos;re all set.
          </CharacterWithBubble>
        </div>

        <div className="mt-8 flex flex-col gap-5">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-4">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: ACCENT, color: "#FFFFFF" }}
              >
                {s.num}
              </span>
              <div>
                <div className="text-sm font-medium text-[#1A1D2E]">{s.title}</div>
                <div className="mt-1 text-xs text-[#7A7F8A] leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <GoldButton onClick={() => setStep(7)}>Let&apos;s do it &rarr;</GoldButton>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setManualPath(true); setStep(7); }}
            className="text-sm text-[#7A7F8A] underline underline-offset-4 hover:text-[#1A1D2E]"
          >
            I&apos;d rather add my providers manually
          </button>
        </div>
      </Shell>
    );
  }

  // Step 7 (manual path): Account setup + NPI provider search
  if (step === 7 && manualPath) {
    const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0 && email.trim().length > 0 && password.length >= 6;

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
    const singlePerson = personOptions.length === 1;
    const defaultCareRecipient = singlePerson ? personOptions[0].value : "";

    function toggleNpiResultPerson(npi: string, personValue: string) {
      setNpiResultPeople((prev) => {
        const current = new Set(prev[npi] || []);
        if (current.has(personValue)) {
          current.delete(personValue);
        } else {
          current.add(personValue);
        }
        return { ...prev, [npi]: current };
      });
    }

    function addManualProvider(result: { name: string; specialty: string | null; phone: string | null; npi?: string }, careRecipients?: string[]) {
      const crs = careRecipients || (singlePerson ? [defaultCareRecipient] : []);
      if (crs.length === 0) return; // need assignment
      setManualProviders((prev) => {
        if (prev.some((p) => p.name === result.name)) return prev;
        return [...prev, { name: result.name, specialty: result.specialty, phone: result.phone, careRecipients: crs }];
      });
      setNpiSearchQuery("");
      setNpiSearchResults([]);
      setNpiResultPeople({});
    }

    return (
      <Shell>
        <div className="mb-6">
          <CharacterWithBubble pose="pointing">
            No problem! You can add your providers by name and I&apos;ll look
            them up. Just search for your doctor, dentist, or specialist and
            I&apos;ll pull in their details. You can always add more later from
            your dashboard.
          </CharacterWithBubble>
        </div>
        <h1 className="text-2xl font-light text-[#1A1D2E] sm:text-3xl">
          Add your healthcare providers
        </h1>
        <p className="mt-2 text-sm text-[#7A7F8A]">
          Search by name to find your doctor, dentist, or specialist.
        </p>

        {/* NPI Search — shown first since that's what they clicked for */}
        <div className="mt-6">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
            Search providers
          </label>
          <div className="relative">
            <input
              type="text"
              value={npiSearchQuery}
              onChange={(e) => setNpiSearchQuery(e.target.value)}
              placeholder="Dr. Smith, City Dental, etc."
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1"
              style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
            />
            {npiSearching && (
              <span className="absolute right-3 top-3 text-xs text-[#7A7F8A]">Searching...</span>
            )}
          </div>

          {/* Search results dropdown */}
          {npiSearchResults.length > 0 && (
            <div
              className="mt-1 max-h-64 overflow-y-auto rounded-xl border"
              style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
            >
              {npiSearchResults.map((result) => {
                const selected = npiResultPeople[result.npi] || new Set<string>();
                return (
                <div key={result.npi}>
                  {singlePerson ? (
                    <button
                      type="button"
                      onClick={() => addManualProvider(result)}
                      className="flex w-full flex-col px-4 py-3 text-left transition hover:bg-[#F0F2F5]"
                    >
                      <span className="text-sm font-medium text-[#1A1D2E]">{result.name}</span>
                      <span className="text-xs text-[#7A7F8A]">
                        {[result.specialty, [result.city, result.state].filter(Boolean).join(", ")].filter(Boolean).join(" \u00b7 ")}
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-col px-4 py-3">
                      <span className="text-sm font-medium text-[#1A1D2E]">{result.name}</span>
                      <span className="text-xs text-[#7A7F8A]">
                        {[result.specialty, [result.city, result.state].filter(Boolean).join(", ")].filter(Boolean).join(" \u00b7 ")}
                      </span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {personOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleNpiResultPerson(result.npi, opt.value)}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold"
                            style={{
                              backgroundColor: selected.has(opt.value) ? ACCENT : "transparent",
                              color: selected.has(opt.value) ? "#FFFFFF" : "#7A7F8A",
                              border: selected.has(opt.value) ? "none" : "1px solid #EBEDF0",
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                        {selected.size > 0 && (
                          <button
                            type="button"
                            onClick={() => addManualProvider(result, Array.from(selected))}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold"
                            style={{ backgroundColor: "#5C6B5C", color: "#FFFFFF" }}
                          >
                            Confirm
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Added providers */}
        {manualProviders.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
              Your providers ({manualProviders.length})
            </div>
            <div className="flex flex-col gap-2">
              {manualProviders.map((prov, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                  style={{ backgroundColor: CARD_BG, borderColor: ACCENT }}
                >
                  <div>
                    <div className="text-sm font-medium text-[#1A1D2E]">{prov.name}</div>
                    {prov.specialty && (
                      <div className="text-xs text-[#7A7F8A]">{prov.specialty}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualProviders((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-[#7A7F8A] hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Account creation — separate section */}
        <div className="mt-8 border-t border-[#EBEDF0] pt-6">
          <h2 className="text-lg font-semibold text-[#1A1D2E]">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-[#7A7F8A]">
            We need this to save your providers and get started.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full rounded-xl border px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1"
                style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full rounded-xl border px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1"
                style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
              />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1"
              style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              minLength={6}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1"
              style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <GoldButton
          onClick={handleManualContinue}
          disabled={!canContinue || manualProviders.length === 0}
        >
          Continue &rarr;
        </GoldButton>

        {canContinue && manualProviders.length === 0 && (
          <div className="mt-3 text-center">
            <button
              onClick={handleManualContinue}
              className="text-sm text-[#7A7F8A] underline underline-offset-4 hover:text-[#1A1D2E]"
            >
              Skip &mdash; I&apos;ll add providers later
            </button>
          </div>
        )}
      </Shell>
    );
  }

  // Step 7: Account setup + Plaid connection (was step 5)
  if (step === 7) {
    const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0 && email.trim().length > 0 && password.length >= 6;
    return (
      <Shell>
        <div className="mb-6">
          <CharacterWithBubble pose="pointing">
            Almost there! I just need a few basics to create your account.
            Then we&apos;ll connect your bank so I can find your healthcare
            providers automatically. Don&apos;t worry &mdash; it&apos;s
            read-only. I can&apos;t move money or see your balances.
          </CharacterWithBubble>
        </div>
        <h1 className="text-2xl font-light text-[#1A1D2E] sm:text-3xl">
          Let&apos;s get you set up
        </h1>
        <p className="mt-2 text-sm text-[#7A7F8A]">
          Name &bull; Email &bull; Connect accounts
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1"
              style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1"
              style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
            />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1"
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
            className="w-full rounded-xl border px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1"
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
            <p className="px-1 text-xs text-[#7A7F8A]">
              We&apos;ll prompt you to connect Google Calendar once your account is verified.
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {plaidConnected ? (
          <GoldButton id="step7-continue-btn" onClick={handleStep7Continue} disabled={!canContinue}>
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

    function toggleProviderPerson(providerId: string, personValue: string) {
      setProviderPeople((prev) => {
        const current = new Set(prev[providerId] || []);
        if (current.has(personValue)) {
          current.delete(personValue);
        } else {
          current.add(personValue);
        }
        return { ...prev, [providerId]: current };
      });
    }

    async function handleProviderAssign(providerId: string, careRecipients: string[], providerType?: string) {
      const effectiveUserId = userId || window.localStorage.getItem("qbh_user_id") || "";
      try {
        await apiFetch("/api/providers/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider_id: providerId,
            action: "approve",
            app_user_id: effectiveUserId,
            care_recipients: careRecipients,
            ...(providerType ? { provider_type: providerType } : {}),
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

    // Detect chain stores that could be retail OR pharmacy
    // Only major retail chains that also have pharmacies — not standalone pharmacies
    const CHAIN_STORES = [
      "CVS", "WALGREENS", "RITE AID", "DUANE READE", "WALMART",
      "COSTCO", "SAM'S CLUB", "TARGET", "KROGER", "PUBLIX",
      "SAFEWAY", "ALBERTSONS", "HEB", "MEIJER",
    ];
    function isChainStore(name: string): boolean {
      const upper = name.toUpperCase();
      return CHAIN_STORES.some((chain) => upper.includes(chain));
    }

    // Render a provider card with appropriate question
    function renderProviderCard(provider: typeof pendingProviders[0], isConfirmed: boolean) {
      const selected = providerPeople[provider.id] || new Set<string>();
      const chain = isChainStore(provider.name);

      return (
        <div
          key={provider.id}
          className="rounded-xl border px-4 py-3"
          style={{ backgroundColor: CARD_BG, borderColor: isConfirmed ? "#5C6B5C" : CARD_BORDER }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#1A1D2E]">{provider.name}</div>
              <div className="text-xs text-[#7A7F8A]">
                {provider.visit_count} {isConfirmed ? "visit" : "transaction"}{provider.visit_count !== 1 ? "s" : ""}
              </div>
            </div>
            {isConfirmed && <span className="text-xs text-[#5C6B5C]">&#10003;</span>}
          </div>

          {chain ? (
            <>
              <p className="mt-2 text-xs text-[#7A7F8A] italic">
                Do you use {provider.name} as a pharmacy?
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    // Auto-assign to first person and approve
                    const defaultPeople = personOptions.length === 1
                      ? [personOptions[0].value]
                      : Array.from(selected.size > 0 ? selected : new Set([personOptions[0]?.value || "myself"]));
                    handleProviderAssign(provider.id, defaultPeople, "pharmacy");
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ backgroundColor: ACCENT, color: "#FFFFFF" }}
                >
                  Yes, it&apos;s my pharmacy
                </button>
                <button
                  onClick={() => handleProviderDismiss(provider.id)}
                  className="rounded-lg border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-1.5 text-xs text-[#7A7F8A]"
                >
                  No, I just shop there
                </button>
              </div>
            </>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {personOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleProviderPerson(provider.id, opt.value)}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: selected.has(opt.value) ? ACCENT : "transparent",
                    color: selected.has(opt.value) ? "#FFFFFF" : "#7A7F8A",
                    border: selected.has(opt.value) ? "none" : "1px solid #EBEDF0",
                  }}
                >
                  {opt.label}
                </button>
              ))}
              {selected.size > 0 && (
                <button
                  onClick={() => handleProviderAssign(provider.id, Array.from(selected))}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold"
                  style={{ backgroundColor: "#5C6B5C", color: "#FFFFFF" }}
                >
                  Confirm
                </button>
              )}
              <button
                onClick={() => handleProviderDismiss(provider.id)}
                className="rounded-lg border border-[#EBEDF0] bg-[#F0F2F5] px-2.5 py-1 text-xs text-[#7A7F8A]"
              >
                Ignore
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <Shell>
        <div className="mb-6">
          <CharacterWithBubble pose="celebrating">
            Great news &mdash; I found some providers! Take a quick look and
            let me know who each one is for. If something doesn&apos;t look like
            a healthcare provider, just hit ignore. I want to make sure I&apos;m
            only tracking the right ones.
          </CharacterWithBubble>
        </div>
        <h1 className="text-2xl font-light text-[#1A1D2E] sm:text-3xl">
          We found your healthcare providers
        </h1>
        <p className="mt-2 text-sm text-[#7A7F8A]">
          Who is each provider for? Tap to assign or ignore.
        </p>

        {confirmedProviders.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5C6B5C]">
              Confirmed providers
            </div>
            <div className="flex flex-col gap-2">
              {confirmedProviders.map((provider) => renderProviderCard(provider, true))}
            </div>
          </div>
        )}

        {needsReview.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
              Could be a provider ({needsReview.length} remaining)
            </div>
            <div className="flex flex-col gap-2">
              {needsReview.map((provider) => renderProviderCard(provider, false))}
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
          <h1 className="text-2xl font-light text-[#1A1D2E] sm:text-3xl">
            Something went wrong
          </h1>
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
            {error}
          </div>
          <GoldButton onClick={() => window.location.href = "/handle-first"}>
            Continue to dashboard &rarr;
          </GoldButton>
        </Shell>
      );
    }

    const progressItems = [
      { label: "Scanning your transactions", icon: "🔍" },
      { label: "Finding healthcare providers", icon: "🏥" },
      { label: "Verifying against medical databases", icon: "✅" },
      { label: "Building your care timeline", icon: "📅" },
      { label: "Checking for overdue care", icon: "⏰" },
      { label: "Preparing your dashboard", icon: "✨" },
    ];

    const healthFacts = [
      "Adults should get a physical exam at least once a year",
      "Dental cleanings are recommended every 6 months",
      "Eye exams can detect early signs of diabetes and high blood pressure",
      "Preventive care can catch 80% of health issues before they become serious",
      "The average American sees 7 different healthcare providers",
      "Staying on top of screenings reduces hospitalization risk by 40%",
      "Most insurance plans cover preventive care at no extra cost",
    ];

    const factIndex = Math.floor(analysisProgress * 1.5) % healthFacts.length;

    return (
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-8 text-left w-full">
            <CharacterWithBubble pose="thinking">
              Give me just a moment &mdash; I&apos;m scanning your transactions
              to find your healthcare providers. I&apos;ll match them against
              medical databases to make sure I get it right.
            </CharacterWithBubble>
          </div>

          {/* Pulsing animation */}
          <div className="relative mb-6">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)",
                animation: "pulse-glow 2s ease-in-out infinite",
              }}
            >
              <span className="text-2xl text-white font-bold">K</span>
            </div>
            <style>{`
              @keyframes pulse-glow {
                0%, 100% { box-shadow: 0 0 0 0 rgba(92,107,92,0.4); }
                50% { box-shadow: 0 0 0 16px rgba(92,107,92,0); }
              }
            `}</style>
          </div>

          <h1 className="text-2xl font-light text-[#1A1D2E] sm:text-3xl">
            Kate is getting started
          </h1>
          <p className="mt-2 text-sm text-[#7A7F8A]">
            This usually takes a minute or two
          </p>

          {/* Progress steps */}
          <div className="mt-8 flex flex-col gap-2.5 text-left w-full max-w-sm">
            {progressItems.map((item, i) => {
              const done = analysisProgress >= i + 1;
              const active = analysisProgress === i;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-500 shadow-sm"
                  style={{
                    backgroundColor: CARD_BG,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: done ? ACCENT : active ? "#B0D0E8" : CARD_BORDER,
                    opacity: analysisProgress >= i ? 1 : 0.3,
                    transform: active ? "scale(1.02)" : "scale(1)",
                  }}
                >
                  {done ? (
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: ACCENT, color: "#FFFFFF" }}
                    >
                      ✓
                    </span>
                  ) : active ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#5C6B5C] border-t-transparent" />
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-sm">
                      {item.icon}
                    </span>
                  )}
                  <span
                    className="text-sm transition-colors duration-500"
                    style={{ color: done ? "#1A1D2E" : active ? "#1A1D2E" : "#B0B4BC" }}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rotating health fact */}
          <div className="mt-8 max-w-sm rounded-xl bg-white border border-[#EBEDF0] shadow-sm px-5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6B5C] mb-1">
              Did you know?
            </div>
            <div className="text-xs text-[#7A7F8A] transition-opacity duration-500">
              {healthFacts[factIndex]}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // Step 9: NEW — Celebration + summary screen
  if (step === 9) {
    const isManualOnboarding = manualPath;
    const totalProviders = approvedCount + followUpCount;
    // Manual providers all need follow-up (they need booking)
    const displayFollowUp = isManualOnboarding ? totalProviders : followUpCount;

    return (
      <Shell>
        <div className="mt-8">
          <CharacterWithBubble pose="celebrating">
            {isManualOnboarding
              ? `Great — I\u2019ve got your ${totalProviders} provider${totalProviders !== 1 ? "s" : ""} saved. I\u2019ll start working on getting you booked.`
              : `You\u2019re all set! Here\u2019s what I found from your records. Let\u2019s get your healthcare on track.`}
          </CharacterWithBubble>
        </div>

        {/* Summary cards */}
        <div className="mt-8 flex flex-col gap-3">
          {[
            { value: String(totalProviders), label: isManualOnboarding ? "providers added" : "providers identified" },
            { value: String(displayFollowUp), label: "ready to book" },
            { value: "\u2713", label: "Health timeline started" },
          ].map((card) => (
            <div
              key={card.label}
              className="flex items-center gap-4 rounded-xl px-5 py-4 text-sm"
              style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: ACCENT, color: "#FFFFFF" }}
              >
                {card.value}
              </span>
              <span className="text-[#1A1D2E]">{card.label}</span>
            </div>
          ))}
        </div>

        <GoldButton onClick={() => window.location.href = "/handle-first"}>
          See your dashboard &rarr;
        </GoldButton>
      </Shell>
    );
  }

  // Step 10: Dashboard redirect (fallback)
  if (step === 10) {
    window.location.href = "/handle-first";
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
      <div className="mt-8">
        <CharacterWithBubble pose="thinking">
          QB found three providers I&apos;d completely forgotten about and booked
          my overdue physical in minutes. You&apos;re in good hands.
        </CharacterWithBubble>
      </div>

      <p className="mt-4 text-center text-xs text-[#7A7F8A]">&mdash; Early QB member</p>

      {/* Trust points */}
      <div className="mt-8 flex justify-center gap-4">
        {[
          { icon: "\u25C9", label: "Bank-level security" },
          { icon: "\u25C9", label: "Read-only access" },
          { icon: "\u25C9", label: "No data sold" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-2" style={{ minWidth: 88 }}>
            <span className="text-lg">{item.icon}</span>
            <span className="text-xs text-[#7A7F8A]">{item.label}</span>
          </div>
        ))}
      </div>

      <GoldButton onClick={handleClick}>Continue &rarr;</GoldButton>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell layout wrapper                                               */
/* ------------------------------------------------------------------ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative min-h-screen overflow-x-hidden text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <DecorativeCircle />
      <div className="relative z-10 mx-auto max-w-lg px-6 py-12 sm:max-w-xl sm:py-20 md:max-w-2xl">
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
