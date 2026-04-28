"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../../lib/api";
import TopNav from "../../components/qbh/TopNav";

type CardData = {
  name: string;
  score: number;
  providerCount: number;
  overdueCount: number;
  upcomingCount: number;
  levelLabel: string;
};

export default function HealthCardPage() {
  const [data, setData] = useState<CardData | null>(null);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/health-score").then((r) => r.json()),
      apiFetch("/api/dashboard/data").then((r) => r.json()),
      apiFetch("/api/patient-profile").then((r) => r.json()),
    ]).then(([scoreData, dashData, profileData]) => {
      if (!scoreData?.ok || !dashData?.ok) return;
      const profile = profileData?.profile || {};
      const snapshots = dashData.snapshots || [];
      const nonPharmacy = snapshots.filter((s: any) => s.provider?.provider_type !== "pharmacy");

      setData({
        name: profile.display_name || profile.full_name?.split(" ")[0] || dashData.userName || "You",
        score: scoreData.score,
        providerCount: nonPharmacy.length,
        overdueCount: nonPharmacy.filter((s: any) => s.followUpNeeded && s.booking_state?.status !== "BOOKED").length,
        upcomingCount: nonPharmacy.filter((s: any) => s.booking_state?.status === "BOOKED").length,
        levelLabel: scoreData.levelLabel,
      });
    }).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F4F5F7]">
        <TopNav />
        <div className="flex items-center justify-center pt-32 text-[#7A7F8A]">Loading...</div>
      </div>
    );
  }

  const circumference = 2 * Math.PI * 42;
  const progress = (data.score / 100) * circumference;

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <TopNav />
      <div className="mx-auto max-w-md px-6 pt-24 pb-16">
        <h1 className="text-xl font-semibold text-[#1A1D2E] text-center">Your Health Card</h1>
        <p className="mt-1 text-sm text-[#7A7F8A] text-center">Share your health coordination progress</p>

        {/* The card */}
        <div ref={cardRef} className="mt-8 rounded-3xl overflow-hidden shadow-xl" style={{ background: "linear-gradient(135deg, #0F1729, #1A2940)" }}>
          <div className="p-8">
            {/* Name */}
            <div className="text-lg font-light text-white/90">{data.name}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mt-1">Health Coordination</div>

            {/* Score ring */}
            <div className="mt-6 flex items-center gap-6">
              <div className="relative" style={{ width: 96, height: 96 }}>
                <svg width={96} height={96} viewBox="0 0 96 96" className="transform -rotate-90">
                  <circle cx={48} cy={48} r={42} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
                  <defs>
                    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0FA5A5" />
                      <stop offset="100%" stopColor="#D4A44C" />
                    </linearGradient>
                  </defs>
                  <circle cx={48} cy={48} r={42} fill="none" stroke="url(#cardGrad)" strokeWidth={5} strokeLinecap="round"
                    strokeDasharray={`${progress} ${circumference - progress}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-light text-white">{data.score}</span>
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Providers</span>
                  <span className="text-sm font-light text-[#0FA5A5]">{data.providerCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Upcoming</span>
                  <span className="text-sm font-light text-[#D4A44C]">{data.upcomingCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Overdue</span>
                  <span className="text-sm font-light" style={{ color: data.overdueCount > 0 ? "#F87171" : "#22C55E" }}>{data.overdueCount}</span>
                </div>
              </div>
            </div>

            {/* Level */}
            <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
              {data.levelLabel}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-white/30">Healthcare Changed for Good</span>
              <span className="text-[10px] font-semibold text-white/50">getquarterback.com</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: "My Health Coordination Score",
                  text: `My Health Coordination Score is ${data.score}! I'm using Quarterback Health to stay on top of my healthcare. Healthcare Changed for Good.`,
                  url: "https://getquarterback.com",
                }).catch(() => {});
              } else {
                navigator.clipboard.writeText(
                  `My Health Coordination Score is ${data.score}! I'm using Quarterback Health to stay on top of my healthcare. getquarterback.com`
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: "#5C6B5C" }}
          >
            {copied ? "Copied!" : "Share"}
          </button>
          <a
            href="/dashboard"
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-center border border-[#EBEDF0] text-[#1A1D2E] hover:bg-white"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
