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

type QuestionType = "chips" | "multi-chips" | "text" | "scale";

type Question = {
  id: string;
  bucket: string;
  prompt: string;
  helper?: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
  /** Allow free-text alongside chips for nuance. */
  freeTextLabel?: string;
};

const QUESTIONS: Question[] = [
  // ── Mental health (front-loaded — highest leverage for personalization) ──
  {
    id: "mh_concerns",
    bucket: "Mental health",
    prompt: "Anything weighing on you mental-health-wise?",
    helper: "Pick all that apply. This is between us — I won't share with offices unless you ask.",
    type: "multi-chips",
    options: ["Anxiety", "Depression", "Stress", "Sleep trouble", "Burnout", "Grief", "None of those right now"],
  },
  {
    id: "mh_therapist",
    bucket: "Mental health",
    prompt: "Therapist or psychiatrist on file?",
    type: "chips",
    options: ["Yes — current", "Used to", "No — but I'm curious", "No — not for me"],
  },
  {
    id: "mh_stress_level",
    bucket: "Mental health",
    prompt: "On a normal week, where's your stress?",
    helper: "1 = totally chill, 10 = barely holding it together",
    type: "scale",
    options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  },

  // ── Lifestyle ──
  {
    id: "ls_sleep",
    bucket: "Lifestyle",
    prompt: "How's sleep these days?",
    type: "chips",
    options: ["Great", "OK most nights", "Hit or miss", "Bad — need to fix this"],
  },
  {
    id: "ls_movement",
    bucket: "Lifestyle",
    prompt: "Movement and food — anything you're working on?",
    type: "text",
    placeholder: "e.g. 'walking 5x/wk, trying to eat more protein'",
  },
  {
    id: "ls_substances",
    bucket: "Lifestyle",
    prompt: "Smoke, drink, or use anything recreationally?",
    helper: "Helps Kate frame visit prep when offices ask.",
    type: "multi-chips",
    options: ["Smoke / vape", "Drink occasionally", "Drink regularly", "THC / cannabis", "Other recreational", "None of the above"],
  },

  // ── Health history ──
  {
    id: "hx_chronic",
    bucket: "Health history",
    prompt: "Any chronic conditions I should know about?",
    helper: "Diabetes, BP, autoimmune, asthma, etc.",
    type: "text",
    placeholder: "e.g. 'high blood pressure (controlled), seasonal allergies'",
  },
  {
    id: "hx_surgeries",
    bucket: "Health history",
    prompt: "Past surgeries or hospitalizations worth flagging?",
    type: "text",
    placeholder: "e.g. 'gallbladder out 2019'",
  },
  {
    id: "hx_family",
    bucket: "Health history",
    prompt: "Family history that runs?",
    helper: "Heart disease, cancer, mental health, autoimmune — anything close family deals with.",
    type: "text",
    placeholder: "e.g. 'heart disease (dad), breast cancer (grandma)'",
  },
  {
    id: "hx_allergies",
    bucket: "Health history",
    prompt: "Allergies — meds, food, environmental?",
    type: "text",
    placeholder: "e.g. 'penicillin (rash), peanuts (mild)'",
  },
  {
    id: "hx_meds",
    bucket: "Health history",
    prompt: "Current meds (anything you take regularly)?",
    type: "text",
    placeholder: "e.g. 'Lisinopril 10mg daily, Lexapro 20mg'",
  },

  // ── Day-to-day ──
  {
    id: "dt_addressing",
    bucket: "Day-to-day",
    prompt: "Anything you've been meaning to address but haven't gotten to?",
    type: "text",
    placeholder: "e.g. 'overdue dental cleaning, weird mole I keep ignoring'",
  },
  {
    id: "dt_repro",
    bucket: "Day-to-day",
    prompt: "Where are you on the family front?",
    type: "chips",
    options: ["Not relevant", "Trying to conceive", "Currently pregnant", "Postpartum", "Done having kids", "Skip"],
  },
  {
    id: "dt_goals",
    bucket: "Day-to-day",
    prompt: "Any health goals I should help you toward?",
    type: "text",
    placeholder: "e.g. 'lose 15 lbs, lower BP, sleep better'",
  },

  // ── Care preferences ──
  {
    id: "cp_telehealth",
    bucket: "Care preferences",
    prompt: "Telehealth or in-person when you have a choice?",
    type: "chips",
    options: ["Telehealth always", "Telehealth when possible", "In-person preferred", "No preference"],
  },
  {
    id: "cp_gender",
    bucket: "Care preferences",
    prompt: "Provider-gender preference?",
    type: "chips",
    options: ["Female", "Male", "No preference"],
  },
  {
    id: "cp_accommodations",
    bucket: "Care preferences",
    prompt: "Anything offices should know that helps your visits go better?",
    helper: "Mobility, language, sensory, anxiety around procedures, etc.",
    type: "text",
    placeholder: "e.g. 'high white-coat anxiety, prefer slow blood draw'",
  },
];

type Answers = Record<string, string | string[] | number>;

export default function IntakePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [textDraft, setTextDraft] = useState("");
  const [chipsDraft, setChipsDraft] = useState<string[]>([]);

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
  // answer if the user is revisiting.
  useEffect(() => {
    if (!q) return;
    const existing = answers[q.id];
    if (q.type === "text") {
      setTextDraft(typeof existing === "string" ? existing : "");
      setChipsDraft([]);
    } else if (q.type === "multi-chips") {
      setChipsDraft(Array.isArray(existing) ? existing : []);
      setTextDraft("");
    } else {
      setChipsDraft(typeof existing === "string" ? [existing] : []);
      setTextDraft("");
    }
  }, [q, answers]);

  async function recordAndAdvance(value: string | string[] | number | null) {
    if (!q) return;
    const next: Answers = { ...answers };
    if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      // Skip — record empty so we don't ask again on resume.
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
  const canSubmit =
    q.type === "text"
      ? textDraft.trim().length > 0
      : chipsDraft.length > 0;

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

        {q.type === "text" && (
          <textarea
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            placeholder={q.placeholder || ""}
            rows={3}
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: 15,
              color: T.lightText,
              border: `1px solid ${T.lightBorder}`,
              borderRadius: 12,
              outline: "none",
              background: "white",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
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
                if (q.type === "text") {
                  if (canSubmit) recordAndAdvance(textDraft.trim());
                } else if (q.type === "multi-chips") {
                  if (canSubmit) recordAndAdvance(chipsDraft);
                } else {
                  if (canSubmit) recordAndAdvance(chipsDraft[0]);
                }
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
