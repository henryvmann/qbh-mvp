import Link from "next/link";

export const metadata = {
  title: "Medications • QBH",
  description:
    "Track medications, changes, and adherence context across your household (coming soon).",
};

export default function MedicationsPage() {
  return (
    <main className="min-h-screen bg-[#F5F1E8]">
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-slate-900">
              Medications
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              Medications will become the place to see what you’re taking, why you’re
              taking it, and what changed—without bouncing between portals.
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
            QBH will help manage medication lists across providers and household
            members—linking prescriptions to visits, refills, and follow-up care.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Medication list
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Current and historical meds with clean normalization.
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Changes & context
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Starts/stops, dosage changes, and the visit that triggered it.
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Reminders & refills
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Future workflows for refill timing and adherence support.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[#FBFBF9] p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">
              Planned capability
            </div>
            <p className="mt-2 text-sm text-slate-600">
              When we build the real system, Medications will be powered by a
              medication management model and will eventually support caregiver
              visibility and permissions.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}