"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import TopNav from "../../components/qbh/TopNav";
import ProviderLink from "../../components/qbh/ProviderLink";
import NextSteps from "../../components/qbh/NextSteps";
import { Sparkles, Lightbulb, Target, Star as StarIcon, Trophy, Calendar } from "lucide-react";

type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  tag: string;
  eventType: "visit" | "booked" | "discovered" | "upcoming";
  providerId?: string;
};

const tagConfig: Record<
  TimelineEvent["eventType"],
  { bg: string; text: string; dot: string; label: string }
> = {
  visit: { bg: "bg-[#B0D0E8]/30", text: "text-[#2A6090]", dot: "#2A6090", label: "Past Visit" },
  booked: { bg: "bg-[#C2D9B8]/30", text: "text-[#3D5A3D]", dot: "#5C6B5C", label: "Booked" },
  upcoming: { bg: "bg-emerald-500/10", text: "text-emerald-600", dot: "#059669", label: "Upcoming" },
  discovered: { bg: "bg-[#C8B8E0]/30", text: "text-[#5C4A8A]", dot: "#5C4A8A", label: "Added" },
};

function formatEventDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  return "";
}

export default function TimelinePage() {
  const router = useRouter();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [insightText, setInsightText] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    apiFetch("/api/timeline/data")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) setEvents(json.events ?? []);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const getInsight = useCallback(async (event: TimelineEvent) => {
    if (insightLoading) return;
    setInsightLoading(true);
    setInsightText(null);
    setExpandedId(event.id);

    try {
      const res = await apiFetch("/api/kate/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Give me a brief insight about this health event: "${event.title}" on ${event.date}. ${event.detail}. How does this fit into my health story? Keep it to 2-3 sentences.`,
          }],
        }),
      });

      if (!res.ok || !res.body) {
        setInsightText("Couldn't generate insight right now.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setInsightText(text);
      }
    } catch {
      setInsightText("Couldn't generate insight right now.");
    } finally {
      setInsightLoading(false);
    }
  }, [insightLoading]);

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
        <TopNav />
      </main>
    );
  }

  const now = new Date();
  const futureEvents = events.filter((e) => new Date(e.date) >= now);
  const pastEvents = events.filter((e) => new Date(e.date) < now);

  const filtered = filter === "all" ? events
    : filter === "future" ? futureEvents
    : filter === "past" ? pastEvents
    : events.filter((e) => e.eventType === filter);

  // Milestones
  const milestones: Array<{ icon: React.ComponentType<any>; text: string }> = [];
  if (events.length >= 1) milestones.push({ icon: Target, text: "First event tracked" });
  if (events.length >= 5) milestones.push({ icon: StarIcon, text: "5 events in your timeline" });
  if (events.length >= 10) milestones.push({ icon: Trophy, text: "10+ health events tracked" });
  if (futureEvents.length > 0) milestones.push({ icon: Calendar, text: `${futureEvents.length} upcoming` });

  return (
    <main className="min-h-screen text-[#1A1D2E]" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
      <TopNav />
      <div className="mx-auto max-w-3xl px-6 pt-8 pb-16">
        <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E]">
          Health Timeline
        </h1>
        <p className="mt-1 text-sm text-[#7A7F8A]">
          Your care story — past, present, and future
        </p>

        {/* Milestones strip */}
        {milestones.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {milestones.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#EBEDF0] px-3 py-1 text-xs font-medium text-[#1A1D2E] shadow-sm">
                <m.icon size={14} strokeWidth={1.5} color="#5C6B5C" /> {m.text}
              </span>
            ))}
          </div>
        )}

        {/* Filter pills */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { value: "all", label: "All" },
            { value: "future", label: "Upcoming" },
            { value: "past", label: "Past" },
            { value: "visit", label: "Visits" },
            { value: "upcoming", label: "Upcoming" },
            { value: "booked", label: "Booked" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filter === f.value
                  ? "bg-[#5C6B5C] text-white"
                  : "bg-white border border-[#EBEDF0] text-[#7A7F8A] hover:bg-[#F0F2F5]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {events.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
            <div className="font-semibold text-[#1A1D2E]">No events yet</div>
            <p className="mt-2 text-sm text-[#7A7F8A]">
              As you connect your accounts and Kate books appointments, your health story will build here.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {(() => {
              // Group events by year
              const byYear = new Map<string, typeof filtered>();
              const futureGroup: typeof filtered = [];
              for (const event of filtered) {
                if (new Date(event.date) >= now) {
                  futureGroup.push(event);
                } else {
                  const year = new Date(event.date).getFullYear().toString();
                  if (!byYear.has(year)) byYear.set(year, []);
                  byYear.get(year)!.push(event);
                }
              }

              const yearSections: Array<{ label: string; events: typeof filtered }> = [];
              if (futureGroup.length > 0) yearSections.push({ label: "Upcoming", events: futureGroup });
              for (const [year, yearEvents] of byYear) {
                yearSections.push({ label: year, events: yearEvents });
              }

              return yearSections.map((section) => (
                <div key={section.label}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-bold text-[#5C6B5C]">{section.label}</span>
                    <span className="text-xs text-[#B0B4BC]">{section.events.length} event{section.events.length !== 1 ? "s" : ""}</span>
                    <div className="flex-1 h-px bg-[#EBEDF0]" />
                  </div>
                  <div className="space-y-3">
                    {section.events.map((event) => {
                      const cfg = tagConfig[event.eventType] ?? tagConfig.discovered;
                      const isFuture = new Date(event.date) >= now;
                      const relative = getRelativeDate(event.date);
                      const isExpanded = expandedId === event.id;

                      return (
                        <div key={event.id}>

                    <div
                      className={`rounded-2xl bg-white shadow-sm border transition cursor-pointer hover:shadow-md ${
                        isFuture ? "border-[#5C6B5C]/20" : "border-[#EBEDF0]"
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#B0B4BC]">
                              {formatEventDate(event.date)}
                            </span>
                            {relative && (
                              <span className="text-xs font-medium text-[#5C6B5C]">
                                {relative}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                getInsight(event);
                              }}
                              className="rounded-md p-1 text-[#B0B4BC] hover:text-[#5C6B5C] hover:bg-[#5C6B5C]/10 transition"
                              title="Get Kate's insight"
                            >
                              <Sparkles size={16} strokeWidth={1.5} />
                            </button>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
                              {cfg.label}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 text-sm font-semibold text-[#1A1D2E]">
                          {event.providerId ? (
                            <ProviderLink providerId={event.providerId} providerName={event.title} />
                          ) : event.title}
                        </div>

                        <p className="mt-1 text-xs text-[#7A7F8A]">
                          {event.detail}
                        </p>
                      </div>

                      {/* Expanded insight */}
                      {isExpanded && insightText && (
                        <div className="border-t border-[#EBEDF0] px-5 py-4 bg-[#F0F2F5]/50 rounded-b-2xl">
                          <div className="flex items-start gap-2">
                            <Lightbulb size={16} strokeWidth={1.5} color="#5C6B5C" className="shrink-0" />
                            <div className="text-xs text-[#7A7F8A] leading-relaxed">
                              {insightLoading && !insightText ? (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#5C6B5C] border-t-transparent" />
                              ) : (
                                insightText
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
        <NextSteps />
      </div>
    </main>
  );
}
