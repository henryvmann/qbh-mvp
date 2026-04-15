"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import TopNav from "../../components/qbh/TopNav";
import { apiFetch } from "../../lib/api";

/* ── Types ── */

type UpcomingVisit = {
  eventId: string;
  providerName: string;
  startAt: string | null;
  endAt: string | null;
  timezone: string | null;
};

type PastVisit = {
  id: string;
  providerName: string;
  visitDate: string | null;
  amount: number | null;
};

type FollowUp = {
  providerId: string;
  providerName: string;
};

type DayEvent = {
  type: "upcoming" | "past" | "followup";
  label: string;
  detail: string;
};

/* ── Helpers ── */

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ── Component ── */

export default function CalendarViewPage() {
  const router = useRouter();
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [upcoming, setUpcoming] = useState<UpcomingVisit[]>([]);
  const [past, setPast] = useState<PastVisit[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/visits/data")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.ok) {
          setUpcoming(json.upcoming ?? []);
          setPast(json.past ?? []);
          setFollowUps(json.followUps ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Build a map of date → events
  const eventMap = new Map<string, DayEvent[]>();

  for (const v of upcoming) {
    if (!v.startAt) continue;
    const d = new Date(v.startAt);
    if (isNaN(d.getTime())) continue;
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const list = eventMap.get(key) ?? [];
    list.push({
      type: "upcoming",
      label: v.providerName,
      detail: formatTime(v.startAt),
    });
    eventMap.set(key, list);
  }

  for (const v of past) {
    if (!v.visitDate) continue;
    const d = new Date(v.visitDate + "T00:00:00");
    if (isNaN(d.getTime())) continue;
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const list = eventMap.get(key) ?? [];
    list.push({
      type: "past",
      label: v.providerName,
      detail: v.amount != null ? `$${(v.amount / 100).toFixed(2)}` : "Completed",
    });
    eventMap.set(key, list);
  }

  // Navigation
  function prevMonth() {
    setSelectedDay(null);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    setSelectedDay(null);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());

  // Build grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = selectedDay ? eventMap.get(selectedDay) ?? [] : [];

  if (loading) {
    return (
      <main
        className="min-h-screen"
        style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
      >
        <TopNav />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen text-[#1A1D2E]"
      style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
    >
      <TopNav />
      <div className="mx-auto max-w-3xl px-6 pb-16 pt-10">
        <div className="mb-6 flex items-center gap-3">
          <Calendar size={22} strokeWidth={1.5} color="#5C6B5C" />
          <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E]">
            Calendar
          </h1>
        </div>

        {/* Month navigation */}
        <div className="rounded-2xl bg-white shadow-sm border border-[#EBEDF0] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#EBEDF0]">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7A7F8A] hover:bg-[#F0F2F5] transition"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-base font-semibold text-[#1A1D2E]">
              {formatMonthYear(currentYear, currentMonth)}
            </span>
            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7A7F8A] hover:bg-[#F0F2F5] transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-[#EBEDF0]">
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[#B0B4BC]"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-16 border-b border-r border-[#F0F2F5]" />;
              }

              const key = dateKey(currentYear, currentMonth, day);
              const isToday = key === todayKey;
              const events = eventMap.get(key) ?? [];
              const hasUpcoming = events.some((e) => e.type === "upcoming");
              const hasPast = events.some((e) => e.type === "past");
              const hasFollowup = events.some((e) => e.type === "followup");
              const isSelected = selectedDay === key;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  className={`relative h-16 border-b border-r border-[#F0F2F5] flex flex-col items-center pt-1.5 transition-colors ${
                    isSelected ? "bg-[#5C6B5C]/10" : isToday ? "bg-[#5C6B5C]/8" : "hover:bg-[#F8F9FA]"
                  }`}
                  style={isToday && !isSelected ? { backgroundColor: "rgba(92,107,92,0.08)" } : undefined}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                      isToday
                        ? "bg-[#5C6B5C] text-white font-semibold"
                        : "text-[#1A1D2E]"
                    }`}
                  >
                    {day}
                  </span>
                  {/* Dots */}
                  {(hasUpcoming || hasPast || hasFollowup) && (
                    <div className="mt-0.5 flex items-center gap-1">
                      {hasUpcoming && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#5C6B5C]" />
                      )}
                      {hasPast && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2A6090]" />
                      )}
                      {hasFollowup && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C03020]" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 px-6 py-3 border-t border-[#EBEDF0]">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#5C6B5C]" />
              <span className="text-[11px] text-[#7A7F8A]">Upcoming</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#2A6090]" />
              <span className="text-[11px] text-[#7A7F8A]">Past visit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#C03020]" />
              <span className="text-[11px] text-[#7A7F8A]">Needs booking</span>
            </div>
          </div>
        </div>

        {/* Selected day details */}
        {selectedDay && selectedEvents.length > 0 && (
          <div className="mt-4 rounded-2xl bg-white shadow-sm border border-[#EBEDF0] p-5">
            <h3 className="text-sm font-semibold text-[#1A1D2E] mb-3">
              {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h3>
            <div className="space-y-3">
              {selectedEvents.map((evt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl bg-[#F0F2F5] p-4 border border-[#EBEDF0]"
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
                      evt.type === "upcoming"
                        ? "bg-[#5C6B5C]"
                        : evt.type === "past"
                        ? "bg-[#2A6090]"
                        : "bg-[#C03020]"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1A1D2E]">
                      {evt.label}
                    </div>
                    <div className="text-xs text-[#7A7F8A]">{evt.detail}</div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      evt.type === "upcoming"
                        ? "bg-[#5C6B5C]/15 text-[#5C6B5C]"
                        : evt.type === "past"
                        ? "bg-[#2A6090]/15 text-[#2A6090]"
                        : "bg-[#C03020]/15 text-[#C03020]"
                    }`}
                  >
                    {evt.type === "upcoming"
                      ? "Confirmed"
                      : evt.type === "past"
                      ? "Completed"
                      : "Needs booking"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedDay && selectedEvents.length === 0 && (
          <div className="mt-4 rounded-2xl bg-white shadow-sm border border-[#EBEDF0] p-5">
            <p className="text-sm text-[#7A7F8A]">
              No appointments on{" "}
              {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
