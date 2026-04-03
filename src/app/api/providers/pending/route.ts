export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const appUserId = url.searchParams.get("app_user_id");

    if (!appUserId) {
      return NextResponse.json(
        { ok: false, error: "Missing app_user_id" },
        { status: 400 }
      );
    }

    // Fetch ALL discovered providers (active + review_needed)
    // so the user can see everything and confirm/dismiss
    const { data: providers, error } = await supabaseAdmin
      .from("providers")
      .select("id, name, status")
      .eq("app_user_id", appUserId)
      .in("status", ["active", "review_needed"])
      .order("status", { ascending: true }) // active first, then review_needed
      .order("name");

    if (error) {
      console.error("pending providers error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch providers" },
        { status: 500 }
      );
    }

    // Get visit counts for each provider
    const providerIds = (providers || []).map(p => p.id);

    let visitCounts: Record<string, number> = {};
    if (providerIds.length > 0) {
      const { data: visits } = await supabaseAdmin
        .from("provider_visits")
        .select("provider_id")
        .in("provider_id", providerIds);

      for (const visit of visits || []) {
        visitCounts[visit.provider_id] = (visitCounts[visit.provider_id] || 0) + 1;
      }
    }

    const enrichedProviders = (providers || []).map(p => ({
      ...p,
      visit_count: visitCounts[p.id] || 0,
    }));

    return NextResponse.json({ ok: true, providers: enrichedProviders });
  } catch (error) {
    console.error("pending providers error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
