"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import PageShell from "../../../components/qbh/PageShell";

type TestLog = {
  id: string;
  call_id: string;
  transcript: string;
  analysis: string;
  created_at: string;
};

export default function CallTestResults() {
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    apiFetch("/api/vapi/test-loop")
      .then((r) => r.json())
      .then((d) => setLogs(d.calls || []))
      .finally(() => setLoading(false));
  }, []);

  async function triggerCall() {
    setTriggering(true);
    try {
      const res = await apiFetch("/api/vapi/test-loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      alert(data.ok ? `Call triggered for ${data.provider}` : data.error);
    } catch {
      alert("Failed to trigger call");
    } finally {
      setTriggering(false);
    }
  }

  if (loading) return <PageShell><div /></PageShell>;

  return (
    <PageShell maxWidth="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#071832]">Call Test Results</h1>
        <button
          onClick={triggerCall}
          disabled={triggering}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "#1677FF" }}
        >
          {triggering ? "Triggering..." : "Trigger Test Call"}
        </button>
      </div>
      <p className="mt-1 text-sm text-[#4F5F73]">AI analysis of Kate's test calls with Sandra</p>

      {logs.length === 0 ? (
        <div className="mt-8 text-center text-sm text-[#4F5F73]">
          No test calls analyzed yet. Trigger a call or enable AUTO_ANALYZE_CALLS=true in env vars.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {logs.map((log) => (
            <div key={log.id || log.call_id} className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-white/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#071832]">{log.call_id}</span>
                <span className="text-[10px] text-[#4F5F73]">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              <div className="p-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#4F5F73] mb-2">Analysis</div>
                <div className="text-sm text-[#071832] whitespace-pre-line leading-relaxed">
                  {log.analysis}
                </div>
                <details className="mt-4">
                  <summary className="text-xs text-[#4F5F73] cursor-pointer hover:text-[#071832]">View transcript</summary>
                  <pre className="mt-2 text-xs text-[#4F5F73] whitespace-pre-wrap max-h-60 overflow-y-auto bg-white/30 rounded-xl p-3">
                    {log.transcript}
                  </pre>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
