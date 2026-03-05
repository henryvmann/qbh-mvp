import Link from "next/link";

export const metadata = {
  title: "Visits • QBH",
  description:
    "View upcoming appointments and past visits across your providers (coming soon).",
};

export default function VisitsPage() {
  return (
    <main className="min-h-screen bg-[#F5F1E8]">
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-slate-900">
              Visits
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              Visits will become the central place to view upcoming appointments,
              past visits, and summaries of what happened during each interaction
              with your providers.
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
            QBH will automatically organize your healthcare visits—scheduled,
            completed, and recommended—so you always know what’s coming next and
            what follow-ups are required.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Upcoming visits
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Appointments QBH scheduled or detected from portals.
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Past appointments
              </div>
              <div className="mt-1 text-sm text-slate-600">
                A clean history of where you’ve been and when.
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Visit summaries
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Future AI summaries powered by visit transcript storage.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[#FBFBF9] p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">
              Planned capability
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Visits will eventually connect scheduling, transcripts, follow-ups,
              and outcomes so QBH can automatically recommend next steps in your
              care journey.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}