import {
  getValidOutlookCalendarAccessToken,
  fetchOutlookCalendarEvents,
} from "../../outlook-calendar";
import { getStoredOutlookCalendarConnection } from "../../outlook-calendar";
import type {
  AvailabilityBlock,
  AvailabilityServiceInput,
  AvailabilitySourceAdapter,
} from "../types";

const BUSY_SHOW_AS_VALUES = new Set(["busy", "tentative", "oof"]);

function shouldIncludeOutlookCalendar(
  input: AvailabilityServiceInput
): boolean {
  if (!input.include_sources || input.include_sources.length === 0) {
    return true;
  }

  return input.include_sources.includes("OUTLOOK_CALENDAR");
}

function normalizeOutlookEventToBlock(
  event: {
    subject: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    showAs: string;
  },
  index: number,
  integrationId: string,
  fallbackTimezone: string
): AvailabilityBlock | null {
  const showAs = (event.showAs || "").toLowerCase();

  if (!BUSY_SHOW_AS_VALUES.has(showAs)) {
    return null;
  }

  // Microsoft Graph calendarview returns dateTime without trailing Z for UTC
  // Ensure ISO format
  let startAt = event.start.dateTime;
  let endAt = event.end.dateTime;

  if (
    event.start.timeZone === "UTC" &&
    !startAt.endsWith("Z") &&
    !startAt.includes("+")
  ) {
    startAt = startAt + "Z";
  }

  if (
    event.end.timeZone === "UTC" &&
    !endAt.endsWith("Z") &&
    !endAt.includes("+")
  ) {
    endAt = endAt + "Z";
  }

  return {
    id: `outlook_calendar:${index}:${startAt}`,
    kind: "BUSY",
    source: "OUTLOOK_CALENDAR",
    start_at: startAt,
    end_at: endAt,
    timezone: (event.start.timeZone || fallbackTimezone).trim(),
    confidence: "HIGH",
    title: event.subject || null,
    provider_id: null,
    integration_id: integrationId,
    metadata: {
      outlook_show_as: event.showAs,
    },
  };
}

export const outlookCalendarAvailabilitySource: AvailabilitySourceAdapter = {
  kind: "OUTLOOK_CALENDAR",

  async getBlocks(
    input: AvailabilityServiceInput
  ): Promise<AvailabilityBlock[]> {
    if (!shouldIncludeOutlookCalendar(input)) {
      return [];
    }

    const timezone = (input.timezone || "America/New_York").trim();

    // Check if there is an Outlook connection before trying to fetch
    const connection = await getStoredOutlookCalendarConnection(
      input.app_user_id
    );

    if (!connection) {
      return [];
    }

    const result = await fetchOutlookCalendarEvents({
      appUserId: input.app_user_id,
      timeMin: input.window_start,
      timeMax: input.window_end,
      timeZone: timezone,
    });

    const blocks: AvailabilityBlock[] = [];

    for (let i = 0; i < result.events.length; i++) {
      const block = normalizeOutlookEventToBlock(
        result.events[i],
        i,
        connection.integration_id,
        timezone
      );

      if (block) {
        blocks.push(block);
      }
    }

    return blocks;
  },
};
