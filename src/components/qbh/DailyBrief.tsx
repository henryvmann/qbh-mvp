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
    <div className="rounded-2xl bg-white p-6 border border-[#EBEDF0] shadow-sm mb-6">
      <div className="text-xs font-medium tracking-wide text-[#B0B4BC]">
        Daily Brief
      </div>

      <h2 className="mt-1 text-lg font-semibold text-[#1A1D2E]">
        {greeting}{greetingName}.
      </h2>

      <p className="mt-2 text-sm text-[#7A7F8A]">
        {summary}
      </p>

      {hasCalendar === false && (
        <p className="mt-3 text-xs text-[#7A7F8A]">
          <Link href="/calendar-connect" className="text-[#5C6B5C] hover:underline">
            Connect Google Calendar
          </Link>{" "}
          for smarter booking
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#F0F2F5] p-4">
          <div className="text-sm text-[#7A7F8A]">Upcoming appointments</div>
          <div className="mt-1 text-2xl font-semibold text-[#1A1D2E]">
            {upcoming}
          </div>
        </div>

        <div className="rounded-xl bg-[#F0F2F5] p-4">
          <div className="text-sm text-[#7A7F8A]">Needs follow-up</div>
          <div className="mt-1 text-2xl font-semibold text-[#1A1D2E]">
            {followUps}
          </div>
        </div>
      </div>
    </div>
  );
}
