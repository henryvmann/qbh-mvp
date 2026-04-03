type Props = {
  upcoming: number;
  followUps: number;
  name?: string;
};

export default function DailyBrief({ upcoming, followUps, name }: Props) {
  const greetingName = name ? `, ${name}` : "";

  return (
    <div className="rounded-2xl bg-[#131B2E] p-6 ring-1 ring-white/8 mb-6">
      <div className="text-xs font-medium tracking-wide text-[#4D6480]">
        Daily Brief
      </div>

      <h2 className="mt-1 text-lg font-semibold text-[#EFF4FF]">
        Good morning{greetingName}.
      </h2>

      <p className="mt-2 text-sm text-[#6B85A8]">
        Here's what matters today.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#162030] p-4 ring-1 ring-white/8">
          <div className="text-sm text-[#6B85A8]">Upcoming appointments</div>
          <div className="mt-1 text-2xl font-semibold text-[#EFF4FF]">
            {upcoming}
          </div>
        </div>

        <div className="rounded-xl bg-[#162030] p-4 ring-1 ring-white/8">
          <div className="text-sm text-[#6B85A8]">Needs follow-up</div>
          <div className="mt-1 text-2xl font-semibold text-[#EFF4FF]">
            {followUps}
          </div>
        </div>
      </div>
    </div>
  );
}
