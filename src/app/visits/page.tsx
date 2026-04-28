"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import TopNav from "../../components/qbh/TopNav";
import BestNextStep from "../../components/qbh/BestNextStep";
import HandleItButton from "../../components/qbh/HandleItButton";
import ProviderLink from "../../components/qbh/ProviderLink";
import NextSteps from "../../components/qbh/NextSteps";
import { Pencil, Trash2, X as XIcon } from "lucide-react";

type UpcomingVisit = {
  eventId: string;
  providerId?: string;
  providerName: string;
  startAt: string | null;
  endAt: string | null;
  timezone: string | null;
  needsProviderMatch?: boolean;
  providerConfirmed?: boolean;
};

type PastVisit = {
  id: string;
  providerId?: string;
  providerName: string;
  visitDate: string | null;
  amount: number | null;
};

type FollowUp = {
  providerId: string;
  providerName: string;
};

function isValidDate(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d.getTime());
}

function formatDate(iso: string | null | undefined): string {
  if (!iso || !isValidDate(iso)) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso || !isValidDate(iso)) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatVisitDateTime(iso: string | null | undefined, providerName: string): string {
  const date = formatDate(iso);
  const time = formatTime(iso);
  if (date && time) return `${date} at ${time}`;
  if (date) return date;
  return providerName;
}

function formatAmount(cents: number | null): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

