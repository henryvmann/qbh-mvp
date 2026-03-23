export type BuildBookingSummaryInput = {
  provider_id: string | null;
  appointment_start: string | null;
  appointment_end: string | null;
  timezone?: string | null;
  calendar_event_id?: string | null;
  portal_fact_written?: boolean;
};

export type BookingSummary = {
  status: "BOOKED_CONFIRMED";
  provider_id: string | null;
  appointment_start: string | null;
  appointment_end: string | null;
  timezone: string;
  display_time: string | null;
  calendar_event_id: string | null;
  proof: {
    calendar_event_created: boolean;
    portal_fact_written: boolean;
  };
};

function ordinal(n: number) {
  const v = n % 100;

  if (v >= 11 && v <= 13) {
    return `${n}th`;
  }

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatDisplayTime(
  iso: string | null,
  timezone: string
): string | null {
  if (!iso) {
    return null;
  }

  const d = new Date(iso);

  if (!Number.isFinite(d.getTime())) {
    return null;
  }

  const month = d.toLocaleDateString("en-US", {
    month: "long",
    timeZone: timezone,
  });

  const dayNum = Number(
    d.toLocaleDateString("en-US", {
      day: "numeric",
      timeZone: timezone,
    })
  );

  const time = d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    })
    .replace(":00 ", " ");

  return `${month} ${ordinal(dayNum)} at ${time}`;
}

export function buildBookingSummary(
  input: BuildBookingSummaryInput
): BookingSummary {
  const timezone = String(input.timezone || "America/New_York");

  return {
    status: "BOOKED_CONFIRMED",
    provider_id: input.provider_id ?? null,
    appointment_start: input.appointment_start ?? null,
    appointment_end: input.appointment_end ?? null,
    timezone,
    display_time: formatDisplayTime(input.appointment_start ?? null, timezone),
    calendar_event_id: input.calendar_event_id ?? null,
    proof: {
      calendar_event_created: Boolean(input.calendar_event_id),
      portal_fact_written: Boolean(input.portal_fact_written),
    },
  };
}