export const dynamic = 'force-dynamic';
import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { resolveEpicEndpoints, getEpicClientId } from "../../../../lib/epic/endpoints";

type ConnectBody = {
  provider_id?: string;
  portal_brand?: string;
  portal_tenant?: string | null;
  fhir_base_url?: string;
  org_name?: string;
  mode?: string;
};

function getBaseUrl(req: Request): string {
  const configured =
    (process.env.QBH_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function createPkcePair() {
  const verifier = toBase64Url(randomBytes(32));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Resolve fhir_base_url from either the new field or legacy portal_tenant. */
function resolveFhirBaseUrl(body: ConnectBody): string | null {
  if (body.fhir_base_url?.trim()) return body.fhir_base_url.trim();

  // Legacy fallback for in-flight or old callers
  const tenant = String(body.portal_tenant || "").trim().toLowerCase();
  if (tenant === "stamford" || tenant === "stamford_health") {
    return (
      (process.env.EPIC_STAMFORD_FHIR_BASE_URL || "").trim() ||
      "https://epicproxy.et1378.epichosted.com/APIProxyPRD/api/FHIR/R4"
    );
  }
  if (tenant) {
    return (
      (process.env.EPIC_SANDBOX_FHIR_BASE_URL || "").trim() ||
      "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"
    );
  }

  return null;
}

async function ensurePortalIntegration(appUserId: string) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("integrations")
    .select("id")
    .eq("app_user_id", appUserId)
    .eq("integration_type", "portal")
    .in("status", ["active", "connected"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return existing;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("integrations")
    .insert({
      app_user_id: appUserId,
      integration_type: "portal",
      status: "active",
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(insertError?.message || "Failed to create portal integration");
  }

  return inserted;
}

export async function POST(req: Request) {
  const appUserId = await getSessionAppUserId(req);

  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as ConnectBody;
  const { provider_id, portal_brand, portal_tenant, fhir_base_url, org_name, mode } = body ?? {};

  if (!provider_id || !portal_brand) {
    return NextResponse.json(
      { ok: false, error: "provider_id and portal_brand are required" },
      { status: 400 }
    );
  }

  try {
    const integration = await ensurePortalIntegration(appUserId);

    if (mode === "mock") {
      const { data, error } = await supabaseAdmin
        .from("portal_connections")
        .upsert(
          {
            integration_id: integration.id,
            app_user_id: appUserId,
            provider_id,
            portal_brand,
            portal_tenant: portal_tenant ?? null,
            status: "mock",
          },
          { onConflict: "app_user_id,provider_id,portal_brand" }
        )
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, mode: "mock", connection: data });
    }

    const resolvedFhirBaseUrl = resolveFhirBaseUrl(body);
    if (!resolvedFhirBaseUrl) {
      return NextResponse.json(
        { ok: false, error: "fhir_base_url is required for Epic connections" },
        { status: 400 }
      );
    }

    const epicEndpoints = await resolveEpicEndpoints(resolvedFhirBaseUrl);
    const clientId = getEpicClientId(resolvedFhirBaseUrl);

    if (!clientId) {
      return NextResponse.json(
        { ok: false, error: "EPIC_CLIENT_ID not configured" },
        { status: 500 }
      );
    }

    const callbackUrl = `${getBaseUrl(req)}/api/portal/callback`;
    const { verifier, challenge } = createPkcePair();

    const state = toBase64Url(
      JSON.stringify({
        app_user_id: appUserId,
        provider_id,
        portal_brand,
        portal_tenant: portal_tenant ?? null,
        fhir_base_url: resolvedFhirBaseUrl,
        org_name: org_name ?? null,
        pkce_verifier: verifier,
      })
    );

    const authorizeUrl = new URL(epicEndpoints.authorizeUrl);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizeUrl.searchParams.set(
      "scope",
      "launch/patient openid profile offline_access patient/Patient.read patient/Encounter.read patient/Condition.read patient/MedicationRequest.read"
    );
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("aud", epicEndpoints.fhirBaseUrl);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("code_challenge", challenge);

    const { error: pendingError } = await supabaseAdmin
      .from("portal_connections")
      .upsert(
        {
          integration_id: integration.id,
          app_user_id: appUserId,
          provider_id,
          portal_brand,
          portal_tenant: portal_tenant ?? null,
          fhir_base_url: resolvedFhirBaseUrl,
          org_name: org_name ?? null,
          status: "pending_auth",
        },
        { onConflict: "app_user_id,provider_id,portal_brand" }
      );

    if (pendingError) {
      return NextResponse.json(
        { ok: false, error: pendingError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "epic_oauth",
      authorize_url: authorizeUrl.toString(),
      callback_url: callbackUrl,
      org_name: org_name ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "portal_connect_failed";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}