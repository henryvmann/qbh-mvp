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

type Insight = { text: string; bookProviderId?: string };

function generateInsight(pathname: string, data: DashboardData, introducedIds: Set<string>): Insight | null {
  const providers = data.snapshots || [];
  const doctors = providers.filter((s) => s.provider.provider_type !== "pharmacy");
  const pharmacies = providers.filter((s) => s.provider.provider_type === "pharmacy");
  // Overdue surfaces should never fire on a provider the user hasn't
  // even been introduced to yet — the walkthrough is the one nudge a
  // newly-added provider gets. Without this gate, brand-new accounts
  // see "X is overdue" the moment they land on /providers.
  //
  // Recency check: followUpNeeded fires from a stale booking_state, not
  // actual visit recency. So we additionally require either no last
  // visit on file OR a last visit at least 3 months ago before we'll
  // say "it's been a while" — otherwise Jenny sees "you haven't seen
  // Carolyn Andrew in a while" 9 days after her last appointment.
  const RECENCY_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;
  const overdue = doctors.filter((s) => {
    if (!s.followUpNeeded || s.futureConfirmedEvent || !introducedIds.has(s.provider.id)) return false;
    if (!s.lastVisitDate) return true;
    const elapsed = Date.now() - new Date(s.lastVisitDate).getTime();
    return elapsed >= RECENCY_THRESHOLD_MS;
  });
  const upcoming = doctors.filter((s) => s.futureConfirmedEvent);
  const providerText = doctors.map((s) => `${s.provider.name} ${s.provider.specialty || ""}`.toLowerCase()).join(" ");

  const hasPCP = /primary|pcp|internal|family|general/.test(providerText);
  const hasDentist = /dent|dds/.test(providerText);
  const hasEye = /eye|vision|optom/.test(providerText);

  switch (pathname) {
    case "/providers": {
      if (doctors.length === 0) return { text: "Start building your care team — add your primary care doctor, dentist, or any specialist you see." };
      if (overdue.length > 0) return {
        text: `${overdue[0].provider.name} may be due for a visit. Want Kate to book it?`,
        bookProviderId: overdue[0].provider.id,
      };
      if (!hasPCP) return { text: "You don't have a primary care doctor on file yet — they're the foundation of your care team." };
      if (!hasDentist) return { text: "No dentist on file. Adding one helps Kate keep track of all your care." };
      if (!hasEye) return { text: "Consider adding your eye doctor to get a complete picture of your care team." };
      return { text: `You have ${doctors.length} provider${doctors.length !== 1 ? "s" : ""} on file. Looking good!` };
    }
    case "/visits": {
      if (upcoming.length > 0) {
        const next = upcoming[0];
        const date = new Date(next.futureConfirmedEvent!.start_at);
        const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days <= 7) return { text: `Your appointment with ${next.provider.name} is in ${days} day${days !== 1 ? "s" : ""}. Want help preparing?` };
        return { text: `Next up: ${next.provider.name} on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` };
      }
      if (overdue.length > 0) return {
        text: `${overdue.length} provider${overdue.length !== 1 ? "s" : ""} may be due for a visit. You can schedule them right here.`,
        bookProviderId: overdue[0].provider.id,
      };
      if (doctors.length === 0) return { text: "No visits yet. Add providers and Kate will help you stay on top of appointments." };
      return null;
    }
    case "/timeline": {
      if (doctors.length === 0) return { text: "Your health timeline will build as you add providers and track visits." };
      if (overdue.length > 0) return {
        text: `It's been a while since you've seen ${overdue[0].provider.name}. Your timeline will grow as you book visits.`,
        bookProviderId: overdue[0].provider.id,
      };
      return { text: `Your timeline tracks ${doctors.length} provider${doctors.length !== 1 ? "s" : ""}. Each visit adds to your health story.` };
    }
    case "/goals": {
      if (doctors.length === 0) return { text: "Set a goal to get started — like adding your first provider or booking a checkup." };
      if (!hasPCP) return { text: "A great first goal: find a primary care doctor for your care team." };
      return { text: "Tell Kate what you want to work on and she'll help you make a plan." };
    }
    case "/account": {
      return { text: "Keep your profile up to date so Kate can give you the best recommendations." };
    }
    case "/calendar-view": {
      if (!data.hasGoogleCalendarConnection) return { text: "Connect your calendar so Kate can check for conflicts before booking." };
      return { text: "Your calendar is connected. Kate will check your availability before scheduling." };
    }
    default:
      return null;
  }
}

export default function KatePageInsight() {
  const pathname = usePathname();
  const [insight, setInsight] = useState<Insight | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (pathname === "/dashboard") return;

    // Set a fallback immediately while data loads
    const fallbacks: Record<string, string> = {
      "/providers": "Manage your care team and keep your providers up to date.",
      "/visits": "Track your appointments and stay on top of your care.",
      "/timeline": "Your health story — past visits, upcoming appointments, and connections.",
      "/goals": "Set goals and let Kate help you track your progress.",
      "/account": "Keep your profile up to date for the best experience.",
      "/calendar-view": "Your health calendar — see what's coming up.",
    };
    const fallback = fallbacks[pathname];
    setInsight(fallback ? { text: fallback } : null);

    Promise.all([
      apiFetch("/api/dashboard/data").then((r) => r.json()).catch(() => null),
      apiFetch("/api/patient-profile").then((r) => r.json()).catch(() => null),
    ]).then(([data, profile]) => {
      if (!data?.ok) return;
      const ids = profile?.profile?.introduced_provider_ids;
      const introducedIds = new Set(
        Array.isArray(ids) ? ids.filter((x: unknown): x is string => typeof x === "string") : []
      );
      const generated = generateInsight(pathname, data, introducedIds);
      if (generated) setInsight(generated);
    });
  }, [pathname]);

  if (!insight || dismissed) return null;

  return (
    <div className="mt-6 mb-2 rounded-2xl bg-[#1677FF]/5 border border-[#1677FF]/10 px-5 py-4">
      <div className="flex items-start gap-3">
        <Image
          src="/kate-avatar.png"
          alt="Kate"
          width={28}
          height={28}
          className="rounded-full shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#071832] leading-relaxed">{insight.text}</p>
          {insight.bookProviderId ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={`/providers/${insight.bookProviderId}?action=book`}
                className="text-xs font-semibold text-white bg-[#1677FF] rounded-lg px-3 py-1.5 hover:brightness-95"
              >
                Book it
              </a>
              <a href="/providers" className="text-xs font-semibold text-[#1677FF] underline underline-offset-2">
                View providers &rarr;
              </a>
            </div>
          ) : (
            insight.text.includes("may be due for a visit") && (
              <a href="/providers" className="mt-2 inline-block text-xs font-semibold text-[#1677FF] underline underline-offset-2">
                View providers &rarr;
              </a>
            )
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-[#4F5F73] hover:text-[#4F5F73]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
