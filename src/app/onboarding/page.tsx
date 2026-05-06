"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
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
const TEXT_SECONDARY = "#4F5F73";
const TEXT_MUTED = "#4F5F73";

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
            <span className="h-2 w-2 rounded-full bg-[#4F5F73] animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 rounded-full bg-[#4F5F73] animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 rounded-full bg-[#4F5F73] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        ) : (
          <div className="text-sm text-[#071832] leading-relaxed">{children}</div>
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
            backgroundColor: "#1677FF",
            border: "1px solid #1677FF",
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
        selected ? "border-[#1677FF] bg-[#1677FF]/5 ring-1 ring-[#1677FF]" : "border-[#E5EAF2] bg-white hover:border-[#4F5F73]"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon size={20} className={selected ? "text-[#1677FF]" : "text-[#4F5F73]"} />
        <div className="flex-1">
          <div className="text-sm font-semibold text-[#071832]">{title}</div>
          <p className="mt-1 text-xs text-[#4F5F73] leading-relaxed">{description}</p>
        </div>
        <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition ${
          selected ? "border-[#1677FF] bg-[#1677FF]" : "border-[#D0D3D8]"
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
  // True from the moment the user taps an option button until the
  // next phase mounts. Hides the option-block immediately so we
  // never have a stale button visible at the same time as the
  // user's blue reply bubble. Reset whenever phase changes.
  const [responded, setResponded] = useState(false);

  // User data
  const [userId] = useState(() => typeof window !== "undefined" ? (localStorage.getItem("qbh_user_id") || crypto.randomUUID()) : crypto.randomUUID());
  const [careFor, setCareFor] = useState<string>("just-me");
  const [familyMembers, setFamilyMembers] = useState<string[]>([]);
  // Captured at onboarding so Kate can prioritize specialists, set
  // appropriate cadence reminders, and tailor in-call language.
  // Saved to patient_profile.medical_context.
  const [medicalContext, setMedicalContext] = useState<string>("");
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
  // When the user skips a slow bank scan, the poll keeps running but
  // the inline reveal must NOT pull the user back to discovery-reveal.
  // Tracked as a ref because we read it inside the running interval.
  const bankSkippedRef = useRef(false);
  // Whether the deferred bank scan has actually completed since the
  // user skipped — drives the "still scanning" indicator on the
  // unified reveal page.
  const [bankScanDeferred, setBankScanDeferred] = useState(false);

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
    // Interleave typing-then-message for each item so Kate appears
    // to actively type each line, instead of bursting all messages
    // out behind a single sustained typing indicator.
    let elapsed = 0;
    contents.forEach((content, i) => {
      const messageDelay = i === 0 ? baseDelay : gap;
      const startTyping = elapsed;
      const dropMessage = startTyping + messageDelay;
      setTimeout(() => setTyping(true), startTyping);
      setTimeout(() => {
        setTyping(false);
        setMessages((prev) => [
          ...prev,
          { id: `kate-${Date.now()}-${i}-${Math.random()}`, sender: "kate", content },
        ]);
      }, dropMessage);
      // Brief pause after each message lands before the next typing
      // indicator reappears — gives the reader a beat to read.
      const postPause = 350;
      elapsed = dropMessage + postPause;
    });
    // Each message now manages its own typing-on / typing-off
    // bracket above; no global trailing timer needed.
  }

  function addUserMessage(content: string) {
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: "user", content }]);
  }

  // Reset the "user has tapped an option" flag whenever phase
  // advances — the new phase's button block should appear (after
  // its lead-in messages stream in).
  useEffect(() => {
    setResponded(false);
  }, [phase]);

  // ── Phase: Intro ──
  useEffect(() => {
    if (phase !== "intro") return;
    const t1 = setTimeout(() => {
      setMessages([{ id: "k1", sender: "kate", content: "Hey \u2014 I'm Kate. I take healthcare off your plate." }]);
    }, 600);
    const t2 = setTimeout(() => {
      setMessages((prev) => [...prev, { id: "k2", sender: "kate", content: "Some people have a few doctors and barely think about it. Others are in and out of appointments constantly \u2014 specialists, scans, refills, follow-ups." }]);
    }, 2000);
    const t3 = setTimeout(() => {
      setMessages((prev) => [...prev, { id: "k3", sender: "kate", content: "Wherever you are on that spectrum, I'll meet you there. Where do you fall?" }]);
      setTyping(false);
    }, 3400);
    setTyping(true);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase]);

  // ── Phase handlers ──
  function handleIntroResponse(value: string) {
    setResponded(true);
    // Three Kate-voice "what you can look forward to" lines that
    // were previously rendered as a separate icon-card block. Now
    // streamed into the chat like every other message so there's no
    // out-of-flow component to flicker on transition.
    const valueProps: React.ReactNode[] = [
      <><strong>I&rsquo;ll find your doctors.</strong> I scan your co-pays so you don&rsquo;t have to remember every name and date.</>,
      <><strong>I&rsquo;ll book your appointments.</strong> I call the office, navigate the phone tree, and schedule. You don&rsquo;t have to pick up the phone.</>,
      <><strong>I&rsquo;ll connect the dots.</strong> I track what&rsquo;s overdue, prep you before visits, and follow up after &mdash; so you can show up informed instead of being your own health historian.</>,
    ];
    if (value === "simple") {
      addUserMessage("A few doctors, mostly simple");
      setTimeout(() => {
        addKateMessages([
          "Easy mode. I'll keep things light \u2014 nudge you when something's overdue, handle booking calls, stay out of the way otherwise.",
          "Here's what you can look forward to:",
          ...valueProps,
        ]);
        setTimeout(() => setPhase("value-props"), 3600);
      }, 400);
    } else {
      addUserMessage("I see a lot of specialists");
      setTimeout(() => {
        addKateMessages([
          "Then I'll be useful. I'll keep your specialists in sync, handle the scheduling and follow-ups, and prep you so each visit isn't starting from scratch.",
          "Here's what you can look forward to:",
          ...valueProps,
        ]);
        setTimeout(() => setPhase("value-props"), 3600);
      }, 400);
    }
  }

  function handleValuePropsNext() {
    setResponded(true);
    addUserMessage("Let's do it");
    setTimeout(() => {
      addKateMessage("Quick question \u2014 is this just for you, or are you managing care for your people too?");
      setTimeout(() => setPhase("who-for"), 1200);
    }, 400);
  }

  function handleWhoFor(value: string) {
    setResponded(true);
    setCareFor(value);
    if (value === "just-me") {
      addUserMessage("Just me");
      setFamilyMembers([]);
      setTimeout(() => {
        addKateMessage("One more question \u2014 anything big going on health-wise I should know about? It helps me tailor what to track and how to talk to your providers.");
        setTimeout(() => setPhase("medical-context"), 1200);
      }, 400);
    } else {
      addUserMessage("Me and my family");
      setTimeout(() => {
        addKateMessage("Got it. Who else are you keeping track of?");
        setTimeout(() => setPhase("family-select"), 1200);
      }, 400);
    }
  }

  function handleMedicalContext(value: string) {
    setResponded(true);
    const labels: Record<string, string> = {
      none: "Nothing major",
      chronic: "Chronic illness",
      cancer: "Cancer treatment",
      surgery: "Recovering from surgery / major event",
      mental: "Mental health treatment",
      pregnancy: "Pregnancy",
      caregiving: "Caregiving for someone else",
      other: "Something else \u2014 I'll tell you later",
    };
    addUserMessage(labels[value] ?? value);
    setMedicalContext(value);
    setTimeout(() => {
      const empathic =
        value === "none"
          ? "Good to know \u2014 I'll keep things simple unless that changes."
          : value === "chronic"
          ? "Thanks for telling me. I'll keep your specialists tightly tracked and flag anything that looks off-cadence."
          : value === "cancer"
          ? "I'm with you on this. I'll prioritize your oncology team, treatment dates, and follow-ups, and keep everything else from getting in the way."
          : value === "surgery"
          ? "Recovery is full of follow-ups. I'll watch for them and keep the post-op timeline organized."
          : value === "mental"
          ? "Thanks for sharing. I'll handle the scheduling and refills with care so you can focus on the work itself."
          : value === "pregnancy"
          ? "Congrats. I'll keep your prenatal cadence and any specialists tightly synced."
          : value === "caregiving"
          ? "That's a lot of people to track. I can hold each person's care separately so nothing crosses wires."
          : "Got it \u2014 share whenever you're ready. Until then I'll keep things broad.";
      addKateMessages([
        empathic,
        "Now let's pull in your doctors. Three ways \u2014 pick whichever feels easiest, or all three. I'll handle the rest.",
        "Bank scan is the fastest: I look at your card statements for healthcare charges and find every doctor you've paid. Read-only, encrypted, never stored, never sold. Bank-grade secure \u2014 same Plaid integration Venmo and Robinhood use.",
        "If that's not your thing, your calendar works too \u2014 I'll grab any doctor visits past or present. Or just type the names yourself."
      ], 800, 1100);
      setTimeout(() => setPhase("discovery-method"), 4800);
    }, 400);
  }

  function handleFamilyDone() {
    setResponded(true);
    addUserMessage(`Me${familyMembers.length > 0 ? ", " + familyMembers.join(", ") : ""}`);
    setTimeout(() => {
      addKateMessages([
        "I'll set up a separate hub for each person. Everyone's providers, appointments, and history \u2014 organized individually but managed by you.",
        "One more question \u2014 anything big going on health-wise I should know about? It helps me tailor what to track and how to talk to your providers.",
      ]);
      setTimeout(() => setPhase("medical-context"), 2400);
    }, 400);
  }

  function handleDiscoveryMethodDone() {
    setResponded(true);
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
            medical_context: medicalContext || undefined,
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
      // Lead-in messages explain what's about to happen so the user
      // isn't dropped on a "Connect" button without context. Bank in
      // particular gets the security + copay-card framing every time.
      const leadIn: React.ReactNode[] =
        next === "plaid-connect"
          ? [
              "Account's saved. One last setup step before your dashboard.",
              "Pick whatever account you use for copays — debit, credit, or FSA/HSA. FSA/HSA is gold for me because every charge is healthcare-only, no noise.",
              "If you'd rather not connect a bank, no pressure — tap skip and I'll grab your calendar instead, or you can type names manually.",
            ]
          : next === "calendar-connect"
          ? [
              "Account's saved. Let me peek at your calendar — I'll grab any doctor visits past or present and add them to your timeline.",
              "Google or Outlook, both work. Read-only, only events that look healthcare-related. I never touch the rest of your calendar.",
            ]
          : next === "manual-search"
          ? [
              "Account's saved. Let's add the doctors you already know about.",
              "Just type a name — the doctor's, the office's, even just part of it. I'll find them as long as they have an NPI (basically every licensed provider in the US).",
            ]
          : ["Account's saved. Let's head to your dashboard — you can hand me a provider anytime."];
      setTimeout(() => {
        const baseDelay = 400;
        const gap = 1100;
        const postPause = 350;
        addKateMessages(leadIn, baseDelay, gap);
        // Hold until the typed-out lead-in is fully shown. Mirrors
        // the addKateMessages timing math: first message at baseDelay,
        // each subsequent at gap + postPause, then a small buffer.
        const holdMs =
          baseDelay +
          gap +
          Math.max(0, leadIn.length - 1) * (gap + postPause) +
          800;
        setTimeout(() => setPhase(next), holdMs);
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
            // runBankDiscovery owns the call to /api/discovery/run on
            // every poll tick \u2014 no need to fire one here too.
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
    // Surface activity so the page does not look frozen — without
    // these, "pulling your records now" sits static for a minute+
    // and users refresh assuming it broke.
    setCurrentDiscoveryStep("bank");
    setDiscoveryActive(true);
    setTyping(true);

    // Plaid PRODUCT_NOT_READY can persist 60-180s on credit cards. The
    // user already linked Plaid — they shouldn't sit staring at a
    // spinner. Give a brief beat for fast-completing banks, then
    // auto-advance to the next opted-in step. The poll keeps running
    // silently in the background and the unified reveal at the end
    // surfaces whatever it finds.
    const progress10 = setTimeout(() => {
      addKateMessage("Still pulling your statements. I'll keep this going in the background while we keep moving.");
    }, 10000);
    // Auto-defer at 15s if still pending. Same effect as Skip but
    // automatic — Plaid succeeded, the scan can run silently, and
    // the user advances to calendar/manual.
    const autoDefer = setTimeout(() => {
      if (finished) return;
      bankSkippedRef.current = true;
      setBankScanDeferred(true);
      setDiscoveryActive(false);
      setTyping(false);
      addKateMessage("I'll keep scanning in the background — let's keep going.");
      setTimeout(() => setPhase(advanceAfter("bank")), 1000);
    }, 15000);
    const progress90 = setTimeout(() => {
      // Belt-and-suspenders — if the user lingered (e.g., bounced
      // back to onboarding mid-scan), drop a friendly note that the
      // scan is still working in the background.
      addKateMessage("Bank's slow today. Still working on it in the background.");
    }, 90000);

    // Drive discovery from inside the poll loop. /api/discovery/run is
    // idempotent (upsert-based) and cheap when there's nothing new.
    // PRODUCT_NOT_READY can persist for 60-180s on credit cards, so we
    // need to keep retrying — the previous one-shot-at-30s retry was
    // the bug that left users with zero providers. Each tick:
    //   1. Hit /api/discovery/run; if it returns concrete results
    //      (ok && !pending), we're done.
    //   2. Otherwise wait the next interval and try again.
    //   3. After 3 minutes of pending, give up and let the user
    //      proceed (manual entry / next step).
    let attempts = 0;
    let finished = false;
    const MAX_ATTEMPTS = 60; // 3 min @ 3s
    const finish = (providers: DiscoveredProvider[]) => {
      // setInterval ticks fired before we cleared the interval may
      // already have an /api/discovery/run await in flight. When those
      // resolve they'll also call finish(); guard so we only reveal once.
      if (finished) return;
      finished = true;
      clearInterval(poll);
      clearTimeout(progress10);
      clearTimeout(autoDefer);
      clearTimeout(progress90);
      setDiscoveryActive(false);
      setTyping(false);
      setDiscoveredProviders(providers);
      // If the user already skipped, stash the providers silently and
      // mark the deferred scan complete — the unified reveal page will
      // surface them. Calling startReveal here would yank the user
      // back to discovery-reveal mid-calendar/manual.
      if (bankSkippedRef.current) {
        setBankScanDeferred(false);
        return;
      }
      startReveal(providers, "bank");
    };
    const poll = setInterval(async () => {
      attempts++;
      try {
        const runRes = await apiFetch("/api/discovery/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_user_id: userId }),
        });
        const runData = await runRes.json().catch(() => ({}));

        // ok && !pending means Plaid handed us transactions and the
        // classifier ran. Even if provider_count is 0 (truly no
        // healthcare in transactions), advance so the user isn't stuck.
        if (runData?.ok && !runData.pending) {
          const dashRes = await apiFetch("/api/dashboard/data");
          const dashData = await dashRes.json().catch(() => ({}));
          const snapshots = dashData?.snapshots || [];
          const providers = snapshots
            .filter((s: { provider: { provider_type?: string } }) => s.provider.provider_type !== "pharmacy")
            .map((s: {
              provider: { id: string; name: string };
              visitCount?: number;
              followUpNeeded?: boolean;
              booking_state?: { status?: string };
            }) => ({
              id: s.provider.id,
              name: s.provider.name,
              visit_count: s.visitCount || 0,
              status: "active" as const,
              overdue: !!s.followUpNeeded && s.booking_state?.status !== "BOOKED",
            }));
          finish(providers);
          return;
        }

        if (attempts >= MAX_ATTEMPTS) finish([]);
      } catch {
        if (attempts >= MAX_ATTEMPTS) finish([]);
      }
    }, 3000);
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
        addKateMessage("Nothing healthcare-related on your calendar yet. No worries — you can give me a name from the dashboard anytime.");
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

  // All providers discovered across all opt-in methods, hydrated for
  // the unified reveal on score-reveal. Pulled from dashboard/data so
  // bank-deferred completions land here naturally even if the user
  // skipped past the inline reveal earlier.
  const [allDiscovered, setAllDiscovered] = useState<
    Array<{ id: string; name: string; specialty: string | null; source: string | null }>
  >([]);

  // ── Score + unified reveal ──
  useEffect(() => {
    // Load the unified provider list on score-reveal (final summary)
    // AND on manual-search (so the user sees what's already on their
    // team before adding more by name).
    if (phase !== "score-reveal" && phase !== "manual-search") return;
    if (phase === "score-reveal") {
      apiFetch("/api/health-score")
        .then((r) => r.json())
        .then((d) => { if (d.ok) setScore(d.score); })
        .catch(() => setScore(0));
    }

    let cancelled = false;
    async function loadAll() {
      const r = await apiFetch("/api/dashboard/data");
      const j = await r.json().catch(() => ({}));
      if (cancelled) return;
      if (j?.ok) {
        const list = (j.snapshots ?? [])
          .filter((s: { provider: { provider_type?: string } }) => s.provider.provider_type !== "pharmacy")
          .map((s: { provider: { id: string; name: string; specialty: string | null; source: string | null } }) => ({
            id: s.provider.id,
            name: s.provider.name,
            specialty: s.provider.specialty,
            source: s.provider.source,
          }));
        setAllDiscovered(list);
      }
    }
    loadAll();

    // If the bank scan is still deferred, poll dashboard/data every
    // few seconds so the reveal updates as new providers land. Stops
    // once bankScanDeferred flips false (the deferred scan finished).
    let interval: ReturnType<typeof setInterval> | null = null;
    if (bankScanDeferred) {
      interval = setInterval(loadAll, 4000);
    }
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [phase, bankScanDeferred]);

  // ── Manual-search entry message ──
  // Whenever we land in manual-search, drop a Kate message explaining
  // what to do (covers all entry paths — including review-team Done).
  const manualSearchAnnouncedRef = useRef(false);
  useEffect(() => {
    if (phase !== "manual-search") return;
    if (manualSearchAnnouncedRef.current) return;
    manualSearchAnnouncedRef.current = true;
    addKateMessage("Last step — type a name and I'll find them. Doctor name, office name, even just part of it works. Add as many as you want, then tap done.");
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
      <div className="sticky top-0 z-10 backdrop-blur-md border-b px-6 py-3" style={{ background: "rgba(250,248,244,0.85)", borderColor: "#E5EAF2" }}>
        <div className="mx-auto max-w-lg flex items-center gap-2">
          <Image src="/kate-avatar.png" alt="Kate" width={28} height={28} className="rounded-full" />
          <span className="text-sm font-semibold text-[#071832]">Kate</span>
          <span className="text-[10px] text-[#1677FF] font-medium ml-1">Care Coordinator</span>
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
        {phase === "intro" && !typing && !responded && messages.length >= 3 && (
          <OptionButtons
            options={[
              { label: "A few doctors, mostly simple", value: "simple" },
              { label: "I see a lot of specialists", value: "complex" },
            ]}
            onSelect={(v) => { setPhase("intro-responded"); handleIntroResponse(v); }}
          />
        )}

        {/* Value Props — bullets are now streamed as Kate chat
            messages in handleIntroResponse(). Only the proceed
            button remains here. */}
        {phase === "value-props" && !responded && (
          <OptionButtons options={[{ label: "Let's do it", value: "go" }]} onSelect={handleValuePropsNext} />
        )}

        {/* Who for */}
        {phase === "who-for" && !responded && (
          <OptionButtons
            options={[
              { label: "Just me", value: "just-me" },
              { label: "Me and my family", value: "family" },
            ]}
            onSelect={handleWhoFor}
          />
        )}

        {/* Medical context — captured early so Kate can tailor
            cadence, in-call language, and which specialists she
            prioritizes. Saved to patient_profile.medical_context. */}
        {phase === "medical-context" && !responded && (
          <div className="flex flex-wrap gap-2 justify-end animate-fadeIn">
            {[
              { label: "Nothing major", value: "none" },
              { label: "Chronic illness", value: "chronic" },
              { label: "Cancer treatment", value: "cancer" },
              { label: "Recovering from surgery", value: "surgery" },
              { label: "Mental health treatment", value: "mental" },
              { label: "Pregnancy", value: "pregnancy" },
              { label: "Caregiving for someone", value: "caregiving" },
              { label: "Something else", value: "other" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleMedicalContext(opt.value)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98]"
                style={{
                  backgroundColor: "#1677FF",
                  border: "1px solid #1677FF",
                  color: "#FFFFFF",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Family select */}
        {phase === "family-select" && !responded && (
          <div className="space-y-2 animate-fadeIn">
            <p className="text-xs text-[#4F5F73] mb-1">Select as many as you need</p>
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
                  familyMembers.includes(opt.value) ? "border-[#1677FF] bg-[#1677FF]/5 text-[#071832]" : "border-[#E5EAF2] bg-white text-[#4F5F73]"
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
        {phase === "discovery-method" && !responded && (
          <div className="space-y-3 animate-fadeIn">
            <p className="text-sm font-semibold text-[#071832] mb-2">Pick at least one to continue</p>
            <ToggleCard
              icon={Building2}
              title="Scan your bank"
              description="Use the card you'd swipe at a copay — FSA/HSA is even better. I'll find every doctor you've paid in the last year. Read-only, encrypted, never stored, never sold."
              selected={connectBank}
              onToggle={() => setConnectBank(!connectBank)}
            />
            <ToggleCard
              icon={Calendar}
              title="Scan your calendar"
              description="If you keep doctor visits in your calendar, I'll grab the past year and what's coming up. Past, present, and upcoming — all in one place."
              selected={connectCalendar}
              onToggle={() => setConnectCalendar(!connectCalendar)}
            />
            <ToggleCard
              icon={Search}
              title="I'll add them myself"
              description="Know the doctor's name? The office name? Even just part of it? Type it and I'll find them. Works for anyone with an NPI."
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
        {phase === "account-create" && !responded && (
          <div className="animate-fadeIn rounded-2xl backdrop-blur-sm p-5 space-y-3" style={{ background: theme.glass, border: `1px solid ${theme.glassBorder}`, boxShadow: theme.cardShadow }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">First name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">Last name</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] pr-10 focus:outline-none focus:ring-1 focus:ring-[#1677FF]" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4F5F73]">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                  <span style={{ color: password.length >= 8 ? "#22C55E" : "#4F5F73" }}>{password.length >= 8 ? "✓" : "○"} 8+ characters</span>
                  <span style={{ color: hasUpper && hasLower ? "#22C55E" : "#4F5F73" }}>{hasUpper && hasLower ? "✓" : "○"} Upper & lower</span>
                  <span style={{ color: hasNumber ? "#22C55E" : "#4F5F73" }}>{hasNumber ? "✓" : "○"} Number</span>
                  <span style={{ color: hasSpecial ? "#22C55E" : "#4F5F73" }}>{hasSpecial ? "✓" : "○"} Special char</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">Date of birth</label>
                <input type="date" value={patientDob} onChange={(e) => setPatientDob(e.target.value)} className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]" style={isUnder18 ? { borderColor: "#E53E3E" } : {}} />
                {isUnder18 && <p className="mt-1 text-[10px] text-red-500">Must be 18 or older.</p>}
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">Sex</label>
                <div className="flex gap-1.5">
                  {[{ v: "male", l: "Male" }, { v: "female", l: "Female" }, { v: "non-binary", l: "Non-binary" }, { v: "other", l: "Other" }, { v: "prefer-not-to-say", l: "Prefer not to say" }].map((o) => (
                    <button key={o.v} type="button" onClick={() => setPatientGender(o.v)}
                      className={`flex-1 rounded-xl py-2.5 text-[10px] font-medium transition ${patientGender === o.v ? "bg-[#1677FF] text-white" : "bg-[#F0F2F5] text-[#4F5F73] border border-[#E5EAF2]"}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative">
              <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">Insurance provider</label>
              <input type="text" value={patientInsurance} onChange={(e) => setPatientInsurance(e.target.value)} placeholder="Start typing..." className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]" />
              {filteredInsurance.length > 0 && patientInsurance.length >= 2 && !KNOWN_INSURANCE.includes(patientInsurance) && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-[#E5EAF2] bg-white shadow-lg max-h-40 overflow-y-auto">
                  {filteredInsurance.map((ins) => (
                    <button key={ins} onClick={() => setPatientInsurance(ins)} className="w-full px-3 py-2 text-left text-sm text-[#071832] hover:bg-[#F0F2F5]">{ins}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">Phone number</label>
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
                  className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#4F5F73] mb-1">Zip code <span className="text-[#4F5F73]">(optional)</span></label>
                <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="06880" maxLength={10} className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-2.5 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]" />
              </div>
            </div>
            {/* Email confirmation (read-only) */}
            {email && (
              <div className="rounded-xl bg-[#F0F2F5]/50 px-3 py-2 text-xs text-[#4F5F73]">
                Account email: <span className="font-medium text-[#071832]">{email}</span>
              </div>
            )}
            <label className="flex items-start gap-2 mt-2">
              <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#1677FF]" />
              <span className="text-[10px] text-[#4F5F73] leading-relaxed">
                I agree to the <a href="/terms" target="_blank" className="underline text-[#1677FF]">Terms</a> and <a href="/privacy" target="_blank" className="underline text-[#1677FF]">Privacy Policy</a>, and authorize Quarterback Health to call offices and use my info to coordinate my care.
              </span>
            </label>
            {error && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">
                {error}
                {error.toLowerCase().includes("already") && (
                  <a href="/login" className="mt-1 block font-semibold text-[#1677FF] underline">Sign in instead</a>
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
        {phase === "plaid-connect" && !responded && (
          <div className="animate-fadeIn space-y-3">
            <button
              onClick={openPlaidLink}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Connect your bank
            </button>
            <button
              onClick={() => {
                addKateMessage("No problem — moving on.");
                // Pretend bank step is done so advanceAfter routes to
                // the next opted-in step (calendar / manual / score).
                setTimeout(() => setPhase(advanceAfter("bank")), 800);
              }}
              className="w-full text-center text-xs text-[#4F5F73] hover:text-[#4F5F73]"
            >
              Skip for now
            </button>
            <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-[#4F5F73]">
              <ShieldCheck size={12} /> Encrypted &middot; Read-only &middot; Powered by Plaid
            </div>
          </div>
        )}

        {/* Calendar connect */}
        {phase === "calendar-connect" && !responded && (
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
              className="w-full text-center text-xs text-[#4F5F73] hover:text-[#4F5F73]"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Discovery reveal */}
        {phase === "discovery-reveal" && (
          <div className="space-y-2 animate-fadeIn">
            {discoveredProviders.slice(0, revealIndex).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white border border-[#E5EAF2] shadow-sm px-4 py-3 animate-fadeIn">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.overdue ? "#E04030" : "#1677FF" }} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#071832]">{p.name}</div>
                  {p.overdue && <span className="text-[10px] text-[#E04030]">might be overdue</span>}
                  {!p.overdue && <span className="text-[10px] text-[#1677FF]">on track</span>}
                </div>
              </div>
            ))}
            {!revealDone && revealIndex < discoveredProviders.length && (
              <div className="flex items-center gap-2 text-xs text-[#4F5F73]">
                <span className="h-2 w-2 rounded-full bg-[#4F5F73] animate-pulse" /> Scanning...
              </div>
            )}
            {/* Active scan progress + skip — visible while discovery is polling
                so the user has visible feedback and an escape hatch (T3-3).
                Made prominent: full-width card, larger "Skip" button, animated
                progress dot. Skip transitions to whichever phase is next. */}
            {discoveryActive && (
              <div className="mt-3 rounded-2xl bg-white border-2 border-[#1677FF]/20 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#1677FF] animate-pulse" />
                    <span className="h-2 w-2 rounded-full bg-[#1677FF] animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <span className="h-2 w-2 rounded-full bg-[#1677FF] animate-pulse" style={{ animationDelay: "0.4s" }} />
                  </div>
                  <span className="text-sm font-medium text-[#071832]">Scanning your accounts…</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Bank step skip: defer the in-flight scan but
                    // keep the poll running. The reveal happens on the
                    // unified score-reveal page after all opt-in steps
                    // complete. (Calendar skip stays single-shot.)
                    if (currentDiscoveryStep === "bank") {
                      bankSkippedRef.current = true;
                      setBankScanDeferred(true);
                    }
                    setDiscoveryActive(false);
                    setTyping(false);
                    addKateMessage(
                      currentDiscoveryStep === "bank"
                        ? "On it — I'll keep scanning in the background. We'll see what I find at the end."
                        : "No problem — moving on."
                    );
                    setTimeout(() => setPhase(advanceAfter(currentDiscoveryStep)), 800);
                  }}
                  className="w-full rounded-xl border border-[#1677FF]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#1677FF] hover:bg-[#1677FF]/5"
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
        {phase === "review-team" && !responded && (
          <div className="animate-fadeIn space-y-3">
            <KateBubble>I picked up a few I wasn't sure about — care for you, or just somewhere you shop?</KateBubble>
            <div className="space-y-2">
              {ambiguousProviders.map((p) => {
                const isPharmacy = p.provider_type === "pharmacy";
                const acted = !ambiguousProviders.find((x) => x.id === p.id); // unused; placeholder
                void acted;
                return (
                  <div key={p.id} className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#071832] truncate">{p.name}</div>
                      <div className="text-[10px] text-[#4F5F73]">
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
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-[#E5EAF2] text-[#4F5F73] hover:bg-[#F0F2F5] disabled:opacity-50"
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
        {phase === "manual-search" && !responded && (
          <div className="animate-fadeIn space-y-3">
            {/* Unified reveal — what bank + calendar pulled so far. The
                reviewer asked for "here are the providers we found, here
                are the ones for review from both your calendar and your
                bank. if you know any others, put them here." */}
            {allDiscovered.length > 0 && (
              <div className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#4F5F73] mb-2">
                  Here's what I found
                </div>
                <div className="text-sm font-semibold text-[#071832] mb-3">
                  {allDiscovered.length} provider{allDiscovered.length === 1 ? "" : "s"} on your team
                  {bankScanDeferred && (
                    <span className="ml-1 text-[11px] text-[#4F5F73] font-normal">
                      · bank still scanning
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {allDiscovered.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 bg-[#F8F9FB]"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            p.source === "manual" ? "#1677FF" : p.source === "calendar" ? "#27C46B" : "#E08A1F",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#071832] truncate">{p.name}</div>
                        {p.specialty && (
                          <div className="text-[10px] text-[#4F5F73] truncate">{p.specialty}</div>
                        )}
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-[#4F5F73] shrink-0">
                        {p.source === "manual" ? "Added" : p.source === "calendar" ? "Calendar" : "Bank"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-4 space-y-3">
              <label className="block text-xs font-semibold text-[#071832] mb-1">
                {allDiscovered.length > 0 ? "Know any others? Add them by name" : "Search for a provider"}
              </label>
              <p className="text-[11px] text-[#4F5F73] mb-2">Type a name, specialty (e.g. "dermatologist"), or "doctor [city]". Tap Add on any match.</p>
              <input
                type="text"
                placeholder="e.g. Dr. Smith, dentist, cardiologist NYC"
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#E5EAF2] bg-white px-3 py-2.5 text-sm text-[#071832] placeholder:text-[#4F5F73] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
              />
              {manualSearching && (
                <div className="text-xs text-[#4F5F73]">Searching…</div>
              )}
              {manualSearchResults.length > 0 && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {manualSearchResults.slice(0, 10).map((r) => {
                    const key = `${r.name}|${r.npi}`;
                    const isAdded = manualAdded.has(key);
                    return (
                      <div key={key} className="flex items-center gap-2 rounded-xl border border-[#E5EAF2] px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#071832] truncate">{r.name}</div>
                          {r.specialty && <div className="text-[10px] text-[#4F5F73] truncate">{r.specialty}</div>}
                          {r.address && <div className="text-[10px] text-[#4F5F73] truncate">{r.address}</div>}
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
                          style={{ backgroundColor: isAdded ? "#E5EAF2" : ACCENT, color: isAdded ? "#4F5F73" : "white" }}
                        >
                          {isAdded ? "Added" : manualAdding === key ? "Adding…" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {manualSearchQuery.trim().length >= 2 && !manualSearching && manualSearchResults.length === 0 && (
                <div className="text-xs text-[#4F5F73]">No matches — try a different name or specialty.</div>
              )}
            </div>
            <button
              onClick={() => {
                const count = manualAdded.size;
                addKateMessage(count > 0
                  ? `Added ${count} — I've got them now.`
                  : "All set — you can give me a name from the dashboard anytime.");
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
              className="w-full text-center text-xs text-[#4F5F73] hover:text-[#4F5F73]"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Score + unified reveal */}
        {phase === "score-reveal" && score !== null && (
          <div className="animate-fadeIn">
            {/* Big reveal — what Kate found */}
            <div className="text-center mb-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#4F5F73] mb-2">
                Here's what I found
              </div>
              <div className="font-serif text-2xl text-[#071832]">
                {allDiscovered.length === 0
                  ? bankScanDeferred
                    ? "Still scanning…"
                    : "We'll start fresh."
                  : `${allDiscovered.length} provider${allDiscovered.length === 1 ? "" : "s"} on your team`}
              </div>
              {bankScanDeferred && allDiscovered.length > 0 && (
                <div className="mt-1 text-xs text-[#4F5F73]">
                  Bank scan still finishing — more may show up.
                </div>
              )}
            </div>

            {allDiscovered.length > 0 && (
              <div className="mb-6 space-y-2 max-h-72 overflow-y-auto rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-3">
                {allDiscovered.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          p.source === "manual"
                            ? "#1677FF"
                            : p.source === "calendar"
                            ? "#27C46B"
                            : "#E08A1F",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#071832] truncate">{p.name}</div>
                      {p.specialty && (
                        <div className="text-[10px] text-[#4F5F73] truncate">{p.specialty}</div>
                      )}
                    </div>
                    <span className="text-[9px] uppercase tracking-wider text-[#4F5F73]">
                      {p.source === "manual" ? "Added" : p.source === "calendar" ? "Calendar" : "Bank"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Score circle */}
            <div className="text-center">
              <div className="relative mx-auto" style={{ width: 140, height: 140 }}>
                <svg width={140} height={140} viewBox="0 0 140 140" className="transform -rotate-90">
                  <circle cx={70} cy={70} r={58} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={7} />
                  <defs>
                    <linearGradient id="revealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1677FF" />
                      <stop offset="100%" stopColor="#27C46B" />
                    </linearGradient>
                  </defs>
                  <circle cx={70} cy={70} r={58} fill="none" stroke="url(#revealGrad)" strokeWidth={7} strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 2 * Math.PI * 58} ${2 * Math.PI * 58}`}
                    className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-light text-[#1677FF]">{score}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4F5F73] mt-0.5">
                    {score >= 85 ? "Strong" : score >= 60 ? "On Track" : score >= 30 ? "Building" : "Starting"}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                {/* Positive framing — never compare to a baseline ("most
                    people start around 30"). The earlier copy made low
                    scores feel like a deficit; this version lands on
                    "great starting place" and what Kate's about to do. */}
                <KateBubble>
                  {score >= 85
                    ? `${score} — strong. I'll keep it there.`
                    : score >= 60
                    ? `${score} — on track. I'll keep it there.`
                    : score >= 30
                    ? `${score} today. Solid foundation. I'll handle the rest from here.`
                    : `${score} today. Great starting place. I'll handle the rest from here — by next week we'll be moving.`}
                </KateBubble>
              </div>
              <button
                onClick={() => router.push("/dashboard")}
                className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                Take me to my dashboard
              </button>

              {/* "You can always add more later" — covers the case
                  where a user only opted into one or two methods and
                  later wants the others. Surfaces only the methods
                  they didn't run during onboarding. */}
              {(!connectCalendar || !connectManual || !connectBank) && (
                <div className="mt-4 rounded-2xl bg-white border border-[#E5EAF2] p-4 text-left">
                  <div className="text-xs font-semibold text-[#071832] mb-1">
                    You can always add more
                  </div>
                  <p className="text-xs text-[#4F5F73] leading-relaxed mb-3">
                    Whenever you're ready, you can pull in more from your
                    bank, calendar, or just type in a doctor by name.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!connectBank && (
                      <Link
                        href="/account"
                        className="text-xs font-semibold text-[#1677FF] underline underline-offset-2"
                      >
                        Connect bank →
                      </Link>
                    )}
                    {!connectCalendar && (
                      <Link
                        href="/calendar-connect"
                        className="text-xs font-semibold text-[#1677FF] underline underline-offset-2"
                      >
                        Connect calendar →
                      </Link>
                    )}
                    {!connectManual && (
                      <Link
                        href="/providers?add=true"
                        className="text-xs font-semibold text-[#1677FF] underline underline-offset-2"
                      >
                        Add a provider →
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
