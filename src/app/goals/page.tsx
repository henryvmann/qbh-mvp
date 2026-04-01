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
    <main className="min-h-screen bg-[#080C14] text-[#EFF4FF]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-[#EFF4FF]">
              Goals
            </h1>
            <p className="mt-2 max-w-2xl text-base text-[#6B85A8]">
              Goals help QBH prioritize what matters most, then connect those
              priorities to scheduling, follow-ups, medications, and household
              coordination over time.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-[#0F1520] px-4 py-2 text-sm font-medium text-[#6B85A8] shadow-sm hover:bg-[#162030]"
          >
            Back to Dashboard
          </Link>
        </div>

        <section className="mt-8 rounded-2xl bg-[#0F1520] p-6 ring-1 ring-white/8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-[#EFF4FF]">Active goals</h2>
              <p className="mt-2 text-sm text-[#6B85A8]">
                Seeded demo goals showing how QBH can connect priorities to
                concrete actions.
              </p>
            </div>

            <span className="rounded-full bg-[#5DE8C5]/15 px-3 py-1 text-xs font-semibold text-[#5DE8C5] ring-1 ring-[#5DE8C5]/30">
              Demo preview
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {activeGoals.map((goal) => (
              <div
                key={goal.title}
                className="rounded-2xl bg-[#162030] p-5 ring-1 ring-white/8"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="font-semibold text-[#EFF4FF]">{goal.title}</div>

                  <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-[#6B85A8] ring-1 ring-white/10">
                    {goal.status}
                  </span>
                </div>

                <p className="mt-3 text-sm text-[#6B85A8]">{goal.detail}</p>

                <div className="mt-3 text-sm text-[#9AB0CC]">{goal.nextStep}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {goalCategories.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-[#0F1520] p-6 ring-1 ring-white/8"
            >
              <h2 className="font-serif text-xl text-[#EFF4FF]">{item.title}</h2>
              <p className="mt-3 text-sm text-[#6B85A8]">{item.detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl bg-[#0F1520] p-6 ring-1 ring-white/8">
          <div className="text-sm font-semibold uppercase tracking-wide text-[#4D6480]">
            Future system connections
          </div>

          <p className="mt-3 text-sm text-[#6B85A8]">
            In the full QBH platform, goals become a planning layer that ties
            together care coordination, timeline memory, medications, and shared
            household workflows.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {futureSystemLinks.map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-[#162030] p-4 ring-1 ring-white/8"
              >
                <div className="text-sm font-medium text-[#9AB0CC]">{item}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
