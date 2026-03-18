import Link from "next/link";

export const metadata = {
  title: "Caregivers • QBH",
  description:
    "Coordinate care with trusted people, roles, and visibility controls (coming soon).",
};

export default function CaregiversPage() {
  return (
    <main className="min-h-screen bg-[#F5F1E8]">
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-slate-900">
              Caregivers
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              Caregivers will help you coordinate health tasks across a household—
              sharing visibility, delegating work, and keeping the right people in
              the loop.
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
            QBH will support shared care workflows—so a partner, family member, or
            caregiver can help schedule, manage meds, and track follow-ups without
            losing control of privacy.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Trusted people
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Add household members and external helpers (future).
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Roles & responsibilities
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Define what someone can do: schedule, view, remind, coordinate.
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7FAF6] p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">
                Permissions
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Fine-grained access controls (documented, not built yet).
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[#FBFBF9] p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">
              Planned capability
            </div>
            <p className="mt-2 text-sm text-slate-600">
              When we implement caregiver permissions, QBH will support clear,
              auditable visibility rules across visits, medications, and goals—while
              preserving user control and privacy.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}