import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isDigits(v: string): boolean {
  return /^\d+$/.test(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const attemptIdStr = String(body?.attempt_id ?? "").trim();
    const proposalIdStr = String(body?.proposal_id ?? "").trim();
    const confirmationNumber = String(body?.confirmation_number ?? "").trim() || null;

    if (!attemptIdStr || !proposalIdStr) {
      return NextResponse.json(
        { booked: false, error: "Missing attempt_id or proposal_id" },
        { status: 400 }
      );
    }

    if (!isDigits(attemptIdStr)) {
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

    // Fail fast: proposal must belong to attempt
    const { data: proposal, error: proposalErr } = await supabase
      .from("proposals")
      .select("id, attempt_id")
      .eq("id", proposalIdStr)
      .single();

    if (proposalErr || !proposal?.id) {
      return NextResponse.json({ booked: false, error: "Proposal not found" }, { status: 404 });
    }

    if (String((proposal as any).attempt_id) !== attemptIdStr) {
      return NextResponse.json(
        { booked: false, error: "proposal_id does not belong to attempt_id" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("finalize_confirm_booking", {
      p_attempt_id: attemptIdStr,
      p_proposal_id: proposalIdStr,
    });

    if (error) {
      return NextResponse.json({ booked: false, error: error.message }, { status: 500 });
    }

    // Include confirmation number in response for UI/logging (DB writeback can come later)
    if (confirmationNumber) {
      return NextResponse.json({ ...data, confirmation_number: confirmationNumber });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { booked: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}