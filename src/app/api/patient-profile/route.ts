export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { logAudit } from "../../../lib/audit";

export async function GET(req: NextRequest) {
  let appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    const url = new URL(req.url);
    appUserId = url.searchParams.get("app_user_id");
  }
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  logAudit({ appUserId, action: "view_profile", resourceType: "patient_profile", ipAddress: ip });

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile, auth_user_id")
    .eq("id", appUserId)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const profile: Record<string, unknown> = { ...(data?.patient_profile || {}) };

  // Fallback: pull `full_name` from auth user metadata when the
  // patient_profile field is missing/empty. Catches legacy accounts
  // that signed up before patient_profile.full_name was set, and
  // means the HandleItButton pre-call form pre-fills correctly across
  // all account ages instead of showing a blank name input.
  if (!profile.full_name && data?.auth_user_id) {
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.auth_user_id);
      const meta = authUser?.user?.user_metadata as { name?: string } | undefined;
      if (meta?.name && meta.name.trim()) {
        profile.full_name = meta.name.trim();
      }
    } catch {
      // ignore — caller still gets whatever's in patient_profile
    }
  }

  // Optional: if the caller passes ?provider_id=X, also return whether
  // the user has any visit history with that provider. Used by
  // HandleItButton to gate the "Have you visited this provider before?"
  // pre-call question — we ask it only when we don't already know.
  const providerIdParam = new URL(req.url).searchParams.get("provider_id");
  let providerVisitCount: number | null = null;
  if (providerIdParam) {
    const { count } = await supabaseAdmin
      .from("provider_visits")
      .select("id", { count: "exact", head: true })
      .eq("app_user_id", appUserId)
      .eq("provider_id", providerIdParam);
    providerVisitCount = count ?? 0;
  }

  return NextResponse.json({
    ok: true,
    profile,
    ...(providerVisitCount !== null ? { provider_visit_count: providerVisitCount } : {}),
  });
}

export async function POST(req: NextRequest) {
  let appUserId = await getSessionAppUserId(req);
  const body = await req.json().catch(() => ({}));

  if (!appUserId) {
    appUserId = String(body?.app_user_id || "").trim() || null;
  }
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  logAudit({ appUserId, action: "update_profile", resourceType: "patient_profile", ipAddress: ip });

  const incoming = body?.profile || {};

  // Merge with existing profile so we don't overwrite fields not in this request
  const { data: existing } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  const merged = { ...(existing?.patient_profile || {}), ...incoming };

  // introduced_provider_ids is an additive set — the dashboard's
  // walkthrough taps each post a "here are the new ones" payload. If
  // we plain-replaced it, a race between dashboard mount (which fetches
  // the existing list into React state) and an early walkthrough tap
  // could write a short list back and silently drop previously-
  // introduced IDs. Always union with what's already on file.
  if (Array.isArray(incoming.introduced_provider_ids)) {
    const existingIds = Array.isArray(existing?.patient_profile?.introduced_provider_ids)
      ? (existing!.patient_profile.introduced_provider_ids as unknown[]).filter(
          (x): x is string => typeof x === "string"
        )
      : [];
    const incomingIds = (incoming.introduced_provider_ids as unknown[]).filter(
      (x): x is string => typeof x === "string"
    );
    merged.introduced_provider_ids = Array.from(new Set([...existingIds, ...incomingIds]));
  }

  // If this update renamed any care recipients (same id, new name), the
  // providers.care_recipient column for that user still holds the old
  // name. Carry the rename through so providers stay attached to their
  // recipient — otherwise the user has to re-tag every provider.
  const oldRecipients = Array.isArray(existing?.patient_profile?.care_recipients)
    ? (existing!.patient_profile.care_recipients as Array<{ id: string; name: string }>)
    : [];
  const newRecipients = Array.isArray(incoming?.care_recipients)
    ? (incoming.care_recipients as Array<{ id: string; name: string }>)
    : null;
  const renames: Array<{ from: string; to: string }> = [];
  if (newRecipients) {
    const oldById = new Map(oldRecipients.map((r) => [r.id, r.name]));
    for (const nr of newRecipients) {
      const oldName = oldById.get(nr.id);
      if (oldName && oldName !== nr.name) renames.push({ from: oldName, to: nr.name });
    }
  }

  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: merged })
    .eq("id", appUserId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Apply rename migrations to existing provider rows.
  if (renames.length > 0) {
    const { data: providers } = await supabaseAdmin
      .from("providers")
      .select("id, care_recipient")
      .eq("app_user_id", appUserId)
      .not("care_recipient", "is", null);
    for (const p of providers ?? []) {
      try {
        const arr: string[] = typeof p.care_recipient === "string"
          ? JSON.parse(p.care_recipient)
          : Array.isArray(p.care_recipient) ? p.care_recipient : [];
        let changed = false;
        const updated = arr.map((name) => {
          const r = renames.find((x) => x.from === name);
          if (r) { changed = true; return r.to; }
          return name;
        });
        if (changed) {
          await supabaseAdmin
            .from("providers")
            .update({
              care_recipient: updated.length > 0 ? JSON.stringify(updated) : null,
            })
            .eq("id", p.id);
        }
      } catch {
        // Malformed care_recipient — skip.
      }
    }
  }

  // Handle provider-specific patient status
  const providerStatus = body?.provider_status;
  if (providerStatus?.provider_id && providerStatus?.status === "existing") {
    // Create a synthetic visit so the system knows they're existing
    const { data: existingVisit } = await supabaseAdmin
      .from("provider_visits")
      .select("id")
      .eq("app_user_id", appUserId)
      .eq("provider_id", providerStatus.provider_id)
      .limit(1)
      .maybeSingle();

    if (!existingVisit) {
      try {
        await supabaseAdmin.from("provider_visits").insert({
          app_user_id: appUserId,
          provider_id: providerStatus.provider_id,
          source: "user_confirmed",
          visit_date: new Date().toISOString().slice(0, 10),
          amount_cents: 0,
          source_transaction_id: `user_confirmed_${Date.now()}`,
        });
      } catch {
        // Non-critical
      }
    }
  }

  return NextResponse.json({ ok: true });
}
