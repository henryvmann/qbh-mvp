export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function GET(req: Request) {
  const appUserId = await getSessionAppUserId(req);

  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Find providers that look like pharmacies
  const { data: pharmacyProviders } = await supabaseAdmin
    .from("providers")
    .select("id, name")
    .eq("app_user_id", appUserId)
    .or(
      "name.ilike.%cvs%,name.ilike.%walgreens%,name.ilike.%rite aid%,name.ilike.%pharmacy%"
    );

  const pharmacyIds = (pharmacyProviders ?? []).map((p) => p.id);
  const pharmacyNameMap = new Map(
    (pharmacyProviders ?? []).map((p) => [p.id, p.name])
  );

  let pharmacyVisits: {
    provider_name: string;
    visit_date: string | null;
    amount_cents: number | null;
  }[] = [];

  if (pharmacyIds.length > 0) {
    const { data: visits } = await supabaseAdmin
      .from("provider_visits")
      .select("provider_id, visit_date, amount")
      .eq("app_user_id", appUserId)
      .in("provider_id", pharmacyIds)
      .order("visit_date", { ascending: false, nullsFirst: false })
      .limit(50);

    pharmacyVisits = (visits ?? []).map((v) => ({
      provider_name:
        pharmacyNameMap.get(v.provider_id) ?? "Unknown Pharmacy",
      visit_date: v.visit_date,
      amount_cents: v.amount ?? null,
    }));
  }

  return NextResponse.json({ ok: true, pharmacyVisits });
}
