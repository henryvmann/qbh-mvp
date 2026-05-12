"use client";

/**
 * /intake — opt-in Kate-led intake quiz. Asks the user a sequence
 * of health-history + psych + lifestyle + care-preference questions
 * so Kate can personalize her behavior (daily check-ins, suggestion
 * tone, what to mention to offices, what goals to surface).
 *
 * Storage: app_users.patient_profile.intake = {
 *   answers: { [questionId]: string | string[] | number },
 *   completed_buckets: string[],
 *   completed_at: ISO | null,
 *   last_updated_at: ISO,
 * }
 *
 * The user can skip any question, resume later, and edit anytime. The
 * intake is never required to use QBH — it just makes Kate smarter
 * about you when you opt in.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import { T } from "../../components/brand";
import { ArrowLeft, ArrowRight } from "lucide-react";

type QuestionType = "chips" | "multi-chips" | "scale";

type Question = {
  id: string;
  bucket: string;
  prompt: string;
  helper?: string;
  /** One-line explanation from Kate about why she's asking. */
  kateNote?: string;
  type: QuestionType;
  options: string[];
  /** Placeholder for the always-present notes textarea. */
  notesPlaceholder?: string;
};

// Every question is chips-first (single or multi-select) with a notes
// textarea for nuance. The reviewer was specific: no more bouncing
// between free-text and chips — chip prompts give Kate something
// structured to reason against, notes catch the rest.
const QUESTIONS: Question[] = [
  // ── Mental health ──
  {
    id: "mh_concerns",
    bucket: "Mental health",
    prompt: "Anything weighing on you mental-health-wise?",
    helper: "Pick all that apply.",
    kateNote: "I don't share this with anyone unless you tell me to — it just helps me know what to surface and how to check in with you.",
    type: "multi-chips",
    options: ["Anxiety", "Depression", "Stress", "Sleep trouble", "Burnout", "Grief", "ADHD / Focus", "Trauma", "None right now", "Other"],
    notesPlaceholder: "Anything else you'd want me to know?",
  },
  {
    id: "mh_therapist",
    bucket: "Mental health",
    prompt: "Do you have a current therapist and/or medication manager?",
    kateNote: "If you have one, I can keep their information organized — help with new appointments and refills, and any documentation between you.",
    type: "chips",
    options: ["Yes — current", "Used to", "Curious about it", "Not for me"],
    notesPlaceholder: "Their name, or what you've been thinking about?",
  },
  {
    id: "mh_stress_level",
    bucket: "Mental health",
    prompt: "On a normal week, how would you rank your stress?",
    helper: "1 = low stress, 10 = high stress",
    kateNote: "Useful for me to understand what you're carrying.",
    type: "scale",
    options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    notesPlaceholder: "What's driving it lately?",
  },

  // ── Lifestyle ──
  {
    id: "ls_sleep",
    bucket: "Lifestyle",
    prompt: "How's sleep these days?",
    kateNote: "Good to know — I'll factor it into how I prep your visits and what I suggest.",
    type: "chips",
    options: ["Great", "OK most nights", "Hit or miss", "Bad — need to fix this"],
    notesPlaceholder: "Anything specific going on with sleep?",
  },
  {
    id: "ls_movement",
    bucket: "Lifestyle",
    prompt: "How are you moving these days?",
    kateNote: "Comes up in checkups and primary care intake — useful for me when prepping you for visits.",
    type: "multi-chips",
    options: ["Walking", "Running", "Yoga / Stretching", "Weights / Strength", "Team sports", "Cycling / Spin", "Swimming", "Not really moving", "Other"],
    notesPlaceholder: "Anything specific you're working on?",
  },
  {
    id: "ls_food",
    bucket: "Lifestyle",
    prompt: "How about food?",
    kateNote: "Specialists ask about this in detail — useful for me to have when prepping you for visits.",
    type: "multi-chips",
    options: ["Eat what I want", "Trying to eat better", "Specific diet", "Food allergies / Intolerances", "Tracking macros", "Pregnancy / Postpartum needs", "Other"],
    notesPlaceholder: "Specific diet, restrictions, or goals?",
  },
  {
    id: "ls_substances",
    bucket: "Lifestyle",
    prompt: "Smoke, drink, or use anything recreationally?",
    kateNote: "Comes up at every annual — your provider isn't judging. Honest answer helps me prep you for the visit.",
    type: "multi-chips",
    options: ["Smoke / Vape", "Drink occasionally", "Drink regularly", "THC / Cannabis", "Other recreational", "None of the above", "Other"],
    notesPlaceholder: "Frequency or anything you're cutting back on?",
  },

  // ── Health history ──
  {
    id: "hx_chronic",
    bucket: "Health history",
    prompt: "Any chronic conditions to keep on file?",
    helper: "Pick what applies.",
    kateNote: "Useful for me to know when prepping you for visits — you decide what gets shared with offices.",
    type: "multi-chips",
    options: ["High blood pressure", "Diabetes", "Asthma", "Autoimmune", "Heart condition", "Thyroid", "Migraine", "IBS / GI", "Chronic pain", "None of those", "Other"],
    notesPlaceholder: "Specifics — controlled, severity, anything else?",
  },
  {
    id: "hx_surgeries",
    bucket: "Health history",
    prompt: "Past surgeries or hospitalizations worth flagging?",
    kateNote: "Almost every new-patient form asks. I'll have your answer ready.",
    type: "multi-chips",
    options: [
      "Cesarean / Childbirth",
      "Appendix",
      "Gallbladder",
      "Tonsils / Adenoids",
      "Wisdom teeth",
      "Hernia",
      "Knee / Joint",
      "Spine / Back",
      "Eye (LASIK / Cataract)",
      "Cardiac procedure",
      "Cancer surgery",
      "Bariatric",
      "Other surgery",
      "Hospitalized (no surgery)",
      "None",
      "Other",
    ],
    notesPlaceholder: "Year, doctor, or any details to remember?",
  },
  {
    id: "hx_family",
    bucket: "Health history",
    prompt: "Any family history we should keep an eye on?",
    helper: "What close family deals with — parents, siblings, grandparents.",
    kateNote: "Drives screening recommendations down the line — worth me knowing once.",
    type: "multi-chips",
    options: [
      "Heart disease",
      "High blood pressure",
      "Cholesterol",
      "Cancer",
      "Diabetes",
      "Stroke",
      "Autoimmune",
      "Mental health",
      "Alzheimer's / Dementia",
      "Osteoporosis",
      "Thyroid",
      "Kidney disease",
      "None I know of",
      "Other",
    ],
    notesPlaceholder: "Who, and any specifics?",
  },
  {
    id: "hx_allergies",
    bucket: "Health history",
    prompt: "Allergies?",
    kateNote: "Critical to have on file before any prescription or procedure — let me know what you've got.",
    type: "multi-chips",
    options: ["Medication", "Food", "Environmental / Seasonal", "Pet", "Latex", "None", "Other"],
    notesPlaceholder: "Specifics — what, severity, what happens?",
  },
  {
    id: "hx_meds",
    bucket: "Health history",
    prompt: "What do you take regularly?",
    kateNote: "Comes up at every appointment — I'll keep the list current and remind you about refills.",
    type: "multi-chips",
    options: ["Birth control", "BP / Heart meds", "Mental health meds", "Diabetes meds", "Thyroid", "Hormonal therapy", "Sleep aid", "Pain relief", "Vitamins / Supplements", "Nothing regular", "Other"],
    notesPlaceholder: "Names + doses if you have them handy",
  },

  // ── Day-to-day ──
  {
    id: "dt_addressing",
    bucket: "Day-to-day",
    prompt: "Anything you've been meaning to address?",
    kateNote: "Lets me prioritize what to schedule first.",
    type: "multi-chips",
    options: ["Overdue checkup", "Dental cleaning", "Eye exam", "Skin / Mole check", "Mental health support", "Specialist visit", "Bloodwork", "Nothing pressing", "Other"],
    notesPlaceholder: "What's been on your mind?",
  },
  {
    id: "dt_repro",
    bucket: "Day-to-day",
    prompt: "Where are you with reproductive health right now?",
    kateNote: "Affects which screenings, providers, and care timing I recommend.",
    type: "chips",
    options: [
      "Not focused on this right now",
      "Trying to conceive",
      "Currently pregnant",
      "Postpartum",
      "Already have kids — done",
      "Not planning to have kids",
    ],
    notesPlaceholder: "Anything I should know to help here?",
  },
  {
    id: "dt_goals",
    bucket: "Day-to-day",
    prompt: "Any health goals I should help you toward?",
    kateNote: "I'll point providers, suggestions, and check-ins at these.",
    type: "multi-chips",
    options: [
      "Weight",
      "Sleep",
      "Mental wellness",
      "Fertility",
      "Energy",
      "Strength / Fitness",
      "Eating habits",
      "Stress / Burnout",
      "Skin / Hair",
      "Hormone health",
      "Chronic condition management",
      "Pain",
      "Substance use",
      "Just maintain",
      "Other",
    ],
    notesPlaceholder: "Specifics — what would success look like?",
  },

  // ── Care preferences ──
  {
    id: "cp_telehealth",
    bucket: "Care preferences",
    prompt: "Telehealth or in-person when you have a choice?",
    kateNote: "I'll filter and recommend providers that match.",
    type: "chips",
    options: [
      "Telehealth always",
      "Telehealth when possible",
      "Hybrid",
      "In-person preferred",
      "Depends on the provider",
      "No preference",
      "Other",
    ],
    notesPlaceholder: "Anything specific?",
  },
  {
    id: "cp_gender",
    bucket: "Care preferences",
    prompt: "Provider-gender preference?",
    kateNote: "I'll respect this when suggesting providers.",
    type: "chips",
    options: ["Female", "Male", "No preference"],
    notesPlaceholder: "Any context?",
  },
  {
    id: "cp_accommodations",
    bucket: "Care preferences",
    prompt: "Anything offices should know to make visits easier?",
    kateNote: "Useful for me to know — I can flag practical accommodations to offices when you'd like (you tell me when).",
    type: "multi-chips",
    options: ["Mobility help", "Language preference", "Sensory sensitivities", "Procedure / Needle anxiety", "Need extra time", "Hearing accommodations", "None of those", "Other"],
    notesPlaceholder: "e.g. 'high white-coat anxiety, prefer slow blood draw'",
  },
];

