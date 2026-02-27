import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const attemptId = String(body.attempt_id);
    const proposalId = String(body.proposal_id);

    if (!attemptId || !proposalId) {
      return NextResponse.json(
        { booked: false, error: "Missing attempt_id or proposal_id" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase.rpc(
      "finalize_confirm_booking",
      {
        p_attempt_id: attemptId,
        p_proposal_id: proposalId,
      }
    );

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