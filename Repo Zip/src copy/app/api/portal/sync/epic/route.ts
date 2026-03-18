import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-server";

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

function getEpicFhirBaseUrl(portalTenant?: string | null): string {
  const tenant = String(portalTenant || "").trim().toLowerCase();

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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { provider_id, portal_brand } = body ?? {};

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

  const { data: connection, error: connectionError } = await supabaseAdmin
    .from("portal_connections")
    .select(
      "user_id, provider_id, portal_brand, portal_tenant, access_token, token_expires_at, status"
    )
    .eq("user_id", userId)
    .eq("provider_id", provider_id)
    .eq("portal_brand", portal_brand)
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

  const fhirBaseUrl = getEpicFhirBaseUrl(connection.portal_tenant);

  const { data: tokenFact, error: tokenFactError } = await supabaseAdmin
    .from("portal_facts")
    .select("fact_json, created_at")
    .eq("user_id", userId)
    .eq("provider_id", provider_id)
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
    user_id: userId,
    provider_id,
    fact_type: "patient_demographics",
    fact_date: nowIso.slice(0, 10),
    fact_json: {
      title: "Patient demographics synced",
      portal: portal_brand,
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
    })
    .eq("user_id", userId)
    .eq("provider_id", provider_id)
    .eq("portal_brand", portal_brand);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    synced: {
      resource: "Patient",
      display_name: patientDisplayName(patient),
      patient_id: patient.id || null,
    },
  });
}