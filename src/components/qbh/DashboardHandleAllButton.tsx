"use client";

import * as React from "react";

type ActionableProvider = {
  providerId: string;
  providerName: string;
};

type Props = {
  userId: string;
  providers: ActionableProvider[];
};

function getEndpoint(): string {
  return (
    (process.env.NEXT_PUBLIC_QBH_HANDLE_IT_ENDPOINT || "").trim() ||
    "/api/vapi/start-call"
  );
}

export default function DashboardHandleAllButton({
  userId,
  providers,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const actionableProviders = React.useMemo(() => {
    const seen = new Set<string>();

    return providers.filter((provider) => {
      const key = provider.providerId.trim();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [providers]);

  async function onClick() {
    if (loading) return;
    if (!userId || actionableProviders.length === 0) return;

    setLoading(true);
    setToast(null);

    try {
      const results = await Promise.allSettled(
        actionableProviders.map((provider) =>
          fetch(getEndpoint(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              provider_id: provider.providerId,
              provider_name: provider.providerName,
            }),
          })
        )
      );

      let successCount = 0;
      let failureCount = 0;
      let firstError = "";

      for (const result of results) {
        if (result.status !== "fulfilled") {
          failureCount += 1;
          if (!firstError) firstError = "Network error";
          continue;
        }

        const res = result.value;
        const ct = res.headers.get("content-type") || "";
        const payload = ct.includes("application/json")
          ? await res.json().catch(() => null)
          : await res.text().catch(() => "");

        if (!res.ok) {
          failureCount += 1;
          if (!firstError) {
            firstError =
              (payload && (payload.error || payload.message)) ||
              (typeof payload === "string" ? payload : "") ||
              `Request failed (${res.status})`;
          }
          continue;
        }

        successCount += 1;
      }

      if (successCount > 0 && failureCount === 0) {
        setToast({
          kind: "ok",
          text:
            successCount === 1
              ? "Queued 1 provider."
              : `Queued ${successCount} providers.`,
        });
        return;
      }

      if (successCount > 0 && failureCount > 0) {
        setToast({
          kind: "ok",
          text: `Queued ${successCount} providers. ${failureCount} failed${
            firstError ? `: ${firstError}` : "."
          }`,
        });
        return;
      }

      setToast({
        kind: "error",
        text: firstError || "Failed to queue providers.",
      });
    } catch (e: any) {
      setToast({ kind: "error", text: e?.message || "Network error" });
    } finally {
      setLoading(false);
      window.setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={onClick}
        disabled={loading || actionableProviders.length === 0}
        className="inline-flex items-center rounded-2xl bg-[#8B9D83] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Queuing..."
          : actionableProviders.length > 0
          ? `Handle all (${actionableProviders.length})`
          : "All handled"}
      </button>

      <span className="text-sm font-medium text-slate-600">
        {actionableProviders.length} actionable
      </span>

      {toast ? (
        <div
          className={
            "max-w-sm rounded-xl px-3 py-2 text-xs shadow-sm " +
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