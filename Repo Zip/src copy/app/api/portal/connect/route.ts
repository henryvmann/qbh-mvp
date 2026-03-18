import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

type ConnectBody = {
  provider_id?: string;
  portal_brand?: string;
  portal_tenant?: string | null;
  mode?: string;
};

type EpicPortalConfig = {
  authorizeUrl: string;
  clientId: string;
  fhirBaseUrl: string;
  modeLabel: string;
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

function getEpicPortalConfig(portalTenant?: string | null): EpicPortalConfig {
  const tenant = String(portalTenant || "").trim().toLowerCase();

  if (tenant === "stamford" || tenant === "stamford_health") {
    const authorizeUrl =
      (process.env.EPIC_STAMFORD_AUTHORIZE_URL || "").trim() ||
      "https://epicproxy.et1378.epichosted.com/APIProxyPRD/oauth2/authorize";

    const clientId = (process.env.EPIC_STAMFORD_CLIENT_ID || "").trim();

    const fhirBaseUrl =
      (process.env.EPIC_STAMFORD_FHIR_BASE_URL || "").trim() ||
      "https://epicproxy.et1378.epichosted.com/APIProxyPRD/api/FHIR/R4";

    return {
      authorizeUrl,
      clientId,
      fhirBaseUrl,
      modeLabel: "stamford_auth",
    };
  }

  const authorizeUrl =
    (process.env.EPIC_SANDBOX_AUTHORIZE_URL || "").trim() ||
    "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize";

  const clientId = (process.env.EPIC_SANDBOX_CLIENT_ID || "").trim();

  const fhirBaseUrl =
    (process.env.EPIC_SANDBOX_FHIR_BASE_URL || "").trim() ||
    "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";

  return {
    authorizeUrl,
    clientId,
    fhirBaseUrl,
    modeLabel: "sandbox_auth",
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ConnectBody;
  const { provider_id, portal_brand, portal_tenant, mode } = body ?? {};

  if (!provider_id || !portal_brand) {
    return NextResponse.json(
      { ok: false, error: "provider_id and portal_brand are required" },
      { status: 400 }
    );
  }

  const userId = (process.env.QBH_DEMO_USER_ID || "").trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "QBH_DEMO_USER_ID not set" },
      { status: 500 }
    );
  }

  if (mode === "mock") {
    const { data, error } = await supabaseAdmin
      .from("portal_connections")
      .upsert(
        {
          user_id: userId,
          provider_id,
          portal_brand,
          portal_tenant: portal_tenant ?? null,
          status: "mock",
        },
        { onConflict: "user_id,provider_id,portal_brand" }
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

  const callbackUrl = `${getBaseUrl(req)}/api/portal/callback`;
  const { verifier, challenge } = createPkcePair();

  const state = toBase64Url(
    JSON.stringify({
      user_id: userId,
      provider_id,
      portal_brand,
      portal_tenant: portal_tenant ?? null,
      pkce_verifier: verifier,
    })
  );

  const epicConfig = getEpicPortalConfig(portal_tenant);

  if (!epicConfig.clientId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          portal_tenant === "stamford" || portal_tenant === "stamford_health"
            ? "EPIC_STAMFORD_CLIENT_ID not set"
            : "EPIC_SANDBOX_CLIENT_ID not set",
      },
      { status: 500 }
    );
  }

  const authorizeUrl = new URL(epicConfig.authorizeUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", epicConfig.clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
authorizeUrl.searchParams.set(
  "scope",
  "launch/patient openid profile offline_access patient/Patient.read patient/Encounter.read patient/Condition.read patient/MedicationRequest.read"
);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("aud", epicConfig.fhirBaseUrl);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", challenge);

  await supabaseAdmin.from("portal_connections").upsert(
    {
      user_id: userId,
      provider_id,
      portal_brand,
      portal_tenant: portal_tenant ?? null,
      status: "pending_auth",
    },
    { onConflict: "user_id,provider_id,portal_brand" }
  );

  return NextResponse.json({
    ok: true,
    mode: epicConfig.modeLabel,
    authorize_url: authorizeUrl.toString(),
    callback_url: callbackUrl,
  });
}