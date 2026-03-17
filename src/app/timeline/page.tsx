import Link from "next/link";

export const metadata = {
  title: "Timeline • QBH",
  description:
    "A longitudinal record of your care: visits, medications, labs, and key health milestones.",
};

type TimelineEvent = {
  date: string;
  title: string;
  detail: string;
  tag: string;
};

export default function TimelinePage() {
  const events: TimelineEvent[] = [
    {
      date: "March 9",
      title: "Primary care visit booked",
      detail:
        "QBH confirmed an appointment with Yale Primary Care at 12:00 PM.",
      tag: "Visit",
    },
    {
      date: "March 3",
      title: "Dermatology follow-up detected",
      detail:
        "System flagged dermatology as needing scheduling after last skin exam.",
      tag: "Follow-up",
    },
    {
      date: "February 20",
      title: "Lab work completed",
      detail:
        "Routine blood panel processed through Quest Diagnostics.",
      tag: "Labs",
    },
    {
      date: "February 1",
      title: "Medication adjustment",
      detail:
        "Blood pressure medication dosage updated.",
      tag: "Medication",
    },
  ];

  return (
    <main className="min-h-screen bg-[#F5F1E8]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        {/* Header */}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-slate-900">
              Health Timeline
            </h1>

            <p className="mt-2 max-w-2xl text-base text-slate-600">
              A chronological record of visits, medications, labs, and key
              health milestones. Over time QBH builds a medical memory so you
              never have to reconstruct your care history across portals.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Timeline */}

        <div className="mt-10 space-y-6">
          {events.map((event, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-500">
                  {event.date}
                </div>

                <span className="rounded-full bg-[#F7FAF6] px-3 py-1 text-xs font-semibold text-[#6F8168] ring-1 ring-slate-200">
                  {event.tag}
                </span>
              </div>

              <div className="mt-2 font-serif text-lg text-slate-900">
                {event.title}
              </div>

              <p className="mt-2 text-sm text-slate-600">{event.detail}</p>
            </div>
          ))}
        </div>

        {/* Future Architecture Note */}

        <div className="mt-12 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Future architecture
          </div>

          <p className="mt-3 text-sm text-slate-600">
            In the full QBH platform this timeline will be generated
            automatically from visit transcripts, medical records,
            medications, and care coordination activity. The system will
            build a structured medical memory model that connects events
            across providers and time.
          </p>
        </div>
      </div>
    </main>
  );
}