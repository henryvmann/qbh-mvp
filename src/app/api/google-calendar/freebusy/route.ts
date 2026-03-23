import { NextResponse } from "next/server";
import { getAvailabilityContext } from "../../../../lib/availability";

type FreeBusyRequestBody = {
  app_user_id?: string;
  time_min?: string;
  time_max?: string;
  time_zone?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as FreeBusyRequestBody;

    const appUserId = String(body.app_user_id || "").trim();
    const timeMin = String(body.time_min || "").trim();
    const timeMax = String(body.time_max || "").trim();
    const timeZone = String(body.time_zone || "America/New_York").trim();

    if (!appUserId) {
      return NextResponse.json(
        { ok: false, error: "Missing app_user_id" },
        { status: 400 }
      );
    }

    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { ok: false, error: "Missing time_min or time_max" },
        { status: 400 }
      );
    }

    const availability = await getAvailabilityContext({
      app_user_id: appUserId,
      window_start: timeMin,
      window_end: timeMax,
      timezone: timeZone,
      include_sources: ["GOOGLE_CALENDAR"],
    });

    const busyBlocks = availability.blocks
      .filter((block) => block.kind === "BUSY")
      .map((block) => ({
        id: block.id,
        start_at: block.start_at,
        end_at: block.end_at,
        source: block.source,
        title: block.title ?? null,
      }));

    return NextResponse.json({
      ok: true,
      time_min: availability.window_start,
      time_max: availability.window_end,
      time_zone: availability.timezone,
      busy_blocks: busyBlocks,
      busy_block_count: busyBlocks.length,
      source_summaries: availability.source_summaries,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch availability";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}