type AnswerValue = {
  selection: string[];
  notes?: string;
};

type Answers = Record<string, AnswerValue | string | string[] | number>;

export default function IntakePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  // Intro screen — shown before the first question on a fresh intake
  // so the user knows what they're walking into (why we're asking,
  // how info gets used, ~18 short questions, skip anything). Hidden
  // once the user taps "Let's go" or they've already started.
  const [showIntro, setShowIntro] = useState(true);
  // Bucket-complete interlude — when the user finishes the last
  // question in a section we show "Done with X, keep going or come
  // back later?" instead of marching them straight into the next
  // section's first question. Set to the just-completed bucket
  // name; cleared on "Keep going". May 11 review #S9.
  const [bucketJustCompleted, setBucketJustCompleted] = useState<string | null>(null);
  // Per-question working state. Every question is chips + optional
  // notes; chipsDraft is single- or multi-select depending on question.type.
  const [chipsDraft, setChipsDraft] = useState<string[]>([]);
  const [notesDraft, setNotesDraft] = useState("");

  // Options that explicitly need user elaboration via the Notes field
  // ("Other", "Other surgery", "Specific diet", etc.). When one is
  // selected we make the Notes textarea obviously the next step —
  // relabel + autofocus — instead of leaving the user to figure out
  // the chip is a no-op without typing something. May 11 review
  // #S2 / #S12 / S15-S21 follow-up.
  const isElaborationOption = (opt: string) =>
    opt === "Other" || opt.startsWith("Other ") || opt === "Specific diet";
  // Single-selection options that are mutually exclusive with the rest
  // in their list (e.g. "Nothing regular" can't coexist with specific
  // meds). When toggled on, clear everything else. When something else
  // gets toggled on, clear this. May 11 review #S18.
  const EXCLUSIVE_OPTIONS = new Set([
    "Nothing regular",
    "None",
    "None of those",
    "None of the above",
    "None right now",
    "None I know of",
    "Nothing pressing",
  ]);

  function toggleMultiChip(opt: string) {
    setChipsDraft((prev) => {
      const isExclusive = EXCLUSIVE_OPTIONS.has(opt);
      // If user picks an exclusive "none-style" option, replace selection
      // with just that. If user picks a regular option, drop any exclusive
      // that was selected before.
      if (prev.includes(opt)) {
        return prev.filter((p) => p !== opt);
      }
      if (isExclusive) return [opt];
      return [...prev.filter((p) => !EXCLUSIVE_OPTIONS.has(p)), opt];
    });
  }

  const needsElaboration = chipsDraft.some(isElaborationOption);
  const notesRef = useCallback((node: HTMLTextAreaElement | null) => {
    if (node && needsElaboration && !notesDraft.trim()) {
      node.focus();
    }
  }, [needsElaboration, notesDraft]);

  const total = QUESTIONS.length;
  const q = QUESTIONS[index];

  const persist = useCallback(
    async (next: Answers, opts?: { complete?: boolean }) => {
      setSaving(true);
      try {
        await apiFetch("/api/patient-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: {
              intake: {
                answers: next,
                last_updated_at: new Date().toISOString(),
                completed_at: opts?.complete ? new Date().toISOString() : null,
              },
            },
          }),
        });
      } finally {
        setSaving(false);
      }
    },
    []
  );

  useEffect(() => {
    apiFetch("/api/patient-profile")
      .then((r) => r.json())
      .then((data) => {
        const intake = data?.profile?.intake;
        if (intake?.answers) {
          setAnswers(intake.answers);
          // Resume at the first unanswered question.
          const firstUnanswered = QUESTIONS.findIndex((qq) => intake.answers[qq.id] === undefined);
          setIndex(firstUnanswered === -1 ? QUESTIONS.length : firstUnanswered);
          if (intake.completed_at || firstUnanswered === -1) setDone(true);
          // Returning user — skip the intro screen
          if (Object.keys(intake.answers).length > 0) setShowIntro(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Reset drafts whenever the question changes — pre-fill from saved
  // answer (handles legacy string/array shapes alongside the new
  // {selection, notes} object).
  useEffect(() => {
    if (!q) return;
    const existing = answers[q.id];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      const av = existing as AnswerValue;
      setChipsDraft(Array.isArray(av.selection) ? av.selection : []);
      setNotesDraft(av.notes ?? "");
    } else if (Array.isArray(existing)) {
      setChipsDraft(existing);
      setNotesDraft("");
    } else if (typeof existing === "string") {
      setChipsDraft([existing]);
      setNotesDraft("");
    } else {
      setChipsDraft([]);
      setNotesDraft("");
    }
  }, [q, answers]);

  async function recordAndAdvance(value: AnswerValue | null) {
    if (!q) return;
    const next: Answers = { ...answers };
    if (
      value === null ||
      (value.selection.length === 0 && !(value.notes && value.notes.trim()))
    ) {
      // Skip — record sentinel so we don't ask again on resume.
      next[q.id] = "__skipped__";
    } else {
      next[q.id] = value;
    }
    setAnswers(next);
    const isLast = index >= QUESTIONS.length - 1;
    await persist(next, { complete: isLast });
    if (isLast) {
      setDone(true);
      return;
    }
    // If the next question is in a different bucket, surface the
    // "section complete" interlude before advancing. Gives the user
    // a natural pause and an explicit "come back later" exit. The
    // index isn't actually moved here — clearing the interlude on
    // "Keep going" does that.
    const nextQ = QUESTIONS[index + 1];
    if (nextQ && nextQ.bucket !== q.bucket) {
      setBucketJustCompleted(q.bucket);
    } else {
      setIndex(index + 1);
    }
  }

  function previous() {
    if (index > 0) setIndex(index - 1);
  }

  if (loading) {
    return (
      <PageShell maxWidth="max-w-xl">
        <div style={{ height: 200 }} />
      </PageShell>
    );
  }

  // Intro screen — orient the user before the first question so they
  // know what they're walking into (why we're asking, what we'll do
  // with the info, how long it is, skip anything). Returning users
  // who already have answers on file skip past this automatically.
  if (showIntro && !done) {
    return (
      <PageShell maxWidth="max-w-xl">
        <div style={{ paddingTop: 24, paddingBottom: 80 }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: T.lightMuted,
              fontSize: 13,
              textDecoration: "none",
              marginBottom: 24,
            }}
          >
            <ArrowLeft size={14} /> Back
          </Link>

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: T.electric, textTransform: "uppercase", marginBottom: 12 }}>
            Help Kate get to know you
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: T.lightText, lineHeight: 1.2, marginBottom: 16 }}>
            About {total} short questions — skip anything that doesn&rsquo;t fit.
          </h1>
          <p style={{ color: T.lightMuted, fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
            I&rsquo;ll ask about your mental health, lifestyle, history, and care preferences.
            Each question has chip choices plus an optional notes field for anything else.
          </p>

          <div
            style={{
              padding: "14px 16px",
              background: "rgba(22,119,255,0.06)",
              border: `1px solid rgba(22,119,255,0.18)`,
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: T.lightText, marginBottom: 6 }}>
              How I&rsquo;ll use this
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: T.lightMuted, fontSize: 13.5, lineHeight: 1.6 }}>
              <li>Personalize what I surface on your dashboard</li>
              <li>Prep you for visits with the right context</li>
              <li>Suggest providers or screenings that match what you&rsquo;ve told me</li>
            </ul>
            <div style={{ fontSize: 12, color: T.lightMuted, marginTop: 10, lineHeight: 1.5 }}>
              Nothing leaves QBH unless you ask me to share it. You can pause anytime and pick back up where you left off.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowIntro(false)}
              style={{
                padding: "12px 20px",
                background: T.electric,
                color: T.white,
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Let&rsquo;s go <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (done) {
    return (
      <PageShell maxWidth="max-w-xl">
        <div style={{ paddingTop: 24, paddingBottom: 80 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: T.lightText, marginBottom: 12 }}>
            All set.
          </h1>
          <p style={{ color: T.lightMuted, fontSize: 15, lineHeight: 1.5, marginBottom: 24 }}>
            Thanks for sharing — I'll use this to make your daily check-ins
            and suggestions more relevant. You can update anything anytime.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setIndex(0);
                setDone(false);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                background: "rgba(22,119,255,0.08)",
                color: T.electric,
                border: `1px solid ${T.lightBorder}`,
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Review my answers
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                background: T.electric,
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  // Bucket-complete interlude. Renders between sections so the user
  // doesn't feel like they're marching through 18 questions in a row.
  // "Keep going" continues to the next bucket's first question; "Come
  // back later" returns to the dashboard — the resume logic on next
  // mount picks up where they left off.
  if (bucketJustCompleted) {
    const remaining = QUESTIONS.filter((qq) => answers[qq.id] === undefined).length;
    const nextBucket = QUESTIONS[index + 1]?.bucket;
    return (
      <PageShell maxWidth="max-w-xl">
        <div style={{ paddingTop: 24, paddingBottom: 80 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: T.electric, textTransform: "uppercase", marginBottom: 12 }}>
            Section complete
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.lightText, lineHeight: 1.2, marginBottom: 12 }}>
            Done with {bucketJustCompleted.toLowerCase()}.
          </h1>
          <p style={{ color: T.lightMuted, fontSize: 15, lineHeight: 1.55, marginBottom: 24 }}>
            {remaining > 0
              ? `${remaining} question${remaining === 1 ? "" : "s"} left across ${nextBucket ? `"${nextBucket}"` : "the rest"}. You can keep going or come back later — I'll remember where you left off.`
              : "That's the last section."}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setBucketJustCompleted(null);
                setIndex(index + 1);
              }}
              style={{
                padding: "12px 20px",
                background: T.electric,
                color: T.white,
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Keep going <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              style={{
                padding: "12px 20px",
                background: "white",
                color: T.lightText,
                border: `1px solid ${T.lightBorder}`,
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Come back later
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!q) return null;

  const progress = ((index + 1) / total) * 100;
  // Submit is enabled if the user picked at least one chip OR typed
  // a notes-only answer. Either is a real signal.
  const canSubmit = chipsDraft.length > 0 || notesDraft.trim().length > 0;

  return (
    <PageShell maxWidth="max-w-xl">
      <div style={{ paddingTop: 8, paddingBottom: 80 }}>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: T.lightMuted,
            fontSize: 13,
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} /> Pause for now
        </Link>

        <div
          style={{
            background: "rgba(255,255,255,0.7)",
            borderRadius: 999,
            height: 4,
            marginBottom: 18,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: T.electric,
              transition: "width 200ms",
            }}
          />
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: T.lightMuted, textTransform: "uppercase", marginBottom: 8 }}>
          {q.bucket} · {index + 1} of {total}
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 600, color: T.lightText, lineHeight: 1.3, marginBottom: 8 }}>
          {q.prompt}
        </h1>
        {q.helper && (
          <p style={{ color: T.lightMuted, fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }}>
            {q.helper}
          </p>
        )}
        {q.kateNote && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 12px",
              background: "rgba(22,119,255,0.06)",
              border: `1px solid rgba(22,119,255,0.18)`,
              borderRadius: 12,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 6,
                alignSelf: "stretch",
                background: T.electric,
                borderRadius: 999,
                flexShrink: 0,
              }}
              aria-hidden
            />
            <div style={{ fontSize: 13, lineHeight: 1.5, color: T.lightText }}>
              <span style={{ fontWeight: 600, color: T.electric }}>Kate · </span>
              {q.kateNote}
            </div>
          </div>
        )}

        {/* Contextual follow-up: when the user says they're curious
            about therapy, surface a concrete next-step note so the
            answer doesn't go into a black hole. Kate doesn't currently
            book therapists from intake, but this signals what'll happen
            with the answer. May 11 review #S6. */}
        {q.id === "mh_therapist" && chipsDraft[0] === "Curious about it" && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.28)",
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.5,
              color: "#15803D",
            }}
          >
            <span style={{ fontWeight: 600 }}>Kate · </span>
            Got it. I&rsquo;ll surface this back to you in a follow-up — you can think on what kind of support you&rsquo;d want, and I&rsquo;ll help you find the right person when you&rsquo;re ready.
          </div>
        )}

        {q.type === "chips" && q.options && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map((opt) => {
              const selected = chipsDraft[0] === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setChipsDraft([opt])}
                  style={{
                    display: "block",
                    textAlign: "left",
                    padding: "12px 14px",
                    background: selected ? "rgba(22,119,255,0.10)" : "white",
                    color: T.lightText,
                    border: `1px solid ${selected ? T.electric : T.lightBorder}`,
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: selected ? 600 : 500,
                    cursor: "pointer",
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "multi-chips" && q.options && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {q.options.map((opt) => {
              const selected = chipsDraft.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleMultiChip(opt)}
                  style={{
                    padding: "8px 14px",
                    background: selected ? T.electric : "white",
                    color: selected ? "white" : T.lightText,
                    border: `1px solid ${selected ? T.electric : T.lightBorder}`,
                    borderRadius: 999,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {selected ? "✓ " : ""}{opt}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "scale" && q.options && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {q.options.map((opt) => {
              const selected = chipsDraft[0] === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setChipsDraft([opt])}
                  style={{
                    minWidth: 44,
                    padding: "10px 12px",
                    background: selected ? T.electric : "white",
                    color: selected ? "white" : T.lightText,
                    border: `1px solid ${selected ? T.electric : T.lightBorder}`,
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* Notes — always available so users can add nuance the chips
            can't capture. When the user picked an option that needs
            elaboration ("Other", "Specific diet"), the label flips to
            "Tell me about it" and the field auto-focuses so they don't
            have to figure out the chip is a no-op without typing. */}
        <div style={{ marginTop: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              color: needsElaboration ? T.electric : T.lightMuted,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {needsElaboration ? "Tell me about it" : "Notes"}{" "}
            <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
              {needsElaboration ? "" : "(optional)"}
            </span>
          </label>
          <textarea
            ref={notesRef}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder={
              needsElaboration
                ? "A few words is plenty."
                : q.notesPlaceholder || "Anything else you'd like to add?"
            }
            rows={2}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              color: T.lightText,
              border: `1px solid ${needsElaboration ? T.electric : T.lightBorder}`,
              borderRadius: 12,
              outline: "none",
              background: "white",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, gap: 12 }}>
          <button
            onClick={previous}
            disabled={index === 0 || saving}
            style={{
              padding: "10px 16px",
              background: "transparent",
              color: T.lightMuted,
              border: "none",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: index === 0 ? "default" : "pointer",
              opacity: index === 0 ? 0.5 : 1,
            }}
          >
            ← Back
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => recordAndAdvance(null)}
              disabled={saving}
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: T.lightMuted,
                border: `1px solid ${T.lightBorder}`,
                borderRadius: 12,
                fontSize: 13.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Skip
            </button>
            <button
              onClick={() => {
                if (!canSubmit) return;
                recordAndAdvance({
                  selection: chipsDraft,
                  notes: notesDraft.trim() || undefined,
                });
              }}
              disabled={!canSubmit || saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                background: canSubmit ? T.electric : "rgba(22,119,255,0.30)",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: canSubmit && !saving ? "pointer" : "default",
              }}
            >
              {saving ? "Saving…" : "Next"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
