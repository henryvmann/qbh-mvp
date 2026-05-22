export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { lookupPlaceDetails } from "../../../../lib/google/places-lookup";
import { normalizeProviderName } from "../../../../lib/qbh/provider-name";
import { getPrimaryRecipientName } from "../../../../lib/qbh/primary-recipient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    // Support both body-provided and session-based app_user_id
    let appUserId = String(body?.app_user_id || "").trim();
    if (!appUserId) {
      appUserId = await getSessionAppUserId(req) || "";
    }
    const rawName = String(body?.name || "").trim();
    // Reorder credentials so "LCSW Jennifer Mann" lands as "Jennifer Mann,
    // LCSW" — same shape as bank-discovered providers — and pull the
    // implied specialty if the form didn't set one.
    const { cleanedName: name, detectedSpecialty } = normalizeProviderName(rawName);
    const phone = String(body?.phone_number || "").trim() || null;
    const explicitSpecialty = String(body?.specialty || "").trim() || null;
    const specialty = explicitSpecialty || detectedSpecialty;
    const npi = String(body?.npi || "").trim() || null;
    let careRecipients = Array.isArray(body?.care_recipients) ? body.care_recipients :
      body?.care_recipient ? [body.care_recipient] : [];

    if (!appUserId || !name) {
      return NextResponse.json({ ok: false, error: "Missing app_user_id or name" }, { status: 400 });
    }

    // During onboarding the client generates a UUID and calls this route
    // *before* the auth account exists, so there is no app_users row to
    // satisfy the providers FK yet. Upsert a stub row keyed on the client
    // id — signup later fills in auth_user_id via the same id.
    await supabaseAdmin
      .from("app_users")
      .upsert({ id: appUserId }, { onConflict: "id", ignoreDuplicates: true });

    // Auto-assign to the primary user when the caller didn't specify a
    // recipient. Otherwise the provider lands as "no one yet" and the
    // user has to manually reassign every newly-added provider — the
    // May 11 review #T3 complaint. Shared helper does the lookup; we
    // also use it for Plaid + calendar pipelines so all sources default
    // to the same person.
    if (careRecipients.length === 0) {
      const primary = await getPrimaryRecipientName(appUserId);
      if (primary) careRecipients = [primary];
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from("providers")
      .select("id")
      .eq("app_user_id", appUserId)
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, provider_id: existing.id, duplicate: true });
    }

    const insertRow: Record<string, unknown> = {
      app_user_id: appUserId,
      name,
      phone_number: phone,
      specialty: specialty,
      status: "active",
      care_recipient: careRecipients.length > 0 ? JSON.stringify(careRecipients) : null,
      source: "manual",
    };
    if (npi) insertRow.npi = npi;

    const { data, error } = await supabaseAdmin
      .from("providers")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      console.error("[add-manual] error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Auto-lookup phone and address if missing
    if (!phone) {
      try {
        const placeInfo = await lookupPlaceDetails(name);
        const updates: Record<string, string> = {};
        if (placeInfo.phone) updates.phone_number = placeInfo.phone;
        if (placeInfo.address) updates.address = placeInfo.address;
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin.from("providers").update(updates).eq("id", data.id);
        }
      } catch {
        // Best effort — provider is already created
      }
    }

    return NextResponse.json({ ok: true, provider_id: data.id });
  } catch (err) {
    console.error("[add-manual] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to add provider" }, { status: 500 });
  }
}
