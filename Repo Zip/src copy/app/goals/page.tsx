import Link from "next/link";

export const metadata = {
  title: "Goals • QBH",
  description:
    "Set health goals and track progress across preventive care, ongoing care, and household coordination.",
};

type GoalCard = {
  title: string;
  status: string;
  detail: string;
  nextStep: string;
};

export default function GoalsPage() {
  const activeGoals: GoalCard[] = [
    {
      title: "Stay current on preventive care",
      status: "In progress",
      detail:
        "Keep annual physicals, routine labs, and specialist check-ins from slipping.",
      nextStep: "Next step: maintain scheduled primary care visit and queue other annual follow-ups.",
    },
    {
      title: "Close open follow-ups",
      status: "Needs attention",
      detail:
        "Turn provider recommendations into concrete scheduling actions before they get lost.",
      nextStep: "Next step: continue outreach for dermatology and diagnostics.",
    },
    {
      title: "Build a household care system",
      status: "Future platform",
      detail:
        "Coordinate care across solo, couple, family, or caregiving setups from one place.",
      nextStep: "Next step: connect goals to household profiles, permissions, and shared workflows.",
    },
  ];

  const goalCategories = [
    {
      title: "Preventive care",
      detail: "Annual physicals, screenings, vaccinations, routine follow-ups.",
    },
    {
      title: "Ongoing care",
      detail: "Plans tied to medications, labs, chronic care, and recurring visits.",
    },
    {
      title: "Household goals",
      detail: "Shared priorities across a couple, family, or caregiving setup.",
    },
  ];

  const futureSystemLinks = [
    "Goals connected to scheduled visits",
    "Goals informed by timeline and medical memory",
    "Goals tied to medications and adherence",
    "Goals shared with caregivers where appropriate",
  ];

  return (
    <main className="min-h-screen bg-[#F5F1E8]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-slate-900">
              Goals
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              Goals help QBH prioritize what matters most, then connect those
              priorities to scheduling, follow-ups, medications, and household
              coordination over time.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-slate-900">Active goals</h2>
              <p className="mt-2 text-sm text-slate-600">
                Seeded demo goals showing how QBH can connect priorities to
                concrete actions.
              </p>
            </div>

            <span className="rounded-full bg-[#F7FAF6] px-3 py-1 text-xs font-semibold text-[#6F8168] ring-1 ring-slate-200">
              Demo preview
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {activeGoals.map((goal) => (
              <div
                key={goal.title}
                className="rounded-2xl bg-[#F7FAF6] p-5 ring-1 ring-slate-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="font-semibold text-slate-900">{goal.title}</div>

                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {goal.status}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-600">{goal.detail}</p>

                <div className="mt-3 text-sm text-slate-700">{goal.nextStep}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {goalCategories.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
            >
              <h2 className="font-serif text-xl text-slate-900">{item.title}</h2>
              <p className="mt-3 text-sm text-slate-600">{item.detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Future system connections
          </div>

          <p className="mt-3 text-sm text-slate-600">
            In the full QBH platform, goals become a planning layer that ties
            together care coordination, timeline memory, medications, and shared
            household workflows.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {futureSystemLinks.map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-[#FBFBF9] p-4 ring-1 ring-slate-200"
              >
                <div className="text-sm font-medium text-slate-700">{item}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}