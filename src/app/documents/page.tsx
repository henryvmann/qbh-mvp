"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../../lib/api";
import PageShell from "../../components/qbh/PageShell";
import NextSteps from "../../components/qbh/NextSteps";
import { Upload, FileText, Image as ImageIcon, File, Trash2 } from "lucide-react";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

type DocSummary = {
  date: string;
  provider: string | null;
  summary: string;
};

export default function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [healthHistory, setHealthHistory] = useState("");
  const [summaries, setSummaries] = useState<DocSummary[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchDone, setBatchDone] = useState(0);
  const [batchErrors, setBatchErrors] = useState<string[]>([]);

  function reparseSummaries(history: string) {
    const parts = history.split(/---\s*Document Summary/);
    const parsed: DocSummary[] = [];
    for (let i = 1; i < parts.length; i++) {
      const block = parts[i];
      const dateMatch = block.match(/\((\d{1,2}\/\d{1,2}\/\d{4})/);
      const providerMatch = block.match(/—\s*([^)]+)\)/);
      const summaryText = block.replace(/^\([^)]*\)\s*---\s*/, "").trim();
      parsed.push({
        date: dateMatch?.[1] || "Unknown date",
        provider: providerMatch?.[1]?.trim() || null,
        summary: summaryText,
      });
    }
    setSummaries(parsed);
  }

  useEffect(() => {
    // Load providers for the selector
    apiFetch("/api/dashboard/data")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.snapshots) {
          setProviders(
            data.snapshots
              .filter((s: any) => s.provider.provider_type !== "pharmacy")
              .map((s: any) => ({ id: s.provider.id, name: s.provider.name }))
          );
        }
      })
      .catch(() => {});

    // Load existing health history
    apiFetch("/api/patient-profile")
      .then((r) => r.json())
      .then((data) => {
        const history = data?.profile?.health_history || "";
        setHealthHistory(history);
        if (history) reparseSummaries(history);
      })
      .catch(() => {});
  }, []);

  async function uploadOne(file: File): Promise<{ ok: boolean; error?: string }> {
    const formData = new FormData();
    formData.append("file", file);
    if (selectedProvider) formData.append("provider_name", selectedProvider);

    try {
      const res = await apiFetch("/api/health-docs", { method: "POST", body: formData });
      const data = await res.json();
      if (data.ok && data.summary) return { ok: true };
      return { ok: false, error: data.error || "Failed to process document" };
    } catch {
      return { ok: false, error: "Upload failed" };
    }
  }

  async function handleUpload(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadSuccess(false);
    setBatchTotal(files.length);
    setBatchDone(0);
    setBatchErrors([]);
    const errors: string[] = [];
    // Sequential to avoid rate-limiting OpenAI on multi-file batches.
    for (const f of files) {
      const result = await uploadOne(f);
      if (!result.ok) errors.push(`${f.name}: ${result.error}`);
      setBatchDone((n) => n + 1);
    }
    try {
      const profileRes = await apiFetch("/api/patient-profile");
      const profileData = await profileRes.json();
      if (profileData?.profile?.health_history) {
        setHealthHistory(profileData.profile.health_history);
        reparseSummaries(profileData.profile.health_history);
      }
    } catch {}
    setBatchErrors(errors);
    if (errors.length === 0) {
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }
    setUploading(false);
    setBatchTotal(0);
    setBatchDone(0);
    setSelectedProvider("");
  }

  function getFileIcon(name: string) {
    const lower = name.toLowerCase();
    if (lower.match(/\.(png|jpg|jpeg|gif|webp)$/)) return <ImageIcon size={16} />;
    if (lower.endsWith(".pdf")) return <FileText size={16} />;
    return <File size={16} />;
  }

  return (
    <PageShell maxWidth="max-w-2xl">
        <h1 className="font-serif text-3xl text-[#071832]">Health Documents</h1>
        <p className="mt-2 text-sm text-[#4F5F73]">
          Upload medical records, lab results, visit summaries, and more. Kate will summarize them and add to your health history.
        </p>

        {/* Upload Area */}
        <div className="mt-8 rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-6">
          <h2 className="text-sm font-semibold text-[#071832] mb-4">Upload a Document</h2>

          {/* Provider selector */}
          {providers.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#4F5F73] mb-1">Which provider is this from? (optional)</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full rounded-xl border border-[#E5EAF2] bg-[#F0F2F5] px-4 py-2.5 text-sm text-[#071832] focus:outline-none focus:ring-1 focus:ring-[#1677FF]"
              >
                <option value="">General (no specific provider)</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Drop zone */}
          <div
            onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!uploading) setDragActive(true); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); if (!uploading) setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
              if (uploading) return;
              const dropped = Array.from(e.dataTransfer.files || []);
              if (dropped.length > 0) handleUpload(dropped);
            }}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-[#F8F9FA] p-8 transition ${
              uploading ? "cursor-not-allowed border-[#D0D3D8] opacity-70" : "cursor-pointer hover:border-[#1677FF] hover:bg-[#F0F4F0]"
            } ${dragActive ? "border-[#1677FF] bg-[#EEF4FF]" : "border-[#D0D3D8]"}`}
          >
            <Upload size={28} className="text-[#4F5F73]" />
            <div className="text-sm font-medium text-[#4F5F73]">
              {uploading
                ? batchTotal > 1
                  ? `Processing ${batchDone + 1} of ${batchTotal}…`
                  : "Processing…"
                : "Click or drag files here to upload"}
            </div>
            <div className="text-xs text-[#4F5F73] text-center">
              PDF, Word (.docx), text, images (.png, .jpg) — lab results, visit summaries, medical records.
              <br />
              You can drop or select multiple at once.
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) handleUpload(files);
              e.target.value = "";
            }}
          />

          {uploadSuccess && (
            <div className="mt-3 rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800">
              {batchTotal > 1 ? `${batchTotal} documents uploaded and summarized!` : "Document uploaded and summarized!"}
            </div>
          )}

          {batchErrors.length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-900">
              <div className="font-semibold mb-1">Some uploads didn&rsquo;t go through:</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {batchErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Document Summaries */}
        <div className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#4F5F73] mb-4">
            {summaries.length > 0 ? `${summaries.length} Document${summaries.length === 1 ? "" : "s"} on File` : "No Documents Yet"}
          </h2>

          {summaries.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-8 text-center">
              <FileText size={32} className="mx-auto text-[#D0D3D8]" />
              <div className="mt-3 text-sm font-medium text-[#4F5F73]">No documents uploaded yet</div>
              <div className="mt-1 text-xs text-[#4F5F73]">
                Upload lab results, visit summaries, or medical records above. Kate will read and summarize them.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {summaries.map((doc, i) => (
                <div key={i} className="rounded-2xl bg-white border border-[#E5EAF2] shadow-sm p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-[#1677FF]" />
                      <span className="text-xs font-semibold text-[#071832]">
                        {doc.provider || "General Document"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#4F5F73]">{doc.date}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Remove this document summary?")) return;
                          await apiFetch("/api/health-docs", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ index: i }),
                          });
                          const profileRes = await apiFetch("/api/patient-profile");
                          const profileData = await profileRes.json();
                          if (profileData?.profile?.health_history !== undefined) {
                            setHealthHistory(profileData.profile.health_history || "");
                            reparseSummaries(profileData.profile.health_history || "");
                          } else {
                            setSummaries((prev) => prev.filter((_, idx) => idx !== i));
                          }
                        }}
                        className="text-[10px] text-[#9CA3AF] hover:text-red-500"
                        aria-label="Remove document"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-[#3A3F4B] leading-relaxed whitespace-pre-line">
                    {doc.summary}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10">
          <NextSteps />
        </div>
    </PageShell>
  );
}