function VisitsInner() {
  const router = useRouter();

  const [upcoming, setUpcoming] = useState<UpcomingVisit[]>([]);
  const [past, setPast] = useState<PastVisit[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

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

  if (loading) {
    return <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />;
  }

  return (
    <main className="min-h-screen text-[#1A1D2E]" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
      <TopNav />
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
        <div className="mb-2">
          <h1 className="font-serif text-2xl tracking-tight text-[#1A1D2E]">
            Visits
          </h1>
          <p className="mt-1 text-sm text-[#7A7F8A]">
            Upcoming appointments and past visits
          </p>
        </div>

        <BestNextStep context="visits" />

        {/* Upcoming visits */}
        <section data-tour="upcoming-visits" className="mt-8 rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-[#1A1D2E]">
                Upcoming visits
              </h2>
              <p className="mt-2 text-sm text-[#7A7F8A]">
                Confirmed appointments from the QBH booking system.
              </p>
            </div>
            <span className="text-sm font-medium text-[#7A7F8A]">
              {upcoming.length} upcoming
            </span>
          </div>

          {upcoming.length > 0 ? (
            <div className="mt-6 space-y-4">
              {upcoming.map((visit) => (
                <div
                  key={visit.eventId}
                  className="rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold">
                        {visit.providerId ? (
                          <ProviderLink providerId={visit.providerId} providerName={visit.providerName} />
                        ) : visit.providerName}
                      </div>
                      <div className="mt-1 text-sm text-[#7A7F8A]">
                        {formatVisitDateTime(visit.startAt, visit.providerName)}
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#5C6B5C]/15 px-3 py-1 text-xs font-semibold text-[#5C6B5C] ring-1 ring-[#5C6B5C]/30">
                      {visit.providerId ? "Confirmed" : "From Calendar"}
                    </span>
                  </div>
                  {visit.needsProviderMatch && !visit.providerId && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
                      <span className="text-xs text-amber-700">
                        Who is this appointment with?
                      </span>
                      <a
                        href="/providers?add=true"
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-white"
                        style={{ backgroundColor: "#5C6B5C" }}
                      >
                        Assign Provider
                      </a>
                    </div>
                  )}
                  {visit.providerId && !visit.providerConfirmed && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5">
                      <span className="text-xs text-blue-700">
                        Is this the right provider? Confirm to help Kate manage it.
                      </span>
                      <a
                        href={`/providers`}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-white shrink-0"
                        style={{ backgroundColor: "#5C6B5C" }}
                      >
                        Confirm
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]">
              <div className="font-semibold text-[#1A1D2E]">
                No upcoming appointments yet
              </div>
              <p className="mt-2 text-sm text-[#7A7F8A]">
                Confirmed appointments will appear here when Kate books them.
              </p>
              <div className="mt-3 flex gap-2">
                <a
                  href="/calendar-view"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: "#5C6B5C" }}
                >
                  View calendar
                </a>
                <a
                  href="/providers"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border border-[#EBEDF0] text-[#1A1D2E] hover:bg-white"
                >
                  Book with Kate
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Follow-ups and Past visits side by side */}
        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Follow-ups */}
          <div data-tour="follow-ups" className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#1A1D2E]">
                  Follow-ups to schedule
                </h2>
                <p className="mt-2 text-sm text-[#7A7F8A]">
                  Providers that are overdue or don&apos;t have a future appointment.
                </p>
              </div>
              <span className="text-sm font-medium text-[#7A7F8A]">
                {followUps.length} open
              </span>
            </div>

            {followUps.length > 0 ? (
              <div className="mt-6 space-y-4">
                {followUps.map((fu) => (
                  <div
                    key={fu.providerId}
                    className="rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-semibold">
                        <ProviderLink providerId={fu.providerId} providerName={fu.providerName} />
                      </div>
                      <span className="rounded-full bg-[#F0B8B0]/30 px-3 py-1 text-xs font-semibold text-[#C03020] ring-1 ring-[#F0B8B0]">
                        Needs booking
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#7A7F8A]">
                      Kate can call and schedule this for you.
                    </p>
                    <HandleItButton
                      providerId={fu.providerId}
                      providerName={fu.providerName}
                      label="Book with Kate"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]">
                <div className="font-semibold text-[#1A1D2E]">
                  No open follow-ups right now
                </div>
                <p className="mt-2 text-sm text-[#7A7F8A]">
                  Current providers are either booked already or not yet marked
                  for another scheduling attempt.
                </p>
              </div>
            )}
          </div>

          {/* Past visits */}
          <div className="rounded-2xl bg-white shadow-sm p-6 border border-[#EBEDF0]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#1A1D2E]">
                  Past visits
                </h2>
                <p className="mt-2 text-sm text-[#7A7F8A]">
                  Visits found from your financial data analysis.
                </p>
              </div>
              <span className="text-sm font-medium text-[#7A7F8A]">
                {past.length} visits
              </span>
            </div>

            {past.length > 0 ? (
              <div className="mt-6 space-y-4">
                {past.map((visit) => (
                  <div
                    key={visit.id}
                    className="rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {editingId === visit.id ? (
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="rounded-lg border border-[#EBEDF0] bg-white px-2 py-1 text-sm text-[#1A1D2E]"
                        />
                      ) : (
                        <div className="text-sm font-semibold text-[#B0B4BC]">
                          {formatDate(visit.visitDate)}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        {editingId === visit.id ? (
                          <>
                            <button
                              onClick={async () => {
                                if (!editDate) return;
                                setSaving(true);
                                try {
                                  await apiFetch("/api/visits/manage", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "update", visit_id: visit.id, visit_date: editDate }),
                                  });
                                  setPast((prev) => prev.map((v) => v.id === visit.id ? { ...v, visitDate: editDate } : v));
                                  setEditingId(null);
                                } finally { setSaving(false); }
                              }}
                              disabled={saving}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              style={{ backgroundColor: "#5C6B5C" }}
                            >
                              {saving ? "..." : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-lg p-1 text-[#7A7F8A] hover:bg-white"
                            >
                              <XIcon size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingId(visit.id); setEditDate(visit.visitDate || ""); }}
                              className="rounded-lg p-1.5 text-[#B0B4BC] hover:text-[#7A7F8A] hover:bg-white transition"
                              title="Edit date"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm("Remove this visit?")) return;
                                await apiFetch("/api/visits/manage", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ action: "delete", visit_id: visit.id }),
                                });
                                setPast((prev) => prev.filter((v) => v.id !== visit.id));
                              }}
                              className="rounded-lg p-1.5 text-[#B0B4BC] hover:text-red-500 hover:bg-red-50 transition"
                              title="Remove visit"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 font-semibold">
                      {visit.providerId ? (
                        <ProviderLink providerId={visit.providerId} providerName={visit.providerName} />
                      ) : visit.providerName}
                    </div>
                    {visit.amount != null && (
                      <p className="mt-1 text-sm text-[#7A7F8A]">
                        {formatAmount(visit.amount)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-[#F0F2F5] p-5 border border-[#EBEDF0]">
                <div className="font-semibold text-[#1A1D2E]">
                  No past visits found yet
                </div>
                <p className="mt-2 text-sm text-[#7A7F8A]">
                  Past visits will appear once QBH analyzes your financial data.
                </p>
              </div>
            )}
          </div>
        </section>
        <NextSteps />
      </div>
    </main>
  );
}

export default function VisitsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />}>
      <VisitsInner />
    </Suspense>
  );
}
