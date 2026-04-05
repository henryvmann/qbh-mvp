"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  tag: string;
  eventType: "visit" | "booked" | "discovered";
};

const tagConfig: Record<
  TimelineEvent["eventType"],
  { bg: string; text: string; ring: string; dot: string }
> = {
  visit: {
    bg: "bg-sky-500/15",
    text: "text-sky-400",
    ring: "ring-sky-500/30",
    dot: "#0ea5e9",
  },
  booked: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    ring: "ring-emerald-500/30",
    dot: "#10b981",
  },
  discovered: {
    bg: "bg-[#7BA59A]/15",
    text: "text-[#7BA59A]",
    ring: "ring-[#7BA59A]/30",
    dot: "#7BA59A",
  },
};

function formatEventDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function TimelinePage() {
  const router = useRouter();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <main className="min-h-screen bg-[#1E2228]" />;
  }

  return (
    <main className="min-h-screen bg-[#1E2228] text-[#F0F2F5]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-[#F0F2F5]">
              Health Timeline
            </h1>
            <p className="mt-2 max-w-2xl text-base text-[#8A9BAE]">
              A chronological record of visits, bookings, and provider
              discoveries. QBH builds this from your real data so you never lose
              track of your care history.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/8 bg-white/5 px-4 py-2 text-sm font-medium text-[#8A9BAE] shadow-sm hover:bg-[#162030]"
          >
            Back to Dashboard
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-white/5 p-6 ring-1 ring-[rgba(255,255,255,0.08)]">
            <div className="font-semibold text-[#F0F2F5]">No events yet</div>
            <p className="mt-2 text-sm text-[#8A9BAE]">
              Connect your bank account to start building your health timeline.
            </p>
          </div>
        ) : (
          <div className="relative mt-10">
            {/* Vertical timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-white/8" />

            <div className="space-y-6">
              {events.map((event) => {
                const cfg = tagConfig[event.eventType] ?? tagConfig.discovered;
                return (
                  <div key={event.id} className="relative pl-12">
                    {/* Timeline dot */}
                    <div
                      className="absolute left-2.5 top-6 h-3 w-3 rounded-full ring-2 ring-[#1E2228]"
                      style={{ backgroundColor: cfg.dot }}
                    />

                    <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-[rgba(255,255,255,0.08)]">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-[#4D6480]">
                          {formatEventDate(event.date)}
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
                        >
                          {event.tag}
                        </span>
                      </div>

                      <div className="mt-2 font-serif text-lg text-[#F0F2F5]">
                        {event.title}
                      </div>

                      <p className="mt-2 text-sm text-[#8A9BAE]">
                        {event.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
