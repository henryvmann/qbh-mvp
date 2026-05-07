"use client";

// Internal-only page for verifying the VAPI dialing pipeline goes
// end-to-end: tap the button → real outbound call to the hardcoded
// test number. Uses POST /api/vapi/test-call which reuses the same
// start-call path a real Handle-It would.
//
// Auth-required (session enforced server-side). Confirmation prompt
// before dialing so a misclick doesn't burn a VAPI call.

import { useState } from "react";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import { T } from "../../components/brand";

const TEST_NUMBER_DISPLAY = "(301) 943-2373";

export default function TestCallPage() {
  const [status, setStatus] = useState<"idle" | "calling" | "ok" | "error">(
    "idle"
  );
  const [detail, setDetail] = useState<string | null>(null);

  async function fire() {
    if (status === "calling") return;
    if (!window.confirm(`This will place a real outbound call to ${TEST_NUMBER_DISPLAY}. Continue?`)) {
      return;
    }
    setStatus("calling");
    setDetail(null);
    try {
      const res = await apiFetch("/api/vapi/test-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setStatus("error");
        setDetail(JSON.stringify(data, null, 2));
        return;
      }
      setStatus("ok");
      setDetail(`Call placed. Vapi call ID: ${data?.call_id || data?.id || "(see logs)"}`);
    } catch (err) {
      setStatus("error");
      setDetail(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <PageShell maxWidth="max-w-md">
      <div style={{ paddingTop: 24, paddingBottom: 80 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.lightText, marginBottom: 8 }}>
          Dialer test
        </h1>
        <p style={{ fontSize: 13, color: T.lightMuted, lineHeight: 1.5, marginBottom: 16 }}>
          Places a real outbound call via VAPI to{" "}
          <strong style={{ color: T.lightText }}>{TEST_NUMBER_DISPLAY}</strong>.
          Uses the same pipeline as a real Have-Kate-Book call, with the
          same prompt, voice, and tools. For verifying end-to-end before
          flipping a real receptionist.
        </p>

        <button
          type="button"
          onClick={fire}
          disabled={status === "calling"}
          style={{
            width: "100%",
            padding: "14px 16px",
            background: status === "calling" ? "#9CB4D5" : T.electric,
            color: T.white,
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: status === "calling" ? "default" : "pointer",
          }}
        >
          {status === "calling" ? "Placing call…" : `Call ${TEST_NUMBER_DISPLAY}`}
        </button>

        {status === "ok" && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "rgba(39,196,107,0.08)",
              border: "1px solid rgba(39,196,107,0.3)",
              borderRadius: 10,
              fontSize: 13,
              color: T.lightText,
            }}
          >
            <strong>Call placed.</strong> {detail}
          </div>
        )}
        {status === "error" && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "rgba(224,64,48,0.08)",
              border: "1px solid rgba(224,64,48,0.3)",
              borderRadius: 10,
              fontSize: 12,
              color: T.lightText,
            }}
          >
            <strong>Failed.</strong>
            <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", marginTop: 6 }}>
              {detail}
            </pre>
          </div>
        )}

        <p style={{ marginTop: 16, fontSize: 11, color: T.lightMuted }}>
          A &ldquo;QBH Test Practice&rdquo; provider is created on first run
          (status=archived, hidden from dashboards) so this doesn&rsquo;t
          pollute your real care team.
        </p>
      </div>
    </PageShell>
  );
}
