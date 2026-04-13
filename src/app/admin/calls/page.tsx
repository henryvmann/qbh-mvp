"use client";

import { useEffect, useState } from "react";
import TopNav from "../../../components/qbh/TopNav";
import { apiFetch } from "../../../lib/api";

type Scorecard = {
  overall_score: number;
  scores: Record<string, number>;
  issues: string[];
  prompt_suggestions: string[];
  call_summary: string;
  booked: boolean;
};

type CallEntry = {
  attempt_id: number;
  transcript_preview: string;
  summary: string | null;
  created_at: string;
  scorecard: Scorecard | null;
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 4 ? "#5C6B5C" : score >= 3 ? "#B8A020" : "#C03020";
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {score.toFixed(1)}
    </span>
  );
}

export default function AdminCallsPage() {
  const [calls, setCalls] = useState<CallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    apiFetch("/api/admin/call-quality")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setCalls(data.calls || []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function analyzeCall(attemptId: number) {
    setAnalyzing(attemptId);
    try {
      const res = await apiFetch("/api/admin/call-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: attemptId }),
      });
      const data = await res.json();
      if (data.ok && data.scorecard) {
        setCalls((prev) =>
          prev.map((c) =>
            c.attempt_id === attemptId ? { ...c, scorecard: data.scorecard } : c
          )
        );
      }
    } finally {
      setAnalyzing(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <TopNav />
      <div className="mx-auto max-w-4xl px-6 pt-8 pb-20">
        <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E]">
          Call Quality Dashboard
        </h1>
        <p className="mt-1 text-sm text-[#7A7F8A]">
          {calls.length} recent calls — click to analyze
        </p>

        {/* Summary stats */}
        {calls.some((c) => c.scorecard) && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white border border-[#EBEDF0] shadow-sm p-4 text-center">
              <div className="text-2xl font-light text-[#5C6B5C]">
                {(calls.filter((c) => c.scorecard).reduce((sum, c) => sum + (c.scorecard?.overall_score || 0), 0) / calls.filter((c) => c.scorecard).length).toFixed(1)}
              </div>
              <div className="text-xs text-[#7A7F8A]">Avg Score</div>
            </div>
            <div className="rounded-xl bg-white border border-[#EBEDF0] shadow-sm p-4 text-center">
              <div className="text-2xl font-light text-[#5C6B5C]">
                {calls.filter((c) => c.scorecard?.booked).length}
              </div>
              <div className="text-xs text-[#7A7F8A]">Booked</div>
            </div>
            <div className="rounded-xl bg-white border border-[#EBEDF0] shadow-sm p-4 text-center">
              <div className="text-2xl font-light text-[#C03020]">
                {calls.filter((c) => c.scorecard && (c.scorecard.issues?.length || 0) > 0).length}
              </div>
              <div className="text-xs text-[#7A7F8A]">With Issues</div>
            </div>
          </div>
        )}

        {/* Aggregated prompt suggestions */}
        {calls.some((c) => c.scorecard?.prompt_suggestions?.length) && (
          <div className="mt-6 rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-5">
            <div className="text-sm font-semibold text-[#1A1D2E] mb-3">
              Prompt Improvement Suggestions (from recent calls)
            </div>
            <div className="space-y-2">
              {Array.from(new Set(
                calls.flatMap((c) => c.scorecard?.prompt_suggestions || [])
              )).slice(0, 8).map((suggestion, i) => (
                <div key={i} className="flex gap-2 text-xs text-[#7A7F8A]">
                  <span className="text-[#5C6B5C] shrink-0">→</span>
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call list */}
        <div className="mt-6 space-y-3">
          {calls.map((call) => (
            <div
              key={call.attempt_id}
              className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#F0F2F5] transition"
                onClick={() => setExpanded(expanded === call.attempt_id ? null : call.attempt_id)}
              >
                <div className="flex items-center gap-3">
                  {call.scorecard ? (
                    <ScoreBadge score={call.scorecard.overall_score} />
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-[#EBEDF0]" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-[#1A1D2E]">
                      Attempt #{call.attempt_id}
                      {call.scorecard?.booked && (
                        <span className="ml-2 text-xs text-[#5C6B5C]">✓ Booked</span>
                      )}
                    </div>
                    <div className="text-xs text-[#7A7F8A]">
                      {call.scorecard?.call_summary || call.summary || call.transcript_preview}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#B0B4BC]">
                    {new Date(call.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                  {!call.scorecard && (
                    <button
                      onClick={(e) => { e.stopPropagation(); analyzeCall(call.attempt_id); }}
                      disabled={analyzing === call.attempt_id}
                      className="rounded-lg px-3 py-1 text-xs font-medium text-[#5C6B5C] bg-[#5C6B5C]/10 hover:bg-[#5C6B5C]/20 disabled:opacity-50"
                    >
                      {analyzing === call.attempt_id ? "Analyzing..." : "Analyze"}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {expanded === call.attempt_id && call.scorecard && (
                <div className="border-t border-[#EBEDF0] p-4 bg-[#F0F2F5]/50">
                  {/* Score breakdown */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {Object.entries(call.scorecard.scores).map(([key, val]) => (
                      <div key={key} className="text-center">
                        <div className="text-lg font-light" style={{ color: val >= 4 ? "#5C6B5C" : val >= 3 ? "#B8A020" : "#C03020" }}>
                          {val}
                        </div>
                        <div className="text-[10px] text-[#7A7F8A] capitalize">
                          {key.replace(/_/g, " ")}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Issues */}
                  {call.scorecard.issues.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-[#C03020] mb-1">Issues</div>
                      {call.scorecard.issues.map((issue, i) => (
                        <div key={i} className="text-xs text-[#7A7F8A] flex gap-1">
                          <span className="text-[#C03020]">•</span> {issue}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  {call.scorecard.prompt_suggestions.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-[#5C6B5C] mb-1">Prompt Suggestions</div>
                      {call.scorecard.prompt_suggestions.map((s, i) => (
                        <div key={i} className="text-xs text-[#7A7F8A] flex gap-1">
                          <span className="text-[#5C6B5C]">→</span> {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
