export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const providerId = String(body?.provider_id || "").trim();
    const action = String(body?.action || "").trim(); // "approve" or "dismiss"
    const appUserId = String(body?.app_user_id || "").trim();

    if (!providerId || !action || !appUserId) {
      return NextResponse.json(
        { ok: false, error: "Missing provider_id, action, or app_user_id" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "dismiss") {
      return NextResponse.json(
        { ok: false, error: "Action must be 'approve' or 'dismiss'" },
        { status: 400 }
      );
    }

    const careRecipients = Array.isArray(body?.care_recipients) ? body.care_recipients :
      body?.care_recipient ? [body.care_recipient] : [];
    const newStatus = action === "approve" ? "active" : "dismissed";

    const providerType = typeof body?.provider_type === "string" ? body.provider_type.trim() : null;

    const updateData: Record<string, string | null> = { status: newStatus };
    if (careRecipients.length > 0 && action === "approve") {
      updateData.care_recipient = JSON.stringify(careRecipients);
    }
    if (providerType && action === "approve") {
      updateData.provider_type = providerType;
    }

    const { error } = await supabaseAdmin
      .from("providers")
      .update(updateData)
      .eq("id", providerId)
      .eq("app_user_id", appUserId);

    if (error) {
      console.error("provider review error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to update provider" },
        { status: 500 }
      );
    }

    // Feedback signal: when a user dismisses a provider, record the
    // normalized merchant so future scans skip it FOR THIS USER. Also
    // feeds the candidate denylist Henry reviews when promoting to
    // the universe eval. The hardcoded HEALTHCARE_ALLOWLIST in the
    // classifier ensures real pharmacies/hospitals can't be poisoned
    // by dismissal noise.
    if (action === "dismiss") {
      const { data: providerRow } = await supabaseAdmin
        .from("providers")
        .select("name")
        .eq("id", providerId)
        .maybeSingle();
      const rawName = providerRow?.name ?? "";
      const normalized = rawName
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (normalized) {
        await supabaseAdmin
          .from("classifier_dismissals")
          .upsert(
            {
              app_user_id: appUserId,
              normalized_name: normalized,
              merchant_name: rawName,
              provider_id: providerId,
            },
            { onConflict: "app_user_id,normalized_name" }
          );
      }
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (error) {
    console.error("provider review error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
