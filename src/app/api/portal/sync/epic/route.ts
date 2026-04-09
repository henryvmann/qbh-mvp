export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-server";

type SyncEpicBody = {
  app_user_id?: string;
  provider_id?: string;
  portal_brand?: string;
};

type EpicPatientResource = {
  resourceType?: string;
  id?: string;
  name?: Array<{
    given?: string[];
    family?: string;
    text?: string;
  }>;
  birthDate?: string;
  gender?: string;
};

function patientDisplayName(patient: EpicPatientResource): string {
  const first = patient.name?.[0];
  if (!first) return "Unknown patient";

  if (first.text && first.text.trim()) return first.text.trim();

  const given = Array.isArray(first.given) ? first.given.join(" ").trim() : "";
  const family = (first.family || "").trim();
  const combined = `${given} ${family}`.trim();

  return combined || "Unknown patient";
}

/** Resolve FHIR base URL: prefer stored fhir_base_url, fall back to legacy portal_tenant. */
function resolveFhirBaseUrl(connection: Record<string, any>): string {
  if (connection.fhir_base_url?.trim()) return connection.fhir_base_url.trim();

  // Legacy fallback
  const tenant = String(connection.portal_tenant || "").trim().toLowerCase();
  if (tenant === "stamford" || tenant === "stamford_health") {
    return (
      (process.env.EPIC_STAMFORD_FHIR_BASE_URL || "").trim() ||
      "https://epicproxy.et1378.epichosted.com/APIProxyPRD/api/FHIR/R4"
    );
  }
  return (
    (process.env.EPIC_SANDBOX_FHIR_BASE_URL || "").trim() ||
    "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"
  );
}

async function requireAppUser(appUserId: string): Promise<void> {
  const cleanedAppUserId = String(appUserId || "").trim();

  if (!cleanedAppUserId) {
    throw new Error("Missing app_user_id");
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("id", cleanedAppUserId)
    .single();

  if (error || !data?.id) {
    throw new Error("Invalid app_user_id");
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as SyncEpicBody;
  const providerId = String(body?.provider_id || "").trim();
  const portalBrand = String(body?.portal_brand || "").trim();
  const appUserId =
    String(body?.app_user_id || "").trim() ||
    String(process.env.QBH_DEMO_USER_ID || "").trim();

  if (!providerId || !portalBrand) {
    return NextResponse.json(
      { ok: false, error: "provider_id and portal_brand are required" },
      { status: 400 }
    );
  }

  if (!appUserId) {
    return NextResponse.json(
      { ok: false, error: "app_user_id is required" },
      { status: 400 }
    );
  }

  try {
    await requireAppUser(appUserId);

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("portal_connections")
      .select(
        "integration_id, app_user_id, provider_id, portal_brand, portal_tenant, fhir_base_url, access_token, token_expires_at, status"
      )
      .eq("app_user_id", appUserId)
      .eq("provider_id", providerId)
      .eq("portal_brand", portalBrand)
      .maybeSingle();

    if (connectionError) {
      return NextResponse.json(
        { ok: false, error: connectionError.message },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        { ok: false, error: "portal_connection_not_found" },
        { status: 404 }
      );
    }

    if (!connection.access_token) {
      return NextResponse.json(
        { ok: false, error: "missing_access_token" },
        { status: 400 }
      );
    }

    const fhirBaseUrl = resolveFhirBaseUrl(connection);

    const { data: tokenFact, error: tokenFactError } = await supabaseAdmin
      .from("portal_facts")
      .select("fact_json, created_at")
      .eq("app_user_id", appUserId)
      .eq("provider_id", providerId)
      .eq("fact_type", "portal_token_received")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenFactError) {
      return NextResponse.json(
        { ok: false, error: tokenFactError.message },
        { status: 500 }
      );
    }

    const patientId = String(tokenFact?.fact_json?.patient || "").trim();

    if (!patientId) {
      return NextResponse.json(
        { ok: false, error: "missing_patient_id_from_token_context" },
        { status: 400 }
      );
    }

    const patientUrl = `${fhirBaseUrl}/Patient/${encodeURIComponent(patientId)}`;

    const patientRes = await fetch(patientUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        Accept: "application/fhir+json, application/json",
      },
    });

    const patientJson = await patientRes.json().catch(() => ({} as any));

    if (!patientRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "epic_patient_fetch_failed",
          status_code: patientRes.status,
          details: patientJson,
        },
        { status: 502 }
      );
    }

    const patient = patientJson as EpicPatientResource;

    if (!patient || patient.resourceType !== "Patient") {
      return NextResponse.json(
        { ok: false, error: "patient_resource_not_found", details: patientJson },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();

    const fact = {
      app_user_id: appUserId,
      provider_id: providerId,
      fact_type: "patient_demographics",
      fact_date: nowIso.slice(0, 10),
      fact_json: {
        title: "Patient demographics synced",
        portal: portalBrand,
        patient_id: patient.id || null,
        display_name: patientDisplayName(patient),
        birth_date: patient.birthDate || null,
        gender: patient.gender || null,
        resource_type: patient.resourceType || null,
        synced_at: nowIso,
      },
      source: "portal",
    };

    const { error: insertError } = await supabaseAdmin
      .from("portal_facts")
      .insert([fact]);

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("portal_connections")
      .update({
        last_sync_at: nowIso,
        status: "connected",
      })
      .eq("app_user_id", appUserId)
      .eq("provider_id", providerId)
      .eq("portal_brand", portalBrand);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    if (connection.integration_id) {
      const { error: integrationUpdateError } = await supabaseAdmin
        .from("integrations")
        .update({
          status: "connected",
          updated_at: nowIso,
        })
        .eq("id", connection.integration_id);

      if (integrationUpdateError) {
        return NextResponse.json(
          { ok: false, error: integrationUpdateError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      synced: {
        resource: "Patient",
        display_name: patientDisplayName(patient),
        patient_id: patient.id || null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "portal_epic_sync_failed";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}