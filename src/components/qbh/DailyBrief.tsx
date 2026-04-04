import Link from "next/link";

type Props = {
  upcoming: number;
  followUps: number;
  name?: string;
  hasCalendar?: boolean;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DailyBrief({ upcoming, followUps, name, hasCalendar }: Props) {
  const greeting = getGreeting();
  const greetingName = name ? `, ${name}` : "";

  const allCaughtUp = upcoming === 0 && followUps === 0;

  let summary: string;
  if (allCaughtUp) {
    summary = "You're all caught up.";
  } else {
    const parts: string[] = [];
    if (upcoming > 0) {
      parts.push(`${upcoming} upcoming appointment${upcoming === 1 ? "" : "s"}`);
    }
    if (followUps > 0) {
      parts.push(`${followUps} provider${followUps === 1 ? "" : "s"} needing follow-up`);
    }
    summary = `You have ${parts.join(" and ")}.`;
  }

  return (
    <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/8 mb-6">
      <div className="text-xs font-medium tracking-wide text-[#4D6480]">
        Daily Brief
      </div>

      <h2 className="mt-1 text-lg font-semibold text-[#F0F2F5]">
        {greeting}{greetingName}.
      </h2>

      <p className="mt-2 text-sm text-[#8A9BAE]">
        {summary}
      </p>

      {hasCalendar === false && (
        <p className="mt-3 text-xs text-[#8A9BAE]">
          <Link href="/calendar-connect" className="text-[#7BA59A] hover:underline">
            Connect Google Calendar
          </Link>{" "}
          for smarter booking
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#162030] p-4 ring-1 ring-white/8">
          <div className="text-sm text-[#8A9BAE]">Upcoming appointments</div>
          <div className="mt-1 text-2xl font-semibold text-[#F0F2F5]">
            {upcoming}
          </div>
        </div>

        <div className="rounded-xl bg-[#162030] p-4 ring-1 ring-white/8">
          <div className="text-sm text-[#8A9BAE]">Needs follow-up</div>
          <div className="mt-1 text-2xl font-semibold text-[#F0F2F5]">
            {followUps}
          </div>
        </div>
      </div>
    </div>
  );
}
