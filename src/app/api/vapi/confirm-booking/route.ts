import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const attemptIdRaw = body?.attempt_id;
    const proposalIdRaw = body?.proposal_id;

    const attemptIdStr = String(attemptIdRaw ?? "").trim();
    const proposalIdStr = String(proposalIdRaw ?? "").trim();

    if (!attemptIdStr || !proposalIdStr) {
      return NextResponse.json(
        { booked: false, error: "Missing attempt_id or proposal_id" },
        { status: 400 }
      );
    }

    // attempt_id must be numeric (bigint)
    if (!/^\d+$/.test(attemptIdStr)) {
      return NextResponse.json(
        { booked: false, error: `attempt_id must be a bigint integer, got: ${attemptIdStr}` },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // ✅ Correct parameter mapping
    const { data, error } = await supabase.rpc("finalize_confirm_booking", {
      p_attempt_id: attemptIdStr,      // bigint-compatible string is OK
      p_proposal_id: proposalIdStr,    // uuid string
    });

    if (error) {
      return NextResponse.json(
        { booked: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { booked: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}