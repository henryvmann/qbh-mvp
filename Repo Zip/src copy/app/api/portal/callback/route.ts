import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

type CallbackState = {
  user_id?: string;
  provider_id?: string;
  portal_brand?: string;
  portal_tenant?: string | null;
  pkce_verifier?: string;
};

type EpicTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  patient?: string;
  error?: string;
  error_description?: string;
};

type EpicTokenConfig = {
  tokenEndpoint: string;
  clientId: string;
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

function dashboardHref(userId: string): string {
  return `/dashboard?user_id=${encodeURIComponent(userId)}`;
}

function parseState(rawState: string): CallbackState | null {
  try {
    return JSON.parse(Buffer.from(rawState, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function computeExpiresAt(expiresIn?: number): string | null {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function getEpicTokenConfig(portalTenant?: string | null): EpicTokenConfig {
  const tenant = String(portalTenant || "").trim().toLowerCase();

  if (tenant === "stamford" || tenant === "stamford_health") {
    return {
      tokenEndpoint:
        (process.env.EPIC_STAMFORD_TOKEN_URL || "").trim() ||
        "https://epicproxy.et1378.epichosted.com/APIProxyPRD/oauth2/token",
      clientId: (process.env.EPIC_STAMFORD_CLIENT_ID || "").trim(),
    };
  }

  return {
    tokenEndpoint:
      (process.env.EPIC_SANDBOX_TOKEN_URL || "").trim() ||
      "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
    clientId: (process.env.EPIC_SANDBOX_CLIENT_ID || "").trim(),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const code = (url.searchParams.get("code") || "").trim();
  const state = (url.searchParams.get("state") || "").trim();
  const error = (url.searchParams.get("error") || "").trim();
  const errorDescription = (
    url.searchParams.get("error_description") || ""
  ).trim();

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/connect?portal_error=${encodeURIComponent(
          errorDescription || error
        )}`,
        url.origin
      )
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { ok: false, error: "missing_code_or_state" },
      { status: 400 }
    );
  }

  const decoded = parseState(state);

  if (!decoded) {
    return NextResponse.json(
      { ok: false, error: "invalid_state" },
      { status: 400 }
    );
  }

  const userId = String(decoded.user_id || "").trim();
  const providerId = String(decoded.provider_id || "").trim();
  const portalBrand = String(decoded.portal_brand || "").trim();
  const portalTenant = decoded.portal_tenant ?? null;
  const pkceVerifier = String(decoded.pkce_verifier || "").trim();

  if (!userId || !providerId || !portalBrand || !pkceVerifier) {
    return NextResponse.json(
      { ok: false, error: "invalid_state_payload" },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const callbackUrl = `${getBaseUrl(req)}/api/portal/callback`;
  const epicConfig = getEpicTokenConfig(portalTenant);

  if (!epicConfig.clientId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          portalTenant === "stamford" || portalTenant === "stamford_health"
            ? "EPIC_STAMFORD_CLIENT_ID not set"
            : "EPIC_SANDBOX_CLIENT_ID not set",
      },
      { status: 500 }
    );
  }

  const tokenBody = new URLSearchParams();
  tokenBody.set("grant_type", "authorization_code");
  tokenBody.set("code", code);
  tokenBody.set("redirect_uri", callbackUrl);
  tokenBody.set("client_id", epicConfig.clientId);
  tokenBody.set("code_verifier", pkceVerifier);

  const tokenRes = await fetch(epicConfig.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: tokenBody.toString(),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as EpicTokenResponse;

  if (!tokenRes.ok || !tokenJson.access_token) {
    const msg =
      tokenJson.error_description ||
      tokenJson.error ||
      `token_exchange_failed_${tokenRes.status}`;

    return NextResponse.redirect(
      new URL(`/connect?portal_error=${encodeURIComponent(msg)}`, url.origin)
    );
  }

  const tokenExpiresAt = computeExpiresAt(tokenJson.expires_in);

  const { error: upsertError } = await supabaseAdmin
    .from("portal_connections")
    .upsert(
      {
        user_id: userId,
        provider_id: providerId,
        portal_brand: portalBrand,
        portal_tenant: portalTenant,
        status: "connected",
        last_sync_at: nowIso,
        access_token: tokenJson.access_token ?? null,
        refresh_token: tokenJson.refresh_token ?? null,
        token_expires_at: tokenExpiresAt,
        token_scope: tokenJson.scope ?? null,
        token_type: tokenJson.token_type ?? null,
      },
      { onConflict: "user_id,provider_id,portal_brand" }
    );

  if (upsertError) {
    return NextResponse.json(
      { ok: false, error: upsertError.message },
      { status: 500 }
    );
  }

  const facts = [
    {
      user_id: userId,
      provider_id: providerId,
      fact_type: "portal_connected",
      fact_date: nowIso.slice(0, 10),
      fact_json: {
        title: "Portal connected",
        portal: portalBrand,
        connected_at: nowIso,
        oauth_code_received: true,
      },
      source: "portal",
    },
    {
      user_id: userId,
      provider_id: providerId,
      fact_type: "portal_token_received",
      fact_date: nowIso.slice(0, 10),
      fact_json: {
        title: "Portal token received",
        portal: portalBrand,
        token_type: tokenJson.token_type ?? null,
        scope: tokenJson.scope ?? null,
        expires_in: tokenJson.expires_in ?? null,
        patient: tokenJson.patient ?? null,
        received_at: nowIso,
      },
      source: "portal",
    },
  ];

  const { error: factError } = await supabaseAdmin
    .from("portal_facts")
    .insert(facts);

  if (factError) {
    return NextResponse.json(
      { ok: false, error: factError.message },
      { status: 500 }
    );
  }

  return NextResponse.redirect(new URL(dashboardHref(userId), url.origin));
}