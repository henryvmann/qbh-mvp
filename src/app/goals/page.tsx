import Link from "next/link";

export const metadata = {
  title: "Goals • QBH",
  description:
    "Set health goals and track progress across care, habits, and outcomes (coming soon).",
};

export default function GoalsPage() {
  return (
    <main className="min-h-screen bg-[#F5F1E8]">
      {/* Top bar */}
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-slate-900">
              Goals
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              This page will become your place to set health goals, track progress,
              and connect goals to upcoming care and follow-ups.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Content card */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-serif text-xl text-slate-900">Coming soon</h2>
          <p className="mt-2 text-slate-600">
            Goals will help QBH prioritize what matters most—then translate that into
            concrete next actions (appointments, reminders, medication adherence, and
            caregiver coordination).
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Preventive Care
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Annual physicals, screenings, routine follow-ups.
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Chronic / Ongoing
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Plans tied to medications, labs, and recurring visits.
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Household Goals
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Shared goals across a couple, family, or caregiving setup.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[#FBFBF9] p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">
              Future architecture (documented, not built yet)
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              <li>Visit transcript storage</li>
              <li>Medical memory model</li>
              <li>Medication management system</li>
              <li>Caregiver permissions</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}