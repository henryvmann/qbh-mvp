"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type Question = {
  id: string;
  type: string;
  provider_id: string | null;
  provider_name: string | null;
  question: string;
  options?: string[];
};

export default function KateFollowUp() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch("/api/kate/post-call")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) setQuestions(data.questions || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveAnswer = useCallback(async (questionId: string, answer: string) => {
    await apiFetch("/api/kate/post-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: questionId, answer }),
    }).catch(() => {});
    setSaved((prev) => new Set([...prev, questionId]));
  }, []);

  const pending = questions.filter((q) => !saved.has(q.id));

  if (loading || pending.length === 0) return null;

  return (
    <div className="mt-6 px-7">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: "#1677FF" }}
        >
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
            <text x="7" y="11" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="system-ui" fill="#D8E8F5">K</text>
          </svg>
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-[#4F5F73]">
          Quick Questions from Kate
        </span>
      </div>

      <div className="space-y-3">
        {pending.map((q) => (
          <div
            key={q.id}
            className="rounded-xl bg-white border border-[#E5EAF2] shadow-sm p-4"
          >
            <div className="text-sm font-medium text-[#071832]">{q.question}</div>

            {q.type === "choice" && q.options ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => saveAnswer(q.id, opt)}
                    className="rounded-lg border border-[#E5EAF2] bg-[#F0F2F5] px-3 py-1.5 text-xs text-[#071832] hover:bg-[#E8EBF0] transition"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Enter here..."
                  className="flex-1 rounded-lg bg-[#F0F2F5] border border-[#E5EAF2] px-3 py-1.5 text-xs text-[#071832] placeholder:text-[#4F5F73] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && answers[q.id]?.trim()) {
                      saveAnswer(q.id, answers[q.id].trim());
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (answers[q.id]?.trim()) saveAnswer(q.id, answers[q.id].trim());
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                  style={{ background: "#1677FF" }}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
