"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { apiFetch } from "../../lib/api";

type DashboardData = {
  snapshots: Array<{
    provider: { id: string; name: string; provider_type?: string | null; specialty?: string | null };
    followUpNeeded: boolean;
    futureConfirmedEvent?: { start_at: string } | null;
    visitCount?: number;
    lastVisitDate?: string | null;
  }>;
  hasGoogleCalendarConnection: boolean;
};

function generateInsight(pathname: string, data: DashboardData): string | null {
  const providers = data.snapshots || [];
  const doctors = providers.filter((s) => s.provider.provider_type !== "pharmacy");
  const pharmacies = providers.filter((s) => s.provider.provider_type === "pharmacy");
  const overdue = doctors.filter((s) => s.followUpNeeded && !s.futureConfirmedEvent);
  const upcoming = doctors.filter((s) => s.futureConfirmedEvent);
  const providerText = doctors.map((s) => `${s.provider.name} ${s.provider.specialty || ""}`.toLowerCase()).join(" ");

  const hasPCP = /primary|pcp|internal|family|general/.test(providerText);
  const hasDentist = /dent|dds/.test(providerText);
  const hasEye = /eye|vision|optom/.test(providerText);

  switch (pathname) {
    case "/providers": {
      if (doctors.length === 0) return "Start building your care team — add your primary care doctor, dentist, or any specialist you see.";
      if (overdue.length > 0) return `${overdue[0].provider.name} may be overdue for a visit. Want Kate to book it?`;
      if (!hasPCP) return "You don't have a primary care doctor on file yet — they're the foundation of your care team.";
      if (!hasDentist) return "No dentist on file. Adding one helps Kate keep track of all your care.";
      if (!hasEye) return "Consider adding your eye doctor to get a complete picture of your care team.";
      return `You have ${doctors.length} provider${doctors.length !== 1 ? "s" : ""} on file. Looking good!`;
    }
    case "/visits": {
      if (upcoming.length > 0) {
        const next = upcoming[0];
        const date = new Date(next.futureConfirmedEvent!.start_at);
        const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days <= 7) return `Your appointment with ${next.provider.name} is in ${days} day${days !== 1 ? "s" : ""}. Want help preparing?`;
        return `Next up: ${next.provider.name} on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`;
      }
      if (overdue.length > 0) return `${overdue.length} provider${overdue.length !== 1 ? "s" : ""} may be overdue. Check your providers page to schedule.`;
      if (doctors.length === 0) return "No visits yet. Add providers and Kate will help you stay on top of appointments.";
      return null;
    }
    case "/timeline": {
      if (doctors.length === 0) return "Your health timeline will build as you add providers and track visits.";
      if (overdue.length > 0) return `It's been a while since you've seen ${overdue[0].provider.name}. Your timeline will grow as you book visits.`;
      return `Your timeline tracks ${doctors.length} provider${doctors.length !== 1 ? "s" : ""}. Each visit adds to your health story.`;
    }
    case "/goals": {
      if (doctors.length === 0) return "Set a goal to get started — like adding your first provider or booking a checkup.";
      if (!hasPCP) return "A great first goal: find a primary care doctor for your care team.";
      return "Tell Kate what you want to work on and she'll help you make a plan.";
    }
    case "/settings": {
      return "Keep your profile up to date so Kate can give you the best recommendations.";
    }
    case "/calendar-view": {
      if (!data.hasGoogleCalendarConnection) return "Connect your calendar so Kate can check for conflicts before booking.";
      return "Your calendar is connected. Kate will check your availability before scheduling.";
    }
    default:
      return null;
  }
}

export default function KatePageInsight() {
  const pathname = usePathname();
  const [insight, setInsight] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (pathname === "/dashboard") return;

    // Set a fallback immediately while data loads
    const fallbacks: Record<string, string> = {
      "/providers": "Manage your care team and keep your providers up to date.",
      "/visits": "Track your appointments and stay on top of your care.",
      "/timeline": "Your health story — past visits, upcoming appointments, and connections.",
      "/goals": "Set goals and let Kate help you track your progress.",
      "/settings": "Keep your profile up to date for the best experience.",
      "/calendar-view": "Your health calendar — see what's coming up.",
    };
    setInsight(fallbacks[pathname] || null);

    apiFetch("/api/dashboard/data")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          const text = generateInsight(pathname, data);
          if (text) setInsight(text);
        }
      })
      .catch(() => {});
  }, [pathname]);

  if (!insight || dismissed) return null;

  return (
    <div className="mt-6 mb-2 rounded-2xl bg-[#5C6B5C]/5 border border-[#5C6B5C]/10 px-5 py-4">
      <div className="flex items-start gap-3">
        <Image
          src="/kate-avatar.png"
          alt="Kate"
          width={28}
          height={28}
          className="rounded-full shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#1A1D2E] leading-relaxed">{insight}</p>
          {insight.includes("overdue") && (
            <a href="/providers" className="mt-2 inline-block text-xs font-semibold text-[#5C6B5C] underline underline-offset-2">
              View providers &rarr;
            </a>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-[#B0B4BC] hover:text-[#7A7F8A]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
