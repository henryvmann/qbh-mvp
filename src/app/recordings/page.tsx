"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import TopNav from "../../components/qbh/TopNav";
import NextSteps from "../../components/qbh/NextSteps";
import { Upload, Mic, FileAudio, Clock } from "lucide-react";

type Recording = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function RecordingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [consentDismissed, setConsentDismissed] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("qbh_recording_consent_dismissed") === "true";
    return false;
  });
  const [consentExpanded, setConsentExpanded] = useState(false);

  useEffect(() => {
    apiFetch("/api/dashboard/data")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          const provs = (data.snapshots || [])
            .filter((s: any) => s.provider.provider_type !== "pharmacy")
            .map((s: any) => ({ id: s.provider.id, name: s.provider.name }));
          setProviders(provs);
        }
      })
      .catch(() => {});

    apiFetch("/api/recordings")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.ok) {
          setRecordings(data.recordings ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("title", selectedProvider ? `Recording — ${selectedProvider}` : file.name.replace(/\.[^/.]+$/, "") || "Visit Recording");
      if (selectedProvider) formData.append("provider_name", selectedProvider);

      const res = await apiFetch("/api/recordings", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data?.ok) {
        setUploadSuccess(true);
        // Refresh recordings list
        const refreshRes = await apiFetch("/api/recordings");
        const refreshData = await refreshRes.json();
        if (refreshData?.ok) {
          setRecordings(refreshData.recordings ?? []);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
      }
    } catch {
      // silently fail
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <TopNav />
      <div className="mx-auto max-w-3xl px-6 pt-10 pb-16">
        <h1 className="font-serif text-3xl tracking-tight text-[#1A1D2E]">
          Visit Recordings
        </h1>
        <p className="mt-2 max-w-2xl text-base text-[#7A7F8A]">
          Record your doctor visits so you never forget what was discussed.
        </p>

        {/* How it works */}
        <div className="mt-6 rounded-2xl bg-[#F0F2F5] border border-[#EBEDF0] p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-[#5C6B5C] mb-3">How It Works</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <Mic size={20} className="mx-auto text-[#5C6B5C]" />
              <div className="mt-2 text-sm font-medium text-[#1A1D2E]">Record</div>
              <div className="text-xs text-[#7A7F8A]">Use your phone&apos;s voice memo during a visit or telehealth call</div>
            </div>
            <div>
              <Upload size={20} className="mx-auto text-[#5C6B5C]" />
              <div className="mt-2 text-sm font-medium text-[#1A1D2E]">Upload</div>
              <div className="text-xs text-[#7A7F8A]">Drop the audio file here — MP3, M4A, or WAV</div>
            </div>
            <div>
              <FileAudio size={20} className="mx-auto text-[#5C6B5C]" />
              <div className="mt-2 text-sm font-medium text-[#1A1D2E]">Review</div>
              <div className="text-xs text-[#7A7F8A]">Kate transcribes and summarizes the key points for you</div>
            </div>
          </div>
        </div>

        {/* Recording consent notice — full version */}
        {!consentDismissed && (
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 relative">
            <button
              onClick={() => {
                setConsentDismissed(true);
                localStorage.setItem("qbh_recording_consent_dismissed", "true");
              }}
              className="absolute top-3 right-3 text-amber-400 hover:text-amber-600 transition"
            >
              ✕
            </button>
            <div className="text-xs font-semibold text-amber-700 mb-1">Before You Record</div>
            <p className="text-xs text-amber-700 leading-relaxed pr-6">
              Recording laws vary by state. Some states require all parties to consent before recording a conversation (two-party consent states include CA, CT, FL, IL, MA, MD, MI, MT, NH, OR, PA, WA). In one-party consent states, only you need to know. We recommend letting your provider know you&apos;d like to record for your own notes — most are happy to allow it. Recordings are stored securely and only accessible to you.
            </p>
          </div>
        )}

        {/* Upload area */}
        <div className="mt-8 rounded-2xl bg-white shadow-sm border border-[#EBEDF0] p-8">
          {/* Provider selector */}
          {providers.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#7A7F8A] mb-1.5">Which provider is this recording from?</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full rounded-xl border border-[#EBEDF0] bg-[#F0F2F5] px-4 py-2.5 text-sm text-[#1A1D2E] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
              >
                <option value="">Select a provider (optional)</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div
            className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D0D3D8] bg-[#F0F2F5] p-10 transition hover:border-[#5C6B5C] hover:bg-[#5C6B5C]/5 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.m4a,.wav,.webm,audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            {uploading ? (
              <>
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#5C6B5C] border-t-transparent" />
                <p className="mt-3 text-sm font-medium text-[#1A1D2E]">Processing...</p>
                <p className="mt-1 text-xs text-[#7A7F8A]">Uploading your recording</p>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#5C6B5C]/15">
                  <Upload size={20} className="text-[#5C6B5C]" />
                </div>
                <p className="mt-3 text-sm font-medium text-[#1A1D2E]">
                  Click to upload a recording
                </p>
                <p className="mt-1 text-xs text-[#7A7F8A]">
                  Accepts MP3, M4A, WAV, and WebM files
                </p>
              </>
            )}
          </div>

          {uploadSuccess && (
            <div className="mt-4 rounded-xl bg-[#5C6B5C]/10 border border-[#5C6B5C]/30 px-4 py-3 text-sm text-[#5C6B5C] font-medium">
              Recording uploaded — Kate will analyze this shortly.
            </div>
          )}
        </div>

        {/* Recordings list */}
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7A7F8A] mb-3">
            Your recordings
          </h2>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[#7A7F8A]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5C6B5C] border-t-transparent" />
              Loading...
            </div>
          ) : recordings.length === 0 ? (
            <div className="rounded-2xl bg-white shadow-sm border border-[#EBEDF0] p-8 text-center">
              <Mic size={32} className="mx-auto text-[#B0B4BC]" />
              <p className="mt-3 text-sm text-[#7A7F8A]">
                No recordings yet. Upload a recording and Kate will summarize it, helping you stay prepared for future appointments.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-xl bg-white shadow-sm border border-[#EBEDF0] px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5C6B5C]/15 mt-0.5">
                      <FileAudio size={16} className="text-[#5C6B5C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1A1D2E]">{rec.title}</div>
                      <p className="mt-1 text-sm text-[#7A7F8A]">{rec.body}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-[#B0B4BC]">
                        <Clock size={11} />
                        {formatDate(rec.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {/* Minimized consent notice — shown after dismissed */}
        {consentDismissed && (
          consentExpanded ? (
            <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 relative">
              <button
                onClick={() => setConsentExpanded(false)}
                className="absolute top-3 right-3 text-amber-400 hover:text-amber-600 transition"
              >
                ✕
              </button>
              <div className="text-xs font-semibold text-amber-700 mb-1">Recording Consent Info</div>
              <p className="text-xs text-amber-700 leading-relaxed pr-6">
                Recording laws vary by state. Two-party consent states: CA, CT, FL, IL, MA, MD, MI, MT, NH, OR, PA, WA. We recommend letting your provider know. Recordings are stored securely and only accessible to you.
              </p>
            </div>
          ) : (
            <button
              onClick={() => setConsentExpanded(true)}
              className="mt-6 w-full text-center text-xs text-[#B0B4BC] hover:text-[#7A7F8A] underline underline-offset-2 transition"
            >
              Recording consent info
            </button>
          )
        )}

        <NextSteps />
      </div>
    </main>
  );
}
