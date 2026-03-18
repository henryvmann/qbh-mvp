import Link from "next/link";

export const metadata = {
  title: "Medications • QBH",
  description:
    "Track active medications, changes over time, and future medication coordination across your household.",
};

type MedicationCard = {
  name: string;
  dose: string;
  schedule: string;
  started: string;
  purpose: string;
  status: string;
};

type MedicationHistoryItem = {
  date: string;
  title: string;
  detail: string;
  tag: string;
};

export default function MedicationsPage() {
  const activeMedications: MedicationCard[] = [
    {
      name: "Lisinopril",
      dose: "10 mg",
      schedule: "Daily",
      started: "Started February 1",
      purpose: "Blood pressure support",
      status: "Active",
    },
    {
      name: "Vitamin D",
      dose: "2000 IU",
      schedule: "Weekly",
      started: "Started January 10",
      purpose: "Supplement routine",
      status: "Active",
    },
  ];

  const medicationHistory: MedicationHistoryItem[] = [
    {
      date: "February 1",
      title: "Lisinopril dosage increased",
      detail:
        "Dose updated after a primary care review and added to the health record timeline.",
      tag: "Dose change",
    },
    {
      date: "January 10",
      title: "Vitamin D added",
      detail:
        "Supplement routine started and tracked as part of ongoing care planning.",
      tag: "Started",
    },
  ];

  const futureConnections = [
    "Medication adherence tied to care goals",
    "Refill reminders connected to upcoming visits",
    "Visit instructions linked to medication changes",
    "Caregiver visibility and permissions where appropriate",
  ];

  return (
    <main className="min-h-screen bg-[#F5F1E8]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-slate-900">
              Medications
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              Medications give QBH a structured view of what you are taking, what
              changed, and how prescriptions connect to visits, follow-ups, and
              long-term care planning.
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
              <h2 className="font-serif text-xl text-slate-900">
                Active medications
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Seeded demo medications showing how QBH can organize an active
                medication list.
              </p>
            </div>

            <span className="rounded-full bg-[#F7FAF6] px-3 py-1 text-xs font-semibold text-[#6F8168] ring-1 ring-slate-200">
              Demo preview
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {activeMedications.map((med) => (
              <div
                key={med.name}
                className="rounded-2xl bg-[#F7FAF6] p-5 ring-1 ring-slate-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="font-semibold text-slate-900">
                    {med.name} {med.dose}
                  </div>

                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {med.status}
                  </span>
                </div>

                <div className="mt-3 text-sm text-slate-700">{med.schedule}</div>
                <div className="mt-1 text-sm text-slate-600">{med.started}</div>
                <div className="mt-3 text-sm text-slate-600">{med.purpose}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-serif text-xl text-slate-900">
              Medication history
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Seeded demo history showing how medication changes can be tracked
              over time.
            </p>

            <div className="mt-6 space-y-4">
              {medicationHistory.map((item) => (
                <div
                  key={`${item.date}-${item.title}`}
                  className="rounded-2xl bg-[#FBFBF9] p-5 ring-1 ring-slate-200"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-slate-500">
                      {item.date}
                    </div>

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {item.tag}
                    </span>
                  </div>

                  <div className="mt-2 font-semibold text-slate-900">
                    {item.title}
                  </div>

                  <p className="mt-3 text-sm text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-serif text-xl text-slate-900">
              Future medication system
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              In the full QBH platform, medications become a connected layer
              across visits, goals, timeline memory, and household care.
            </p>

            <div className="mt-6 space-y-4">
              {futureConnections.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-[#FBFBF9] p-4 ring-1 ring-slate-200"
                >
                  <div className="text-sm font-medium text-slate-700">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}