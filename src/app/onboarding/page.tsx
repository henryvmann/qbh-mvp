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
        <span className="text-emerald-400 text-xs font-medium">Connected ✓</span>
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
  const [pendingProviders, setPendingProviders] = useState<Array<{ id: string; name: string; visit_count: number }>>([]);
  const [reviewingProviders, setReviewingProviders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const plaidHandlerRef = useRef<{ open: () => void } | null>(null);

  // No auth guard here — if someone explicitly navigates to /onboarding,
  // let them through. The home page handles the "authenticated → dashboard" redirect.

  /* ---- initialise user id ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if returning from native OAuth with Plaid already connected
    const nativePlaidDone = window.localStorage.getItem("qbh_plaid_connected");
    if (nativePlaidDone) {
      setPlaidConnected(true);
      const savedId = window.localStorage.getItem("qbh_user_id") || "";
      if (savedId) setUserId(savedId);
      setStep(6); // jump to discovery
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

  // Calendar connect deferred to after auth — just a toggle at step 5

  /* ---- Step 5 continue: create user ---- */
  const handleStep5Continue = useCallback(async () => {
    if (!name.trim() || !email.trim() || password.length < 6) return;
    setError(null);

    try {
      const supabase = createClient();

      // Sign up with email + password
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            app_user_id: userId,
            survey_answers: JSON.stringify(survey),
          },
        },
      });

      if (signUpError) throw signUpError;

      // Sign in immediately to create a session (signUp may not if email confirmation is on)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      // Link the auth user to the app_users row
      if (signUpData.user) {
        await apiFetch("/api/auth/link-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_user_id: userId,
            auth_user_id: signUpData.user.id,
          }),
        });
      }

      setStep(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    }
  }, [name, email, password, userId, survey]);

  /* ---- Step 6: run discovery ---- */
  useEffect(() => {
    if (step !== 6) return;
    let cancelled = false;

    setLoadingDiscovery(true);
    setAnalysisProgress(0);

    // Animate progress
    const progressInterval = window.setInterval(() => {
      setAnalysisProgress((p) => {
        if (p >= 2) {
          window.clearInterval(progressInterval);
          return 2;
        }
        return p + 1;
      });
    }, 1500);

    async function runDiscovery() {
      try {
        const effectiveUserId =
          userId || window.localStorage.getItem("qbh_user_id") || "";

        // Exchange Plaid token if we have one (web flow)
        if (plaidPublicToken) {
          const exchangeRes = await apiFetch("/api/plaid/exchange-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              app_user_id: effectiveUserId,
              public_token: plaidPublicToken,
            }),
          });
          const exchangeData = await exchangeRes.json();
          if (!exchangeRes.ok || !exchangeData?.ok) {
            throw new Error(
              exchangeData?.error || "Failed to exchange Plaid token."
            );
          }
        }

        // Run discovery if Plaid was connected at all
        if (plaidConnected || plaidPublicToken) {
          const discRes = await apiFetch("/api/discovery/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              app_user_id:
                effectiveUserId ||
                window.localStorage.getItem("qbh_user_id") ||
                "",
            }),
          });
          const discData = await discRes.json();
          if (discRes.ok && discData?.results) {
            if (!cancelled) setDiscoveryResults(discData.results);
          }
        }

        // Small delay so animation feels natural
        await new Promise((r) => setTimeout(r, 1200));

        if (!cancelled) {
          // Fetch providers needing review
          const effectiveId = effectiveUserId || window.localStorage.getItem("qbh_user_id") || "";
          try {
            const pendingRes = await apiFetch(`/api/providers/pending?app_user_id=${encodeURIComponent(effectiveId)}`);
            const pendingData = await pendingRes.json();
            if (pendingRes.ok && pendingData?.providers?.length > 0) {
              setPendingProviders(pendingData.providers);
              setReviewingProviders(true);
              setLoadingDiscovery(false);
              return; // show review step instead of advancing
            }
          } catch {
            // If pending fetch fails, just skip review
          }
          setLoadingDiscovery(false);
          // Go to dashboard — user is authenticated, discovery is done
          router.push("/dashboard");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Discovery failed:", err);
          setLoadingDiscovery(false);
          router.push("/dashboard"); // go to dashboard even on error
        }
      }
    }

    runDiscovery();

    return () => {
      cancelled = true;
      window.clearInterval(progressInterval);
    };
  }, [step, plaidPublicToken, plaidConnected, userId]);

  /* ---- render per step ---- */

  // Step 0: Splash
  if (step === 0) {
    return (
      <Shell>
        <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: GOLD }}
          >
            QBH ✦ Your Health Ally
          </p>
          <h1 className="mt-6 max-w-md text-3xl font-light leading-snug text-[#EFF4FF] sm:text-4xl">
            You don&apos;t have to manage this alone.
          </h1>
          <p className="mt-4 max-w-sm text-base text-[#6B85A8]">
            QB keeps track, follows up, and handles the details so you
            don&apos;t have to.
          </p>
          <GoldButton onClick={() => setStep(1)}>Continue &rarr;</GoldButton>
        </div>
      </Shell>
    );
  }

  // Step 1: What do you want help staying on top of?
  if (step === 1) {
    return (
      <Shell>
        <StepCounter current={1} total={8} />
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

  // Step 2: What's hardest to manage today?
  if (step === 2) {
    return (
      <Shell>
        <StepCounter current={2} total={8} />
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
          onClick={() => setStep(3)}
          disabled={survey.step2.length === 0}
        >
          Continue &rarr;
        </GoldButton>
      </Shell>
    );
  }

  // Step 3: Who are you managing care for? (multi-select)
  if (step === 3) {
    return (
      <Shell>
        <StepCounter current={3} total={8} />
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
          onClick={() => setStep(4)}
          disabled={survey.step3.length === 0}
        >
          Continue &rarr;
        </GoldButton>
      </Shell>
    );
  }

  // Step 4: What would you want QB to handle?
  if (step === 4) {
    return (
      <Shell>
        <StepCounter current={4} total={8} />
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
          onClick={() => setStep(5)}
          disabled={survey.step4.length === 0}
        >
          Continue &rarr;
        </GoldButton>
      </Shell>
    );
  }

  // Step 5: Let's get you set up
  if (step === 5) {
    const canContinue = name.trim().length > 0 && email.trim().length > 0 && password.length >= 6;
    return (
      <Shell>
        <StepCounter current={5} total={8} />
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
          <GoldButton onClick={handleStep5Continue} disabled={!canContinue}>
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

  // Step 6: QB is getting started
  if (step === 6) {
    const progressLabels = [
      "Organizing",
      "Identifying",
      "Preparing",
    ];
    return (
      <Shell>
        <StepCounter current={6} total={8} />
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          QB is getting started
        </h1>
        <p className="mt-2 text-sm text-[#6B85A8]">
          {progressLabels.join(" \u2022 ")}
        </p>

        <div className="mt-10 flex flex-col items-center gap-6">
          {/* animated spinner */}
          <div className="relative h-24 w-24">
            <div
              className="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
              style={{
                borderTopColor: GOLD,
                borderRightColor: GOLD,
                animationDuration: "1.2s",
              }}
            />
            <div
              className="absolute inset-3 animate-spin rounded-full border-2 border-transparent"
              style={{
                borderBottomColor: "#6B85A8",
                animationDuration: "2s",
                animationDirection: "reverse",
              }}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {progressLabels.map((label, i) => (
              <div
                key={label}
                className="flex items-center gap-3 text-sm transition-opacity duration-500"
                style={{ opacity: i <= analysisProgress ? 1 : 0.3 }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      i <= analysisProgress ? GOLD : "#3A4A66",
                  }}
                />
                <span className="text-[#EFF4FF]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  // Provider review step (between step 6 and 7)
  if (step === 6 && reviewingProviders && pendingProviders.length > 0) {
    async function handleProviderReview(providerId: string, action: "approve" | "dismiss") {
      const effectiveUserId = userId || window.localStorage.getItem("qbh_user_id") || "";
      try {
        await apiFetch("/api/providers/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider_id: providerId, action, app_user_id: effectiveUserId }),
        });
      } catch {
        // Best-effort
      }
      setPendingProviders((prev) => prev.filter((p) => p.id !== providerId));
    }

    const remaining = pendingProviders.length;

    return (
      <Shell>
        <StepCounter current={6} total={8} />
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          We found these — are they your healthcare providers?
        </h1>
        <p className="mt-2 text-sm text-[#6B85A8]">
          {remaining} provider{remaining !== 1 ? "s" : ""} to review
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {pendingProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between rounded-xl border px-4 py-3"
              style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
            >
              <div>
                <div className="text-sm font-medium text-[#EFF4FF]">{provider.name}</div>
                <div className="text-xs text-[#6B85A8]">
                  {provider.visit_count} transaction{provider.visit_count !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleProviderReview(provider.id, "approve")}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ backgroundColor: GOLD, color: NAVY }}
                >
                  Yes
                </button>
                <button
                  onClick={() => handleProviderReview(provider.id, "dismiss")}
                  className="rounded-lg border border-white/10 bg-[#1A2336] px-3 py-1.5 text-xs text-[#6B85A8]"
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>

        {pendingProviders.length === 0 && (
          <GoldButton onClick={() => router.push("/dashboard")}>
            Enter QB &rarr;
          </GoldButton>
        )}
      </Shell>
    );
  }

  // Step 7: Here's what QB can help with
  if (step === 7) {
    const items: DiscoveryResult[] =
      discoveryResults.length > 0
        ? discoveryResults
        : [
            { label: "Health timeline created" },
            { label: "Upcoming checkups identified" },
            { label: "Care history organized" },
          ];
    return (
      <Shell>
        <StepCounter current={7} total={8} />
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          Here&apos;s what QB can help with
        </h1>

        <div className="mt-6 flex flex-col gap-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl px-5 py-4 text-sm"
              style={{
                backgroundColor: CARD_BG,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: CARD_BORDER,
              }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                {i + 1}
              </span>
              <div>
                <div className="text-[#EFF4FF]">{item.label}</div>
                {item.detail && (
                  <div className="mt-0.5 text-xs text-[#6B85A8]">
                    {item.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <GoldButton onClick={() => setStep(8)}>Continue &rarr;</GoldButton>
      </Shell>
    );
  }

  // Step 8: Let's test this out
  if (step === 8) {
    const actions =
      discoveryResults.length > 0
        ? discoveryResults.slice(0, 3).map((r) => r.label)
        : [
            "Book with your primary doctor",
            "Sync MyChart / Aetna / Epic",
            "View timeline",
          ];
    return (
      <Shell>
        <StepCounter current={8} total={8} />
        <h1 className="text-2xl font-light text-[#EFF4FF] sm:text-3xl">
          Let&apos;s test this out
        </h1>

        <div className="mt-6 flex flex-col gap-3">
          {actions.map((action, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl px-5 py-4 text-sm"
              style={{
                backgroundColor: CARD_BG,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: CARD_BORDER,
              }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: GOLD }}
              />
              <span className="text-[#EFF4FF]">{action}</span>
            </div>
          ))}
        </div>

        <GoldButton onClick={() => setStep(9)}>Continue &rarr;</GoldButton>
      </Shell>
    );
  }

  // Step 9: Final
  if (step === 9) {
    return (
      <Shell>
        <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
          <h1 className="max-w-md text-2xl font-light leading-snug text-[#EFF4FF] sm:text-3xl">
            You don&apos;t have to manage this alone anymore
          </h1>
          <p className="mt-4 max-w-sm text-base text-[#6B85A8]">
            QB keeps track, follows up, and handles the details — so you
            don&apos;t have to.
          </p>

          <div className="mt-8 flex flex-col gap-2 text-sm text-emerald-400">
            {plaidConnected && <span>First appointment reminder set ✓</span>}
            <span>Health history secured ✓</span>
          </div>

          <GoldButton onClick={() => router.push("/dashboard")}>
            Enter QB &rarr;
          </GoldButton>
        </div>
      </Shell>
    );
  }

  // Fallback (should never render)
  return null;
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
