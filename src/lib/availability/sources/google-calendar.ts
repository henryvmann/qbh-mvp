import { supabaseAdmin } from "../../supabase-server";
import type {
  AvailabilityBlock,
  AvailabilityServiceInput,
  AvailabilitySourceAdapter,
} from "../types";

type IntegrationRow = {
  id: string;
};

type CalendarEventRow = {
  id: string;
  title: string | null;
  start_at: string;
  end_at: string;
  timezone: string | null;
};

function shouldIncludeGoogleCalendar(input: AvailabilityServiceInput): boolean {
  if (!input.include_sources || input.include_sources.length === 0) {
    return true;
  }

  return input.include_sources.includes("GOOGLE_CALENDAR");
}

function normalizeEventToBlock(
  event: CalendarEventRow,
  integrationId: string,
  fallbackTimezone: string
): AvailabilityBlock {
  return {
    id: `google_calendar:${event.id}`,
    kind: "BUSY",
    source: "GOOGLE_CALENDAR",
    start_at: event.start_at,
    end_at: event.end_at,
    timezone: (event.timezone || fallbackTimezone).trim(),
    confidence: "HIGH",
    title: event.title,
    provider_id: null,
    integration_id: integrationId,
    metadata: {
      calendar_event_id: event.id,
    },
  };
}

export const googleCalendarAvailabilitySource: AvailabilitySourceAdapter = {
  kind: "GOOGLE_CALENDAR",

  async getBlocks(input: AvailabilityServiceInput): Promise<AvailabilityBlock[]> {
    if (!shouldIncludeGoogleCalendar(input)) {
      return [];
    }

    const timezone = (input.timezone || "America/New_York").trim();

    const { data: integration, error: integrationError } = await supabaseAdmin
      .from("integrations")
      .select("id")
      .eq("app_user_id", input.app_user_id)
      .eq("integration_type", "GOOGLE_CALENDAR")
      .eq("status", "CONNECTED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<IntegrationRow>();

    if (integrationError) {
      throw new Error(
        `Failed to load Google Calendar integration: ${integrationError.message}`
      );
    }

    if (!integration) {
      return [];
    }

    const { data: events, error: eventsError } = await supabaseAdmin
      .from("calendar_events")
      .select("id, title, start_at, end_at, timezone")
      .eq("app_user_id", input.app_user_id)
      .gte("end_at", input.window_start)
      .lte("start_at", input.window_end)
      .order("start_at", { ascending: true })
      .returns<CalendarEventRow[]>();

    if (eventsError) {
      throw new Error(
        `Failed to load calendar events: ${eventsError.message}`
      );
    }

    return (events || []).map((event) =>
      normalizeEventToBlock(event, integration.id, timezone)
    );
  },
};