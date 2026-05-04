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
    <div className="rounded-2xl bg-white p-6 border border-[#E5EAF2] shadow-sm mb-6">
      <div className="text-xs font-medium tracking-wide text-[#4F5F73]">
        Daily Brief
      </div>

      <h2 className="mt-1 text-lg font-semibold text-[#071832]">
        {greeting}{greetingName}.
      </h2>

      <p className="mt-2 text-sm text-[#4F5F73]">
        {summary}
      </p>

      {hasCalendar === false && (
        <p className="mt-3 text-xs text-[#4F5F73]">
          <Link href="/calendar-connect" className="text-[#1677FF] hover:underline">
            Connect Google Calendar
          </Link>{" "}
          for smarter booking
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#F0F2F5] p-4">
          <div className="text-sm text-[#4F5F73]">Upcoming appointments</div>
          <div className="mt-1 text-2xl font-semibold text-[#071832]">
            {upcoming}
          </div>
        </div>

        <div className="rounded-xl bg-[#F0F2F5] p-4">
          <div className="text-sm text-[#4F5F73]">Needs follow-up</div>
          <div className="mt-1 text-2xl font-semibold text-[#071832]">
            {followUps}
          </div>
        </div>
      </div>
    </div>
  );
}
