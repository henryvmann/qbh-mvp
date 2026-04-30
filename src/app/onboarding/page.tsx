"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Calendar, Building2, ShieldCheck, Brain, Phone, Eye, EyeOff } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { createClient } from "../../lib/supabase/client";
import { theme } from "../../components/qbh/theme";

/* ── Design tokens (from greenhouse theme) ── */
const BG = theme.bgGradient;
const ACCENT = theme.green;
const CARD_BG = theme.glass;
const CARD_BORDER = theme.glassBorder;
const TEXT_PRIMARY = theme.textPrimary;
const TEXT_SECONDARY = "#7A7F8A";
const TEXT_MUTED = "#B0B4BC";

/* ── Types ── */
type ChatMessage = {
  id: string;
  sender: "kate" | "user" | "system";
  content: React.ReactNode;
  delay?: number;
};

type DiscoveredProvider = {
  id: string;
  name: string;
  visit_count: number;
  status: string;
  overdue?: boolean;
};

/* ── Plaid script loader ── */
function ensurePlaidScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Plaid) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Plaid"));
    document.head.appendChild(s);
  });
}

/* ── Chat Bubble ── */
function KateBubble({ children, typing }: { children: React.ReactNode; typing?: boolean }) {
  return (
    <div className="flex items-start gap-3 animate-fadeIn">
      <Image src="/kate-avatar.png" alt="Kate" width={32} height={32} className="rounded-full shrink-0 mt-1" />
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm backdrop-blur-sm px-4 py-3" style={{ background: theme.glass, border: `1px solid ${theme.glassBorder}`, boxShadow: theme.cardShadow }}>
        {typing ? (
          <div className="flex gap-1 py-1">
            <span className="h-2 w-2 rounded-full bg-[#B0B4BC] animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 rounded-full bg-[#B0B4BC] animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 rounded-full bg-[#B0B4BC] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        ) : (
          <div className="text-sm text-[#1A1D2E] leading-relaxed">{children}</div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end animate-fadeIn">
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white font-medium" style={{ backgroundColor: ACCENT }}>
        {children}
      </div>
    </div>
  );
}

function OptionButtons({ options, onSelect }: { options: Array<{ label: string; value: string }>; onSelect: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 justify-end animate-fadeIn">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className="rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98]"
          style={{
            backgroundColor: "#4A6B4A",
            border: "1px solid #4A6B4A",
            color: "#FFFFFF",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleCard({ icon: Icon, title, description, selected, onToggle }: {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected ? "border-[#5C6B5C] bg-[#5C6B5C]/5 ring-1 ring-[#5C6B5C]" : "border-white/70 bg-white/55 backdrop-blur-sm hover:border-[#B0B4BC]"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon size={20} className={selected ? "text-[#5C6B5C]" : "text-[#B0B4BC]"} />
        <div className="flex-1">
          <div className="text-sm font-semibold text-[#1A1D2E]">{title}</div>
          <p className="mt-1 text-xs text-[#7A7F8A] leading-relaxed">{description}</p>
        </div>
        <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition ${
          selected ? "border-[#5C6B5C] bg-[#5C6B5C]" : "border-[#D0D3D8]"
        }`}>
          {selected && <span className="text-white text-[10px]">&#10003;</span>}
        </div>
      </div>
    </button>
  );
}

/* ── Main Component ── */
export default function OnboardingPage() {
  const router = useRouter();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const plaidHandlerRef = useRef<{ destroy: () => void } | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<string>("intro");
  const [typing, setTyping] = useState(false);

  // User data
  const [userId] = useState(() => typeof window !== "undefined" ? (localStorage.getItem("qbh_user_id") || crypto.randomUUID()) : crypto.randomUUID());
  const [careFor, setCareFor] = useState<string>("just-me");
  const [familyMembers, setFamilyMembers] = useState<string[]>([]);
  const [connectBank, setConnectBank] = useState(false);
  const [connectCalendar, setConnectCalendar] = useState(false);
  const [connectManual, setConnectManual] = useState(false);

  // Account fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [patientDob, setPatientDob] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [patientInsurance, setPatientInsurance] = useState("");
  const [patientMemberId, setPatientMemberId] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Plaid
  const [plaidConnected, setPlaidConnected] = useState(false);

  // Discovery
  const [discoveredProviders, setDiscoveredProviders] = useState<DiscoveredProvider[]>([]);
  // Active during the bank/calendar discovery polling window so we can show
  // a "Skip and continue" escape hatch (T3-3 — page used to look frozen).
  const [discoveryActive, setDiscoveryActive] = useState(false);
  // Tracks which selected step is mid-flight so the inline Skip button
  // can advance to the next selected step instead of jumping to score.
  const [currentDiscoveryStep, setCurrentDiscoveryStep] = useState<"bank" | "calendar" | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);
  const [revealDone, setRevealDone] = useState(false);

  // Manual NPI search (third step in the discovery pipeline)
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [manualSearchResults, setManualSearchResults] = useState<Array<{ name: string; npi: string; specialty?: string; phone?: string; address?: string }>>([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [manualAdding, setManualAdding] = useState<string | null>(null);
  const [manualAdded, setManualAdded] = useState<Set<string>>(new Set());

  // Review queue — providers the classifier flagged ambiguous (review_needed
  // status) plus pharmacies. We surface them once at the end of all bank/
  // calendar discovery so the user can confirm "this is care for me" or
  // dismiss "just shopping" before reaching the dashboard.
  type AmbiguousProvider = { id: string; name: string; status: string; provider_type: string | null };
  const [ambiguousProviders, setAmbiguousProviders] = useState<AmbiguousProvider[]>([]);
  const [reviewActioning, setReviewActioning] = useState<string | null>(null);
  // Where to go when review-team completes (set when we route into it).
  const [postReviewPhase, setPostReviewPhase] = useState<string>("score-reveal");

  // Score
  const [score, setScore] = useState<number | null>(null);

  // Save userId
  useEffect(() => {
    localStorage.setItem("qbh_user_id", userId);
  }, [userId]);

  // T3-4: if the visitor already has an authenticated session, they
  // already created their account — don't restart the intro. Send them
  // to the dashboard instead. (Common case: user creates account, mid-
  // Plaid the page freezes, they refresh, and end up looking at the
  // welcome screen they just completed.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Honor the Google-Calendar return path — that effect runs separately
    // and we don't want to redirect away before it can resume the flow.
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected") === "1") return;

    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data?.session?.user) {
          router.replace("/dashboard");
        }
      } catch {
        // If auth check fails, fall through to normal onboarding
      }
    })();
    return () => {
      cancelled = true;
    };
  // Run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume after Google Calendar OAuth round-trip. The callback redirects to
  // /onboarding?calendar_connected=1 when the user came in via the onboarding
  // calendar-connect step. Pick up the flow and run calendar discovery.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected") !== "1") return;

    // Strip the param so a refresh doesn't loop
    const url = new URL(window.location.href);
    url.searchParams.delete("calendar_connected");
    url.searchParams.delete("user_id");
    window.history.replaceState({}, "", url.toString());

    setPhase("discovery-reveal");
    addKateMessage("Calendar connected. Scanning for doctor appointments now…");
    setTimeout(() => {
      runCalendarDiscovery();
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom — include discoveryActive so the Skip button is
  // brought into view the moment it renders (otherwise it sits below the
  // fold while the user stares at "Give me a sec").
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase, typing, discoveryActive]);

  // Add Kate message with typing delay
  function addKateMessage(content: React.ReactNode, delayMs = 800) {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, { id: `kate-${Date.now()}-${Math.random()}`, sender: "kate", content }]);
    }, delayMs);
  }

  function addKateMessages(contents: React.ReactNode[], baseDelay = 800, gap = 600) {
    contents.forEach((content, i) => {
      setTimeout(() => {
        if (i < contents.length - 1) {
          setMessages((prev) => [...prev, { id: `kate-${Date.now()}-${i}`, sender: "kate", content }]);
        } else {
          setTyping(false);
          setMessages((prev) => [...prev, { id: `kate-${Date.now()}-${i}`, sender: "kate", content }]);
        }
      }, baseDelay + i * gap);
    });
    setTyping(true);
    // Stop typing when last message lands
    setTimeout(() => setTyping(false), baseDelay + (contents.length - 1) * gap);
  }

  function addUserMessage(content: string) {
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: "user", content }]);
  }

  // ── Phase: Intro ──
  useEffect(() => {
    if (phase !== "intro") return;
    const t1 = setTimeout(() => {
      setMessages([{ id: "k1", sender: "kate", content: "Hey \u2014 I'm Kate. I take healthcare off your plate." }]);
    }, 600);
    const t2 = setTimeout(() => {
      setMessages((prev) => [...prev, { id: "k2", sender: "kate", content: "Here's what I've noticed: most people have five, six, maybe seven doctors. And if I asked you when you last saw each one..." }]);
    }, 2000);
    const t3 = setTimeout(() => {
      setMessages((prev) => [...prev, { id: "k3", sender: "kate", content: "...you'd probably have to guess." }]);
      setTyping(false);
    }, 3400);
    setTyping(true);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase]);

  // ── Phase handlers ──
  function handleIntroResponse(value: string) {
    if (value === "relatable") {
      addUserMessage("Yeah, that's me");
      setTimeout(() => {
        addKateMessages([
          "No judgment \u2014 that's literally everyone. The system isn't built for you to keep track.",
          "But I am. Here's what you can look forward to:"
        ]);
        setTimeout(() => setPhase("value-props"), 2400);
      }, 400);
    } else {
      addUserMessage("I'm actually pretty on top of it");
      setTimeout(() => {
        addKateMessages([
          "Love that. But I bet even you have a provider or two that's slipped through the cracks.",
          "Either way \u2014 I'm about to make your life easier. Here's what you can look forward to:"
        ]);
        setTimeout(() => setPhase("value-props"), 2400);
      }, 400);
    }
  }

  function handleValuePropsNext() {
    addUserMessage("Let's do it");
    setTimeout(() => {
      addKateMessage("Quick question \u2014 is this just for you, or are you managing care for your people too?");
      setTimeout(() => setPhase("who-for"), 1200);
    }, 400);
  }

  function handleWhoFor(value: string) {
    setCareFor(value);
    if (value === "just-me") {
      addUserMessage("Just me");
      setFamilyMembers([]);
      setTimeout(() => {
        setPhase("discovery-method");
        addKateMessage("Let's pull in your doctors. Pick whichever's easiest \u2014 or all three. I'll handle the rest.");
      }, 400);
    } else {
      addUserMessage("Me and my family");
      setTimeout(() => {
        addKateMessage("Got it. Who else are you keeping track of?");
        setTimeout(() => setPhase("family-select"), 1200);
      }, 400);
    }
  }

  function handleFamilyDone() {
    addUserMessage(`Me${familyMembers.length > 0 ? ", " + familyMembers.join(", ") : ""}`);
    setTimeout(() => {
      addKateMessages([
        "I'll set up a separate hub for each person. Everyone's providers, appointments, and history \u2014 organized individually but managed by you.",
        "Let's pull in your doctors. Pick whichever's easiest \u2014 or all three. I'll handle the rest."
      ]);
      setTimeout(() => setPhase("discovery-method"), 2400);
    }, 400);
  }

  function handleDiscoveryMethodDone() {
    const selected: string[] = [];
    if (connectBank) selected.push("bank scan");
    if (connectCalendar) selected.push("calendar");
    if (connectManual) selected.push("manual");
    addUserMessage(selected.join(" + ") || "none");
    setTimeout(() => {
      addKateMessage("Last thing \u2014 let's set up your account so I can save everything.");
      setTimeout(() => setPhase("account-create"), 1200);
    }, 400);
  }

  // ── Discovery pipeline sequencing ──
  // After each step (bank / calendar / manual), advance to the next one the
  // user opted into. Order is fixed: bank → calendar → manual → score-reveal.
  // Pass null to start from the top (right after account-create).
  //
  // Use advanceWithReview when leaving discovery (bank/calendar) to interject
  // the review-team step if any ambiguous providers (pharmacies, classifier-
  // flagged review_needed) need user confirmation before they hit the
  // dashboard. advanceAfter is the raw helper used by the manual/skip paths.
  async function advanceWithReview(completed: "bank" | "calendar"): Promise<void> {
    const next = advanceAfter(completed);
    // Only interject review-team if discovery is done (we're heading to manual
    // or score). Skip if next is another discovery step (e.g., calendar still
    // pending after bank).
    if (next === "manual-search" || next === "score-reveal") {
      try {
        const res = await apiFetch(`/api/providers/pending?app_user_id=${userId}`);
        const data = await res.json();
        // Pending endpoint returns active + review_needed. Pull provider_type
        // from the dashboard snapshots so we can flag pharmacies. (The pending
        // route doesn't include provider_type today.)
        const dashRes = await apiFetch("/api/dashboard/data");
        const dashData = await dashRes.json().catch(() => ({}));
        const typeByName: Record<string, string | null> = {};
        for (const s of dashData?.snapshots || []) {
          if (s?.provider?.name) typeByName[s.provider.name] = s.provider.provider_type ?? null;
        }
        const ambig = (data?.providers || []).filter((p: any) => {
          if (p.status === "review_needed") return true;
          if (typeByName[p.name] === "pharmacy") return true;
          return false;
        }).map((p: any) => ({
          id: p.id, name: p.name, status: p.status, provider_type: typeByName[p.name] ?? null,
        }));
        if (ambig.length > 0) {
          setAmbiguousProviders(ambig);
          setPostReviewPhase(next);
          setPhase("review-team");
          return;
        }
      } catch {
        // If review-fetch fails, just continue without the review step.
      }
    }
    setPhase(next);
  }

  function advanceAfter(completed: "bank" | "calendar" | "manual" | null): string {
    const order: Array<"bank" | "calendar" | "manual"> = ["bank", "calendar", "manual"];
    const phaseFor: Record<"bank" | "calendar" | "manual", string> = {
      bank: "plaid-connect",
      calendar: "calendar-connect",
      manual: "manual-search",
    };
    const flagFor: Record<"bank" | "calendar" | "manual", boolean> = {
      bank: connectBank,
      calendar: connectCalendar,
      manual: connectManual,
    };
    const startIdx = completed === null ? 0 : order.indexOf(completed) + 1;
    for (let i = startIdx; i < order.length; i++) {
      if (flagFor[order[i]]) return phaseFor[order[i]];
    }
    return "score-reveal";
  }

  // ── Account creation ──
  async function handleCreateAccount() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || password.length < 6 || !consentGiven) return;
    setError(null);
    setCreatingAccount(true);

    try {
      const name = `${firstName.trim()} ${lastName.trim()}`;
      const surveyStep3 = careFor === "just-me" ? ["Myself"] : ["Myself", ...familyMembers.map((m) => m === "partner" ? "My partner / spouse" : m === "children" ? "My child(ren)" : m === "parents" ? "My parent(s)" : "Someone else")];

      const careRecipients: Array<{ id: string; name: string; relationship: string }> = [];
      careRecipients.push({ id: crypto.randomUUID(), name: firstName.trim(), relationship: "Self" });
      if (familyMembers.includes("partner")) careRecipients.push({ id: crypto.randomUUID(), name: "My Partner", relationship: "Partner" });
      if (familyMembers.includes("children")) careRecipients.push({ id: crypto.randomUUID(), name: "My Child", relationship: "Child" });
      if (familyMembers.includes("parents")) careRecipients.push({ id: crypto.randomUUID(), name: "My Parent", relationship: "Parent" });

      const signupRes = await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(), password, app_user_id: userId, name,
          survey_answers: JSON.stringify({ step1: [], step2: [], step3: surveyStep3, step4: [] }),
          care_recipients: careRecipients.length > 0 ? careRecipients : undefined,
          patient_info: {
            date_of_birth: patientDob || undefined, gender: patientGender || undefined,
            insurance_provider: patientInsurance.trim() || undefined,
            insurance_member_id: patientMemberId.trim() || undefined,
            callback_phone: patientPhone.trim() || undefined,
            zip_code: zipCode.trim() || undefined,
          },
          consents: { ai_calls: true, phi_sharing: true, terms: true, consented_at: new Date().toISOString() },
        }),
      });
      const data = await signupRes.json();
      if (!signupRes.ok || !data?.ok) throw new Error(data?.error || "Failed to create account.");

      const supabase = createClient();
      await supabase.auth.signInWithPassword({ email: email.trim(), password });

      addUserMessage("Account created");

      // Sequenced pipeline: bank → calendar → manual → score, executed
      // only for the steps the user opted into on the discovery-method screen.
      const next = advanceAfter(null);
      const msg =
        next === "plaid-connect"      ? "Account's saved. Let's connect your bank — this is where it gets handled."
        : next === "calendar-connect" ? "Account's saved. Let's connect your calendar — I'll pull anything healthcare-related."
        : next === "manual-search"    ? "Account's saved. Let's add the providers you already see."
        :                                "Account's saved. Let's head to your dashboard — you can hand me a provider anytime.";
      setTimeout(() => {
        addKateMessage(msg);
        setTimeout(() => setPhase(next), 1200);
      }, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setCreatingAccount(false);
    }
  }

  // ── Plaid ──
  const openPlaidLink = useCallback(async () => {
    try {
      const res = await apiFetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.link_token) throw new Error("Failed to create Plaid token.");

      localStorage.setItem("qbh_plaid_link_token", data.link_token);
      await ensurePlaidScript();

      const Plaid = (window as any).Plaid;
      const handler = Plaid.create({
        token: data.link_token,
        onSuccess: (publicToken: string) => {
          setPlaidConnected(true);
          (async () => {
            const exchangeRes = await apiFetch("/api/plaid/exchange-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ public_token: publicToken, app_user_id: userId }),
            });
            if (!exchangeRes.ok) {
              setError("Bank connection failed. Try again from settings.");
              return;
            }
            // discovery/run is driven from inside runBankDiscovery's poll
            // loop so we naturally retry past Plaid's PRODUCT_NOT_READY
            // window (typically 30-60s after Link).
            setTimeout(() => {
              addKateMessage("On it \u2014 pulling your records now.");
              setPhase("discovery-reveal");
              runBankDiscovery();
            }, 500);
          })();
        },
        onExit: () => {},
      });
      plaidHandlerRef.current = handler;
      handler.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open bank connection.");
    }
  }, [userId]);

  // ── Discovery ──
  async function runBankDiscovery() {
    // Surface activity so the page does not look frozen (T3-3 - without
    // these, "Give me a sec, I'm pulling your records now" sits static
    // for up to 90s with no movement and users refresh assuming it broke).
    setCurrentDiscoveryStep("bank");
    setDiscoveryActive(true);
    setTyping(true);

    const progress15 = setTimeout(() => {
      addKateMessage("Still pulling — a large transaction history can take a sec…");
    }, 15000);
    const progress45 = setTimeout(() => {
      addKateMessage("Almost there — just finishing up.");
    }, 45000);

    // Drive discovery from inside the loop so PRODUCT_NOT_READY (Plaid's
    // 30-60s post-Link warmup) naturally retries on the next tick. Once
    // discovery returns concrete provider counts (or determines truly empty),
    // we advance.
    // Drive discovery from inside the loop so Plaid's PRODUCT_NOT_READY
    // (typical 30-60s warmup after Link) naturally retries on each tick.
    let attempts = 0;
    let inFlight = false;
    const finish = (providers: DiscoveredProvider[]) => {
      clearInterval(poll);
      clearTimeout(progress15);
      clearTimeout(progress45);
      setDiscoveryActive(false);
      setTyping(false);
      setDiscoveredProviders(providers);
      startReveal(providers, "bank");
    };
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      attempts++;
      try {
        const runRes = await apiFetch("/api/discovery/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_user_id: userId }),
        });
        const runData = await runRes.json().catch(() => ({}));
        // Plaid warmup — keep polling. The route returns {ok:true, pending:true}
        // when transactions aren't ready yet.
        if (runData?.pending) {
          if (attempts > 25) finish([]); // ~75s — startReveal will message empty
          return;
        }
        if (runData?.ok) {
          const dashRes = await apiFetch("/api/dashboard/data");
          const dashData = await dashRes.json().catch(() => ({}));
          const providers = (dashData?.snapshots || [])
            .filter((s: any) => s.provider.provider_type !== "pharmacy")
            .map((s: any) => ({
              id: s.provider.id, name: s.provider.name,
              visit_count: s.visitCount || 0, status: "active",
              overdue: s.followUpNeeded && s.booking_state?.status !== "BOOKED",
            }));
          finish(providers);
          return;
        }
        if (attempts > 25) finish([]);
      } catch {
        if (attempts > 25) finish([]);
      } finally {
        inFlight = false;
      }
    };
    const poll = setInterval(tick, 3000);
    tick();
  }

  async function runCalendarDiscovery() {
    // Surface activity + skip button — same UX as runBankDiscovery so the
    // calendar path doesn't go silent for 30+ seconds during scan.
    setCurrentDiscoveryStep("calendar");
    setDiscoveryActive(true);
    setTyping(true);

    const progress15 = setTimeout(() => {
      addKateMessage("Still scanning — checking the last year of events…");
    }, 15000);

    try {
      await apiFetch("/api/calendar/scan", { method: "POST" });
      const res = await apiFetch("/api/dashboard/data");
      const data = await res.json();
      clearTimeout(progress15);
      setDiscoveryActive(false);
      setTyping(false);
      if (data?.ok && data.snapshots?.length > 0) {
        const providers = data.snapshots
          .filter((s: any) => s.provider.provider_type !== "pharmacy")
          .map((s: any) => ({
            id: s.provider.id, name: s.provider.name,
            visit_count: s.visitCount || 0, status: "active",
            overdue: s.followUpNeeded && s.booking_state?.status !== "BOOKED",
          }));
        setDiscoveredProviders(providers);
        startReveal(providers, "calendar");
      } else {
        addKateMessage("Nothing healthcare-related on your calendar yet. No worries — you can hand me a name from the dashboard anytime.");
        setTimeout(() => { advanceWithReview("calendar"); }, 1500);
      }
    } catch {
      clearTimeout(progress15);
      setDiscoveryActive(false);
      setTyping(false);
      addKateMessage("Couldn't scan your calendar right now. No worries — you can connect it later from settings.");
      setTimeout(() => { advanceWithReview("calendar"); }, 1500);
    }
  }

  function startReveal(providers: DiscoveredProvider[], justCompleted: "bank" | "calendar") {
    setRevealIndex(0);
    setRevealDone(false);
    // 0 providers: skip the per-item reveal animation but still announce
    // the empty result and advance to the next selected step.
    if (providers.length === 0) {
      addKateMessage(
        justCompleted === "bank"
          ? "Nothing healthcare-related in your transactions yet — could be a different bank, or insurance covers it."
          : "Nothing healthcare-related on your calendar yet."
      );
      setRevealDone(true);
      setTimeout(() => { advanceWithReview(justCompleted); }, 1500);
      return;
    }
    // Faster, more responsive reveal: first card lands immediately so the
    // panel doesn't sit blank while the chat message is still being shown.
    providers.forEach((_, i) => {
      setTimeout(() => {
        setRevealIndex(i + 1);
        if (i === providers.length - 1) {
          setTimeout(() => {
            const overdueCount = providers.filter((p) => p.overdue).length;
            const onTrack = providers.length - overdueCount;
            addKateMessage(`Found ${providers.length} on your team. ${onTrack} on track, ${overdueCount} might be overdue — I'll get those scheduled.`);
            setRevealDone(true);
            const next = advanceAfter(justCompleted);
            if (next === "calendar-connect") {
              // Calendar comes next — go straight in, no review interjection yet
              setTimeout(() => {
                addKateMessage("Now let's grab your calendar too — I'll scan for doctor appointments.");
                setTimeout(() => setPhase(next), 1200);
              }, 1500);
            } else {
              // Bank or calendar finished and there's no further discovery —
              // route through review-team if any ambiguous providers exist.
              setTimeout(() => { advanceWithReview(justCompleted); }, 1500);
            }
          }, 600);
        }
      }, 700 * i + 200);
    });
  }

  // ── Score ──
  useEffect(() => {
    if (phase !== "score-reveal") return;
    apiFetch("/api/health-score")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setScore(d.score); })
      .catch(() => setScore(0));
  }, [phase]);

  // ── Manual-search debounce ──
  // Single source of truth for the NPI search query; cancels stale fetches.
  useEffect(() => {
    if (phase !== "manual-search") return;
    const q = manualSearchQuery.trim();
    if (q.length < 2) { setManualSearchResults([]); setManualSearching(false); return; }
    let cancelled = false;
    setManualSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/npi/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!cancelled && data?.ok) setManualSearchResults(data.results || []);
      } catch {} finally { if (!cancelled) setManualSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [manualSearchQuery, phase]);

  // ── Insurance autocomplete ──
  const KNOWN_INSURANCE = ["Aetna","Anthem","Anthem Blue Cross Blue Shield","Blue Cross Blue Shield","Cigna","ConnectiCare","EmblemHealth","Empire BCBS","Excellus BCBS","Florida Blue","Harvard Pilgrim","Highmark BCBS","Horizon BCBS","Humana","Independence Blue Cross","Kaiser Permanente","Medicaid","Medicare","Molina Healthcare","Oscar Health","Oxford","Premera Blue Cross","TRICARE","UnitedHealthcare","WellCare"];
  const filteredInsurance = patientInsurance.length >= 2
    ? KNOWN_INSURANCE.filter((i) => i.toLowerCase().includes(patientInsurance.toLowerCase()))
    : [];

  // ── Password checks ──
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isUnder18 = (() => {
    if (!patientDob) return false;
    const dob = new Date(patientDob + "T00:00:00");
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age < 18;
  })();
  const canCreate = firstName.trim().length > 0 && lastName.trim().length > 0 && email.trim().length > 0 && password.length >= 6 && consentGiven && !isUnder18 && !creatingAccount;

  // ── Render ──
  return (
    <div className="min-h-screen relative" style={{ background: BG }}>
      {/* Greenhouse grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        opacity: theme.gridOpacity,
        backgroundImage: `linear-gradient(${theme.gridTeal} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridGold} 1px, transparent 1px)`,
        backgroundSize: theme.gridSize,
      }} />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out both; }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-md border-b px-6 py-3" style={{ background: "rgba(205,219,214,0.8)", borderColor: theme.glassBorder }}>
        <div className="mx-auto max-w-lg flex items-center gap-2">
          <Image src="/kate-avatar.png" alt="Kate" width={28} height={28} className="rounded-full" />
          <span className="text-sm font-semibold text-[#1A1D2E]">Kate</span>
          <span className="text-[10px] text-[#5C6B5C] font-medium ml-1">Care Coordinator</span>
        </div>
      </div>

      {/* Chat area */}
      <div className="mx-auto max-w-lg px-6 py-6 space-y-4 pb-32">
        {/* Rendered messages */}
        {messages.map((msg) => (
          msg.sender === "kate" ? (
            <KateBubble key={msg.id}>{msg.content}</KateBubble>
          ) : msg.sender === "user" ? (
            <UserBubble key={msg.id}>{msg.content}</UserBubble>
          ) : null
        ))}

        {/* Typing indicator */}
        {typing && <KateBubble typing>{null}</KateBubble>}

        {/* ── Phase-specific interactive content ── */}

        {/* Intro: response buttons */}
        {phase === "intro" && !typing && messages.length >= 3 && (
          <OptionButtons
            options={[
              { label: "Yeah, that's me", value: "relatable" },
              { label: "I'm actually pretty on top of it", value: "organized" },
            ]}
            onSelect={(v) => { setPhase("intro-responded"); handleIntroResponse(v); }}
          />
        )}

        {/* Value Props */}
        {phase === "value-props" && !typing && (
          <div className="space-y-3 animate-fadeIn">
            <div className="rounded-2xl backdrop-blur-sm p-4 flex items-start gap-3">
              <Search size={20} className="text-[#5C6B5C] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-[#1A1D2E]">I'll find every doctor you've seen</div>
                <p className="mt-1 text-xs text-[#7A7F8A]">I scan your co-pays and pull your complete provider history. No typing, no remembering.</p>
              </div>
            </div>
            <div className="rounded-2xl backdrop-blur-sm p-4 flex items-start gap-3">
              <Phone size={20} className="text-[#5C6B5C] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-[#1A1D2E]">Book appointments for you</div>
                <p className="mt-1 text-xs text-[#7A7F8A]">I call the office, navigate the phone tree, and schedule. You don't pick up the phone.</p>
              </div>
            </div>
            <div className="rounded-2xl backdrop-blur-sm p-4 flex items-start gap-3">
              <Brain size={20} className="text-[#5C6B5C] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-[#1A1D2E]">Connect the dots</div>
                <p className="mt-1 text-xs text-[#7A7F8A]">I track what's overdue, prep you before visits, and follow up after. Your health — organized.</p>
              </div>
            </div>
            <OptionButtons options={[{ label: "Let's do it", value: "go" }]} onSelect={handleValuePropsNext} />
          </div>
        )}

        {/* Who for */}
        {phase === "who-for" && !typing && (
          <OptionButtons
            options={[
              { label: "Just me", value: "just-me" },
              { label: "Me and my family", value: "family" },
            ]}
            onSelect={handleWhoFor}
          />
        )}

        {/* Family select */}
        {phase === "family-select" && !typing && (
          <div className="space-y-2 animate-fadeIn">
            <p className="text-xs text-[#7A7F8A] mb-1">Select as many as you need</p>
            {[
              { label: "My partner/spouse", value: "partner" },
              { label: "My kid(s)", value: "children" },
              { label: "My parent(s)", value: "parents" },
              { label: "Someone else", value: "other" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFamilyMembers((prev) => prev.includes(opt.value) ? prev.filter((v) => v !== opt.value) : [...prev, opt.value])}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                  familyMembers.includes(opt.value) ? "border-[#5C6B5C] bg-[#5C6B5C]/5 text-[#1A1D2E]" : "border-[#EBEDF0] bg-white text-[#7A7F8A]"
                }`}
              >
                {familyMembers.includes(opt.value) ? "✓ " : ""}{opt.label}
              </button>
            ))}
            <button
              onClick={handleFamilyDone}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white mt-2"
              style={{ backgroundColor: ACCENT }}
            >
              That's everyone
            </button>
          </div>
        )}

        {/* Discovery method */}
        {phase === "discovery-method" && !typing && (
          <div className="space-y-3 animate-fadeIn">
            <p className="text-sm font-semibold text-[#1A2E1A] mb-2">Pick at least one to continue</p>
            <ToggleCard
              icon={Building2}
              title="Scan your bank"
              description="Your co-pays are a breadcrumb trail to every doctor you've seen. Powered by Plaid — bank-level encryption, read-only, never stores credentials."
              selected={connectBank}
              onToggle={() => setConnectBank(!connectBank)}
            />
            <ToggleCard
              icon={Calendar}
              title="Scan your calendar"
              description="I'll look through your Google or Outlook calendar for past and future doctor appointments, and add them to your timeline."
              selected={connectCalendar}
              onToggle={() => setConnectCalendar(!connectCalendar)}
            />
            <ToggleCard
              icon={Search}
              title="I'll add them myself"
              description="Know your doctors? You can search by name and add them one by one from your dashboard."
              selected={connectManual}
              onToggle={() => setConnectManual(!connectManual)}
            />
            {(connectBank || connectCalendar || connectManual) && (
              <button
                onClick={handleDiscoveryMethodDone}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                Let's go
              </button>
            )}
          </div>
        )}

        {/* Account creation */}
        {phase === "account-create" && !typing && (
          <div className="animate-fadeIn rounded-2xl backdrop-blur-sm p-5 space-y-3" style={{ background: theme.glass, border: `1px solid ${theme.glassBorder}`, boxShadow: theme.cardShadow }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">First name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">Last name</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#1A1D2E] pr-10 focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B0B4BC]">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                  <span style={{ color: password.length >= 8 ? "#22C55E" : "#B0B4BC" }}>{password.length >= 8 ? "✓" : "○"} 8+ characters</span>
                  <span style={{ color: hasUpper && hasLower ? "#22C55E" : "#B0B4BC" }}>{hasUpper && hasLower ? "✓" : "○"} Upper & lower</span>
                  <span style={{ color: hasNumber ? "#22C55E" : "#B0B4BC" }}>{hasNumber ? "✓" : "○"} Number</span>
                  <span style={{ color: hasSpecial ? "#22C55E" : "#B0B4BC" }}>{hasSpecial ? "✓" : "○"} Special char</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">Date of birth</label>
                <input type="date" value={patientDob} onChange={(e) => setPatientDob(e.target.value)} className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]" style={isUnder18 ? { borderColor: "#E53E3E" } : {}} />
                {isUnder18 && <p className="mt-1 text-[10px] text-red-500">Must be 18 or older.</p>}
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">Sex</label>
                <div className="flex gap-1.5">
                  {[{ v: "male", l: "Male" }, { v: "female", l: "Female" }, { v: "non-binary", l: "Non-binary" }, { v: "other", l: "Other" }, { v: "prefer-not-to-say", l: "Prefer not to say" }].map((o) => (
                    <button key={o.v} type="button" onClick={() => setPatientGender(o.v)}
                      className={`flex-1 rounded-xl py-2.5 text-[10px] font-medium transition ${patientGender === o.v ? "bg-[#5C6B5C] text-white" : "bg-[#F0F2F5] text-[#7A7F8A] border border-[#EBEDF0]"}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative">
              <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">Insurance provider</label>
              <input type="text" value={patientInsurance} onChange={(e) => setPatientInsurance(e.target.value)} placeholder="Start typing..." className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]" />
              {filteredInsurance.length > 0 && patientInsurance.length >= 2 && !KNOWN_INSURANCE.includes(patientInsurance) && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-[#EBEDF0] bg-white shadow-lg max-h-40 overflow-y-auto">
                  {filteredInsurance.map((ins) => (
                    <button key={ins} onClick={() => setPatientInsurance(ins)} className="w-full px-3 py-2 text-left text-sm text-[#1A1D2E] hover:bg-[#F0F2F5]">{ins}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">Phone number</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={patientPhone}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 10);
                    const f = d.length === 0
                      ? ""
                      : d.length <= 3
                        ? `(${d}`
                        : d.length <= 6
                          ? `(${d.slice(0, 3)}) ${d.slice(3)}`
                          : `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
                    setPatientPhone(f);
                  }}
                  placeholder="(555) 123-4567"
                  className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#7A7F8A] mb-1">Zip code <span className="text-[#B0B4BC]">(optional)</span></label>
                <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="06880" maxLength={10} className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]" />
              </div>
            </div>
            {/* Email confirmation (read-only) */}
            {email && (
              <div className="rounded-xl bg-[#F0F2F5]/50 px-3 py-2 text-xs text-[#7A7F8A]">
                Account email: <span className="font-medium text-[#1A1D2E]">{email}</span>
              </div>
            )}
            <label className="flex items-start gap-2 mt-2">
              <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#5C6B5C]" />
              <span className="text-[10px] text-[#7A7F8A] leading-relaxed">
                I agree to the <a href="/terms" target="_blank" className="underline text-[#5C6B5C]">Terms</a> and <a href="/privacy" target="_blank" className="underline text-[#5C6B5C]">Privacy Policy</a>, and authorize Quarterback Health to call offices and use my info to coordinate my care.
              </span>
            </label>
            {error && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">
                {error}
                {error.toLowerCase().includes("already") && (
                  <a href="/login" className="mt-1 block font-semibold text-[#5C6B5C] underline">Sign in instead</a>
                )}
              </div>
            )}
            <button
              onClick={handleCreateAccount}
              disabled={!canCreate}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {creatingAccount ? "Creating..." : "Create my account"}
            </button>
          </div>
        )}

        {/* Plaid connect */}
        {phase === "plaid-connect" && !typing && (
          <div className="animate-fadeIn">
            <button
              onClick={openPlaidLink}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Connect your bank
            </button>
            <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-[#B0B4BC]">
              <ShieldCheck size={12} /> Encrypted &middot; Read-only &middot; Powered by Plaid
            </div>
          </div>
        )}

        {/* Calendar connect */}
        {phase === "calendar-connect" && !typing && (
          <div className="animate-fadeIn space-y-3">
            <button
              onClick={async () => {
                try {
                  const res = await apiFetch("/api/google-calendar/connect", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ app_user_id: userId, return_to: "onboarding" }),
                  });
                  const data = await res.json();
                  if (data?.ok && data?.authorize_url) {
                    window.location.href = data.authorize_url;
                  }
                } catch {}
              }}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Connect Google Calendar
            </button>
            <button
              onClick={() => {
                addKateMessage("No problem — we'll move on.");
                setTimeout(() => setPhase(advanceAfter("calendar")), 1000);
              }}
              className="w-full text-center text-xs text-[#B0B4BC] hover:text-[#7A7F8A]"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Discovery reveal */}
        {phase === "discovery-reveal" && (
          <div className="space-y-2 animate-fadeIn">
            {discoveredProviders.slice(0, revealIndex).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white border border-[#EBEDF0] shadow-sm px-4 py-3 animate-fadeIn">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.overdue ? "#E04030" : "#5C6B5C" }} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#1A1D2E]">{p.name}</div>
                  {p.overdue && <span className="text-[10px] text-[#E04030]">might be overdue</span>}
                  {!p.overdue && <span className="text-[10px] text-[#5C6B5C]">on track</span>}
                </div>
              </div>
            ))}
            {!revealDone && revealIndex < discoveredProviders.length && (
              <div className="flex items-center gap-2 text-xs text-[#B0B4BC]">
                <span className="h-2 w-2 rounded-full bg-[#B0B4BC] animate-pulse" /> Scanning...
              </div>
            )}
            {/* Active scan progress + skip — visible while discovery is polling
                so the user has visible feedback and an escape hatch (T3-3).
                Made prominent: full-width card, larger "Skip" button, animated
                progress dot. Skip transitions to whichever phase is next. */}
            {discoveryActive && (
              <div className="mt-3 rounded-2xl bg-white border-2 border-[#5C6B5C]/20 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#5C6B5C] animate-pulse" />
                    <span className="h-2 w-2 rounded-full bg-[#5C6B5C] animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <span className="h-2 w-2 rounded-full bg-[#5C6B5C] animate-pulse" style={{ animationDelay: "0.4s" }} />
                  </div>
                  <span className="text-sm font-medium text-[#1A2E1A]">Scanning your accounts…</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDiscoveryActive(false);
                    setTyping(false);
                    addKateMessage("No problem — moving on.");
                    // Skip advances past the in-flight step to the next selected
                    // step in the pipeline (or score-reveal if none remain).
                    setTimeout(() => setPhase(advanceAfter(currentDiscoveryStep)), 800);
                  }}
                  className="w-full rounded-xl border border-[#5C6B5C]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#5C6B5C] hover:bg-[#5C6B5C]/5"
                >
                  Skip and continue
                </button>
              </div>
            )}
          </div>
        )}

        {/* Review-team — surfaces ambiguous discoveries (pharmacies + the
            classifier's review_needed bucket) so the user can confirm "this
            is care for me" or dismiss "just shopping" before reaching the
            dashboard. Inserted automatically when bank/calendar discovery
            yields ambiguous rows; transitions to postReviewPhase on done. */}
        {phase === "review-team" && !typing && (
          <div className="animate-fadeIn space-y-3">
            <KateBubble>I picked up a few I wasn't sure about — care for you, or just somewhere you shop?</KateBubble>
            <div className="space-y-2">
              {ambiguousProviders.map((p) => {
                const isPharmacy = p.provider_type === "pharmacy";
                const acted = !ambiguousProviders.find((x) => x.id === p.id); // unused; placeholder
                void acted;
                return (
                  <div key={p.id} className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1A1D2E] truncate">{p.name}</div>
                      <div className="text-[10px] text-[#7A7F8A]">
                        {isPharmacy ? "Pharmacy" : "Possible provider"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={reviewActioning === p.id}
                        onClick={async () => {
                          setReviewActioning(p.id);
                          try {
                            await apiFetch("/api/providers/review", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ provider_id: p.id, action: "approve", app_user_id: userId }),
                            });
                            setAmbiguousProviders((prev) => prev.filter((x) => x.id !== p.id));
                          } finally { setReviewActioning(null); }
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        style={{ backgroundColor: ACCENT, color: "white" }}
                      >
                        Keep
                      </button>
                      <button
                        disabled={reviewActioning === p.id}
                        onClick={async () => {
                          setReviewActioning(p.id);
                          try {
                            await apiFetch("/api/providers/review", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ provider_id: p.id, action: "dismiss", app_user_id: userId }),
                            });
                            setAmbiguousProviders((prev) => prev.filter((x) => x.id !== p.id));
                          } finally { setReviewActioning(null); }
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-[#EBEDF0] text-[#7A7F8A] hover:bg-[#F0F2F5] disabled:opacity-50"
                      >
                        Drop
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => {
                addKateMessage("Got it — moving on.");
                setTimeout(() => setPhase(postReviewPhase), 600);
              }}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
              disabled={ambiguousProviders.length > 0}
            >
              {ambiguousProviders.length > 0 ? `Decide on ${ambiguousProviders.length} more` : "Done"}
            </button>
          </div>
        )}

        {/* Manual NPI search — third step in the discovery pipeline.
            Opted into via "Enter providers yourself" on discovery-method.
            Always renders after bank/calendar (if selected) and before score. */}
        {phase === "manual-search" && !typing && (
          <div className="animate-fadeIn space-y-3">
            <div className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-4 space-y-3">
              <input
                type="text"
                placeholder="Search by name, specialty, or city"
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#EBEDF0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C6B5C]/30"
              />
              {manualSearching && (
                <div className="text-xs text-[#B0B4BC]">Searching…</div>
              )}
              {manualSearchResults.length > 0 && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {manualSearchResults.slice(0, 10).map((r) => {
                    const key = `${r.name}|${r.npi}`;
                    const isAdded = manualAdded.has(key);
                    return (
                      <div key={key} className="flex items-center gap-2 rounded-xl border border-[#EBEDF0] px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#1A1D2E] truncate">{r.name}</div>
                          {r.specialty && <div className="text-[10px] text-[#7A7F8A] truncate">{r.specialty}</div>}
                          {r.address && <div className="text-[10px] text-[#B0B4BC] truncate">{r.address}</div>}
                        </div>
                        <button
                          disabled={isAdded || manualAdding === key}
                          onClick={async () => {
                            setManualAdding(key);
                            try {
                              const res = await apiFetch("/api/providers/add-manual", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  app_user_id: userId,
                                  name: r.name,
                                  phone_number: r.phone,
                                  specialty: r.specialty,
                                  npi: r.npi,
                                }),
                              });
                              const data = await res.json();
                              if (data?.ok) {
                                setManualAdded((prev) => new Set([...prev, key]));
                              }
                            } finally {
                              setManualAdding(null);
                            }
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                          style={{ backgroundColor: isAdded ? "#EBEDF0" : ACCENT, color: isAdded ? "#7A7F8A" : "white" }}
                        >
                          {isAdded ? "Added" : manualAdding === key ? "Adding…" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {manualSearchQuery.trim().length >= 2 && !manualSearching && manualSearchResults.length === 0 && (
                <div className="text-xs text-[#B0B4BC]">No matches — try a different name or specialty.</div>
              )}
            </div>
            <button
              onClick={() => {
                const count = manualAdded.size;
                addKateMessage(count > 0
                  ? `Added ${count} — I've got them now.`
                  : "All set — you can hand me a name from the dashboard anytime.");
                setTimeout(() => setPhase(advanceAfter("manual")), 1000);
              }}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              {manualAdded.size > 0 ? `Done — ${manualAdded.size} added` : "Done"}
            </button>
            <button
              onClick={() => {
                addKateMessage("No problem — moving on.");
                setTimeout(() => setPhase(advanceAfter("manual")), 800);
              }}
              className="w-full text-center text-xs text-[#B0B4BC] hover:text-[#7A7F8A]"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Score reveal */}
        {phase === "score-reveal" && score !== null && (
          <div className="animate-fadeIn text-center">
            <div className="relative mx-auto" style={{ width: 140, height: 140 }}>
              <svg width={140} height={140} viewBox="0 0 140 140" className="transform -rotate-90">
                <circle cx={70} cy={70} r={58} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={7} />
                <defs>
                  <linearGradient id="revealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0FA5A5" />
                    <stop offset="100%" stopColor="#D4A44C" />
                  </linearGradient>
                </defs>
                <circle cx={70} cy={70} r={58} fill="none" stroke="url(#revealGrad)" strokeWidth={7} strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 2 * Math.PI * 58} ${2 * Math.PI * 58}`}
                  className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-light text-[#0FA5A5]">{score}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7A7F8A] mt-0.5">
                  {score >= 85 ? "Strong" : score >= 60 ? "On Track" : score >= 30 ? "Building" : "Starting"}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <KateBubble>
                {score >= 50
                  ? `${score} today. We'll build from here — I'll keep things on track so you don't have to.`
                  : `${score} today. Most people start around 30. We'll build from here — I've got it.`}
              </KateBubble>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Take me to my dashboard
            </button>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
