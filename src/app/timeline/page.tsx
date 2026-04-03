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
    <main className="min-h-screen bg-[#0B1120] text-[#EFF4FF]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-[#EFF4FF]">
              Health Timeline
            </h1>

            <p className="mt-2 max-w-2xl text-base text-[#6B85A8]">
              A chronological record of visits, medications, labs, and key
              health milestones. Over time QBH builds a medical memory so you
              never have to reconstruct your care history across portals.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-[#131B2E] px-4 py-2 text-sm font-medium text-[#6B85A8] shadow-sm hover:bg-[#162030]"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="mt-10 space-y-6">
          {events.map((event, i) => (
            <div
              key={i}
              className="rounded-2xl bg-[#131B2E] p-6 ring-1 ring-white/8"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[#4D6480]">
                  {event.date}
                </div>

                <span className="rounded-full bg-[#D4A843]/15 px-3 py-1 text-xs font-semibold text-[#D4A843] ring-1 ring-[#D4A843]/30">
                  {event.tag}
                </span>
              </div>

              <div className="mt-2 font-serif text-lg text-[#EFF4FF]">
                {event.title}
              </div>

              <p className="mt-2 text-sm text-[#6B85A8]">{event.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl bg-[#131B2E] p-6 ring-1 ring-white/8">
          <div className="text-sm font-semibold uppercase tracking-wide text-[#4D6480]">
            Future architecture
          </div>

          <p className="mt-3 text-sm text-[#6B85A8]">
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
