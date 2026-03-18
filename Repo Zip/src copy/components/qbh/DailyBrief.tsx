type Props = {
  upcoming: number;
  followUps: number;
  name?: string;
};

export default function DailyBrief({ upcoming, followUps, name }: Props) {
  const greetingName = name ? `, ${name}` : "";

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 mb-6">
      <div className="text-xs font-medium tracking-wide text-slate-500">
        Daily Brief
      </div>

      <h2 className="mt-1 text-lg font-semibold text-slate-900">
        Good morning{greetingName}.
      </h2>

      <p className="mt-2 text-sm text-slate-600">
        Here’s what matters today.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#F5F1E8] p-4 ring-1 ring-black/5">
          <div className="text-sm text-slate-600">Upcoming appointments</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {upcoming}
          </div>
        </div>

        <div className="rounded-xl bg-[#F5F1E8] p-4 ring-1 ring-black/5">
          <div className="text-sm text-slate-600">Needs follow-up</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {followUps}
          </div>
        </div>
      </div>
    </div>
  );
}