// src/components/qbh/HandleItButton.tsx
"use client";

import * as React from "react";

type Props = {
  providerId: string;
  attemptId?: number | null;
  label?: string;
};

function getEndpoint(): string {
  return (
    (process.env.NEXT_PUBLIC_QBH_HANDLE_IT_ENDPOINT || "").trim() ||
    "/api/vapi/start-call"
  );
}

export default function HandleItButton({ providerId, attemptId, label = "Handle It" }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    setToast(null);

    try {
      const res = await fetch(getEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          ...(attemptId ? { attempt_id: attemptId } : {}),
        }),
      });

      const ct = res.headers.get("content-type") || "";
      const payload = ct.includes("application/json")
        ? await res.json().catch(() => null)
        : await res.text().catch(() => "");

      if (!res.ok) {
        const msg =
          (payload && (payload.error || payload.message)) ||
          (typeof payload === "string" ? payload : "") ||
          `Request failed (${res.status})`;
        setToast({ kind: "error", text: String(msg) });
        return;
      }

      const msg =
        (payload && (payload.message || payload.status)) ||
        "Queued — QBH is placing the call.";
      setToast({ kind: "ok", text: String(msg) });
    } catch (e: any) {
      setToast({ kind: "error", text: e?.message || "Network error" });
    } finally {
      setLoading(false);
      window.setTimeout(() => setToast(null), 3500);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="group relative w-full overflow-hidden rounded-2xl bg-[#7B9D83] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[0.98] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="relative z-10">{loading ? "One moment…" : label}</span>
        <span className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
          <span className="absolute -left-1/3 top-0 h-full w-1/2 rotate-12 bg-white/10 blur-xl" />
        </span>
      </button>

      {toast ? (
        <div
          className={
            "mt-2 rounded-xl px-3 py-2 text-xs shadow-sm " +
            (toast.kind === "ok"
              ? "bg-[#E7EFE5] text-[#2F3A2B]"
              : "bg-[#F3EBDD] text-[#4A3B22]")
          }
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}