/**
 * Dynamic Epic FHIR endpoint resolution.
 *
 * Instead of hardcoding per-tenant URLs, this module resolves authorize/token
 * endpoints from any Epic organization's FHIR base URL using the SMART on FHIR
 * well-known configuration endpoint.
 */

export type EpicEndpoints = {
  fhirBaseUrl: string;
  authorizeUrl: string;
  tokenEndpoint: string;
};

type CachedEndpoints = {
  endpoints: EpicEndpoints;
  fetchedAt: number;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const endpointCache = new Map<string, CachedEndpoints>();

const SANDBOX_FHIR_BASE =
  "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";

/**
 * Returns the single production client ID for Epic on FHIR.
 * In development, returns the sandbox client ID when the FHIR base URL
 * points to Epic's sandbox environment.
 */
export function getEpicClientId(fhirBaseUrl?: string): string {
  const isSandbox = fhirBaseUrl?.includes("fhir.epic.com/interconnect-fhir-oauth");

  if (isSandbox) {
    const sandboxId = (process.env.EPIC_SANDBOX_CLIENT_ID || "").trim();
    if (sandboxId) return sandboxId;
  }

  const productionId = (process.env.EPIC_CLIENT_ID || "").trim();
  if (productionId) return productionId;

  // Legacy fallback
  return (process.env.EPIC_STAMFORD_CLIENT_ID || "").trim();
}

/**
 * Resolve OAuth authorize + token endpoints for an Epic FHIR base URL
 * using the SMART on FHIR .well-known/smart-configuration endpoint.
 *
 * Results are cached for 1 hour per FHIR base URL.
 */
export async function resolveEpicEndpoints(
  fhirBaseUrl: string
): Promise<EpicEndpoints> {
  const normalizedUrl = fhirBaseUrl.replace(/\/+$/, "");

  // Check cache
  const cached = endpointCache.get(normalizedUrl);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.endpoints;
  }

  // Try .well-known/smart-configuration (FHIR spec standard)
  const wellKnownUrl = `${normalizedUrl}/.well-known/smart-configuration`;

  try {
    const res = await fetch(wellKnownUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const config = await res.json();
      const authorizeUrl = config.authorization_endpoint;
      const tokenEndpoint = config.token_endpoint;

      if (authorizeUrl && tokenEndpoint) {
        const endpoints: EpicEndpoints = {
          fhirBaseUrl: normalizedUrl,
          authorizeUrl,
          tokenEndpoint,
        };
        endpointCache.set(normalizedUrl, {
          endpoints,
          fetchedAt: Date.now(),
        });
        return endpoints;
      }
    }
  } catch {
    // Fall through to heuristic
  }

  // Fallback: derive OAuth URLs from FHIR base URL pattern.
  // Epic FHIR URLs follow: .../api/FHIR/R4
  // OAuth URLs follow:     .../oauth2/authorize and .../oauth2/token
  const basePrefix = normalizedUrl.replace(/\/api\/FHIR\/R4\/?$/i, "");
  const endpoints: EpicEndpoints = {
    fhirBaseUrl: normalizedUrl,
    authorizeUrl: `${basePrefix}/oauth2/authorize`,
    tokenEndpoint: `${basePrefix}/oauth2/token`,
  };

  endpointCache.set(normalizedUrl, {
    endpoints,
    fetchedAt: Date.now(),
  });

  return endpoints;
}

/**
 * Helper that returns sandbox endpoints for development/testing.
 */
export function getSandboxFhirBaseUrl(): string {
  return (
    (process.env.EPIC_SANDBOX_FHIR_BASE_URL || "").trim() || SANDBOX_FHIR_BASE
  );
}
