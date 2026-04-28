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
        // Parse summaries from health history
        if (history) {
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
      })
      .catch(() => {});
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadSuccess(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedProvider) formData.append("provider_name", selectedProvider);

      const res = await apiFetch("/api/health-docs", { method: "POST", body: formData });
      const data = await res.json();

      if (data.ok && data.summary) {
        setUploadSuccess(true);
        // Refresh summaries
        const profileRes = await apiFetch("/api/patient-profile");
        const profileData = await profileRes.json();
        if (profileData?.profile?.health_history) {
          setHealthHistory(profileData.profile.health_history);
          // Re-parse
          const history = profileData.profile.health_history;
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
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        alert(data.error || "Failed to process document");
      }
    } catch {
      alert("Upload failed — please try again");
    } finally {
      setUploading(false);
      setSelectedProvider("");
    }
  }

  function getFileIcon(name: string) {
    const lower = name.toLowerCase();
    if (lower.match(/\.(png|jpg|jpeg|gif|webp)$/)) return <ImageIcon size={16} />;
    if (lower.endsWith(".pdf")) return <FileText size={16} />;
    return <File size={16} />;
  }

  return (
    <PageShell maxWidth="max-w-2xl">
        <h1 className="font-serif text-3xl text-[#1A1D2E]">Health Documents</h1>
        <p className="mt-2 text-sm text-[#7A7F8A]">
          Upload medical records, lab results, visit summaries, and more. Kate will summarize them and add to your health history.
        </p>

        {/* Upload Area */}
        <div className="mt-8 rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-6">
          <h2 className="text-sm font-semibold text-[#1A1D2E] mb-4">Upload a Document</h2>

          {/* Provider selector */}
          {providers.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#7A7F8A] mb-1">Which provider is this from? (optional)</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-4 py-2.5 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
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
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#D0D3D8] bg-[#F8F9FA] p-8 cursor-pointer transition hover:border-[#5C6B5C] hover:bg-[#F0F4F0]"
          >
            <Upload size={28} className="text-[#B0B4BC]" />
            <div className="text-sm font-medium text-[#7A7F8A]">
              {uploading ? "Processing..." : "Click to upload"}
            </div>
            <div className="text-xs text-[#B0B4BC]">
              PDF, text, images (.png, .jpg) — lab results, visit summaries, medical records
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />

          {uploadSuccess && (
            <div className="mt-3 rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800">
              Document uploaded and summarized!
            </div>
          )}
        </div>

        {/* Document Summaries */}
        <div className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC] mb-4">
            {summaries.length > 0 ? `${summaries.length} Document${summaries.length === 1 ? "" : "s"} on File` : "No Documents Yet"}
          </h2>

          {summaries.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-8 text-center">
              <FileText size={32} className="mx-auto text-[#D0D3D8]" />
              <div className="mt-3 text-sm font-medium text-[#7A7F8A]">No documents uploaded yet</div>
              <div className="mt-1 text-xs text-[#B0B4BC]">
                Upload lab results, visit summaries, or medical records above. Kate will read and summarize them.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {summaries.map((doc, i) => (
                <div key={i} className="rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-[#5C6B5C]" />
                      <span className="text-xs font-semibold text-[#1A1D2E]">
                        {doc.provider || "General Document"}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#B0B4BC]">{doc.date}</span>
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
