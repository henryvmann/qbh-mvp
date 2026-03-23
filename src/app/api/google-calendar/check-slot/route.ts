import { NextResponse } from "next/server";
import { getAvailabilityContext } from "../../../../lib/availability";

type CheckSlotRequestBody = {
  app_user_id?: string;
  slot_start?: string;
  slot_end?: string;
  time_zone?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as CheckSlotRequestBody;

    const appUserId = String(body.app_user_id || "").trim();
    const slotStart = String(body.slot_start || "").trim();
    const slotEnd = String(body.slot_end || "").trim();
    const timeZone = String(body.time_zone || "America/New_York").trim();

    if (!appUserId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing app_user_id",
        },
        { status: 400 }
      );
    }

    if (!slotStart || !slotEnd) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing slot_start or slot_end",
        },
        { status: 400 }
      );
    }

    const availability = await getAvailabilityContext({
      app_user_id: appUserId,
      window_start: slotStart,
      window_end: slotEnd,
      timezone: timeZone,
      include_sources: ["GOOGLE_CALENDAR"],
      proposed_slot: {
        start_at: slotStart,
        end_at: slotEnd,
        timezone: timeZone,
      },
    });

    const conflictingBlocks = availability.blocks
      .filter((block) =>
        availability.decision?.blocking_block_ids.includes(block.id)
      )
      .map((block) => ({
        id: block.id,
        start_at: block.start_at,
        end_at: block.end_at,
        source: block.source,
        kind: block.kind,
        title: block.title ?? null,
      }));

    return NextResponse.json({
      ok: true,
      slot_start: slotStart,
      slot_end: slotEnd,
      timezone: timeZone,
      is_available: availability.decision?.status === "AVAILABLE",
      decision: availability.decision,
      conflicting_blocks: conflictingBlocks,
      source_summaries: availability.source_summaries,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check slot availability";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}