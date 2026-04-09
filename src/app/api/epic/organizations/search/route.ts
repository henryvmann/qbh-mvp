export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSandboxFhirBaseUrl } from "../../../../../lib/epic/endpoints";

type EpicEndpointEntry = {
  OrganizationName?: string;
  FHIRPatientFacingURI?: string;
};

type OrgResult = {
  name: string;
  fhirBaseUrl: string;
};

let cachedOrgs: OrgResult[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const EPIC_ENDPOINTS_URL =
  "https://open.epic.com/MyApps/EndpointsJson";

async function loadOrganizations(): Promise<OrgResult[]> {
  if (cachedOrgs && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedOrgs;
  }

  const res = await fetch(EPIC_ENDPOINTS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Epic endpoints fetch failed: ${res.status}`);
  }

  const raw: EpicEndpointEntry[] = await res.json();

  const orgs: OrgResult[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    const name = (entry.OrganizationName || "").trim();
    const fhirBaseUrl = (entry.FHIRPatientFacingURI || "").trim();

    if (!name || !fhirBaseUrl) continue;

    // Deduplicate by FHIR URL
    if (seen.has(fhirBaseUrl)) continue;
    seen.add(fhirBaseUrl);

    orgs.push({ name, fhirBaseUrl });
  }

  // Sort alphabetically
  orgs.sort((a, b) => a.name.localeCompare(b.name));

  cachedOrgs = orgs;
  cachedAt = Date.now();

  return orgs;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();

  if (!query || query.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }

  try {
    const orgs = await loadOrganizations();

    const terms = query.split(/\s+/);
    const filtered = orgs.filter((org) => {
      const lower = org.name.toLowerCase();
      return terms.every((term) => lower.includes(term));
    });

    const results = filtered.slice(0, 15);

    // In development, prepend sandbox option
    if (process.env.NODE_ENV === "development") {
      results.unshift({
        name: "Epic Sandbox (Development)",
        fhirBaseUrl: getSandboxFhirBaseUrl(),
      });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[epic/organizations/search] error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to search Epic organizations" },
      { status: 500 }
    );
  }
}
