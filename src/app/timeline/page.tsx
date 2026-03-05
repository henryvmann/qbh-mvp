import Link from "next/link";

export const metadata = {
  title: "Timeline • QBH",
  description:
    "A living record of your care: visits, tests, meds, and key health events (coming soon).",
};

export default function TimelinePage() {
  return (
    <main className="min-h-screen bg-[#F5F1E8]">
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-slate-900">
              Timeline
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              This page will become your longitudinal view of health—appointments,
              outcomes, notes, meds, and major milestones in one place.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-serif text-xl text-slate-900">Coming soon</h2>
          <p className="mt-2 text-slate-600">
            Timeline will help QBH understand “what happened when” so the system can
            surface patterns, prepare for upcoming care, and keep your household on
            track—without you digging through portals.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Visits & outcomes
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Confirmed appointments, summaries, follow-ups.
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Tests & results
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Labs, imaging, trends over time.
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Medications & changes
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Starts/stops, dosage changes, adherence context.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[#FBFBF9] p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">
              Note on future architecture
            </div>
            <p className="mt-2 text-sm text-slate-600">
              When we build this for real, Timeline will likely be powered by visit
              transcript storage + a medical memory model so it can summarize and
              connect events automatically.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}