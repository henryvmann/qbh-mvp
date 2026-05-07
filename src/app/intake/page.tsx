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
    helper: "Pick all that apply. This is between us — I won't share with offices unless you ask.",
    type: "multi-chips",
    options: ["Anxiety", "Depression", "Stress", "Sleep trouble", "Burnout", "Grief", "ADHD / focus", "Trauma", "None right now"],
    notesPlaceholder: "Anything else you'd want me to know?",
  },
  {
    id: "mh_therapist",
    bucket: "Mental health",
    prompt: "Do you have a current therapist and/or medication manager?",
    type: "chips",
    options: ["Yes — current", "Used to", "Curious about it", "Not for me"],
    notesPlaceholder: "Their name, or what you've been thinking about?",
  },
  {
    id: "mh_stress_level",
    bucket: "Mental health",
    prompt: "On a normal week, how would you rank your stress?",
    helper: "1 = totally chill, 10 = barely holding it together",
    type: "scale",
    options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    notesPlaceholder: "What's driving it lately?",
  },

  // ── Lifestyle ──
  {
    id: "ls_sleep",
    bucket: "Lifestyle",
    prompt: "How's sleep these days?",
    type: "chips",
    options: ["Great", "OK most nights", "Hit or miss", "Bad — need to fix this"],
    notesPlaceholder: "Anything specific going on with sleep?",
  },
  {
    id: "ls_movement",
    bucket: "Lifestyle",
    prompt: "How are you moving these days?",
    type: "multi-chips",
    options: ["Walking", "Running", "Yoga / stretching", "Weights / strength", "Team sports", "Cycling / spin", "Swimming", "Not really moving"],
    notesPlaceholder: "Anything specific you're working on?",
  },
  {
    id: "ls_food",
    bucket: "Lifestyle",
    prompt: "How about food?",
    type: "multi-chips",
    options: ["Eat what I want", "Trying to eat better", "Specific diet", "Food allergies / intolerances", "Tracking macros", "Pregnancy / postpartum needs"],
    notesPlaceholder: "Specific diet, restrictions, or goals?",
  },
  {
    id: "ls_substances",
    bucket: "Lifestyle",
    prompt: "Smoke, drink, or use anything recreationally?",
    helper: "Helps Kate frame visit prep when offices ask.",
    type: "multi-chips",
    options: ["Smoke / vape", "Drink occasionally", "Drink regularly", "THC / cannabis", "Other recreational", "None of the above"],
    notesPlaceholder: "Frequency or anything you're cutting back on?",
  },

  // ── Health history ──
  {
    id: "hx_chronic",
    bucket: "Health history",
    prompt: "Any chronic conditions to keep on file?",
    helper: "Pick what applies — Kate uses these when prepping for appointments.",
    type: "multi-chips",
    options: ["High blood pressure", "Diabetes", "Asthma", "Autoimmune", "Heart condition", "Thyroid", "Migraine", "IBS / GI", "Chronic pain", "None of those"],
    notesPlaceholder: "Specifics — controlled, severity, anything else?",
  },
  {
    id: "hx_surgeries",
    bucket: "Health history",
    prompt: "Past surgeries or hospitalizations worth flagging?",
    type: "multi-chips",
    options: ["Cesarean / childbirth", "Appendix", "Gallbladder", "Tonsils / adenoids", "Knee / joint", "Other surgery", "Hospitalized (no surgery)", "None"],
    notesPlaceholder: "Year, doctor, or any details to remember?",
  },
  {
    id: "hx_family",
    bucket: "Health history",
    prompt: "Any family history we should keep an eye on?",
    helper: "What close family deals with — parents, siblings, grandparents.",
    type: "multi-chips",
    options: ["Heart disease", "Cancer", "Diabetes", "Mental health", "Autoimmune", "Stroke", "High blood pressure", "Alzheimer's / dementia", "None I know of"],
    notesPlaceholder: "Who, and any specifics?",
  },
  {
    id: "hx_allergies",
    bucket: "Health history",
    prompt: "Allergies?",
    type: "multi-chips",
    options: ["Medication allergy", "Food allergy", "Environmental / seasonal", "Pet allergy", "Latex", "None"],
    notesPlaceholder: "Specifics — what, severity, what happens?",
  },
  {
    id: "hx_meds",
    bucket: "Health history",
    prompt: "What do you take regularly?",
    type: "multi-chips",
    options: ["Birth control", "BP / heart meds", "Mental health meds", "Diabetes meds", "Thyroid", "Hormonal therapy", "Sleep aid", "Pain relief", "Vitamins / supplements", "Nothing regular"],
    notesPlaceholder: "Names + doses if you have them handy",
  },

  // ── Day-to-day ──
  {
    id: "dt_addressing",
    bucket: "Day-to-day",
    prompt: "Anything you've been meaning to address?",
    type: "multi-chips",
    options: ["Overdue checkup", "Dental cleaning", "Eye exam", "Skin / mole check", "Mental health support", "Specialist visit", "Bloodwork", "Nothing pressing"],
    notesPlaceholder: "What's been on your mind?",
  },
  {
    id: "dt_repro",
    bucket: "Day-to-day",
    prompt: "Where are you on the family front?",
    type: "chips",
    options: ["Not relevant right now", "Trying to conceive", "Currently pregnant", "Postpartum", "Done having kids"],
    notesPlaceholder: "Anything I should know to help here?",
  },
  {
    id: "dt_goals",
    bucket: "Day-to-day",
    prompt: "Any health goals I should help you toward?",
    type: "multi-chips",
    options: ["Weight", "Sleep", "Mental health", "Fertility", "Energy", "Strength / fitness", "Eating habits", "Just maintain"],
    notesPlaceholder: "Specifics — what would success look like?",
  },

  // ── Care preferences ──
  {
    id: "cp_telehealth",
    bucket: "Care preferences",
    prompt: "Telehealth or in-person when you have a choice?",
    type: "chips",
    options: ["Telehealth always", "Telehealth when possible", "In-person preferred", "No preference"],
    notesPlaceholder: "Anything specific?",
  },
  {
    id: "cp_gender",
    bucket: "Care preferences",
    prompt: "Provider-gender preference?",
    type: "chips",
    options: ["Female", "Male", "No preference"],
    notesPlaceholder: "Any context?",
  },
  {
    id: "cp_accommodations",
    bucket: "Care preferences",
    prompt: "Anything offices should know to make visits easier?",
    type: "multi-chips",
    options: ["Mobility help", "Language preference", "Sensory sensitivities", "Procedure / needle anxiety", "Need extra time", "Hearing accommodations", "None of those"],
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
  // Per-question working state. Every question is chips + optional
  // notes; chipsDraft is single- or multi-select depending on question.type.
  const [chipsDraft, setChipsDraft] = useState<string[]>([]);
  const [notesDraft, setNotesDraft] = useState("");

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
          <p style={{ color: T.lightMuted, fontSize: 13.5, lineHeight: 1.5, marginBottom: 20 }}>
            {q.helper}
          </p>
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
                  onClick={() =>
                    setChipsDraft((prev) =>
                      prev.includes(opt) ? prev.filter((p) => p !== opt) : [...prev, opt]
                    )
                  }
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
            can't capture. Optional; the chips are the structured part
            Kate uses for personalization. */}
        <div style={{ marginTop: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              color: T.lightMuted,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Notes <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
          </label>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder={q.notesPlaceholder || "Anything else you'd like to add?"}
            rows={2}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              color: T.lightText,
              border: `1px solid ${T.lightBorder}`,
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
