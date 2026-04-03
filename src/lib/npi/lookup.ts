/**
 * NPI Registry lookup — checks if a name matches a licensed US healthcare provider.
 * Uses the free CMS NPI Registry API (no API key needed).
 * https://npiregistry.cms.hhs.gov/api-page
 */

type NpiResult = {
  found: boolean;
  provider_type: string | null;
  npi: string | null;
};

/**
 * Searches the NPI registry for a name. Works best with person names
 * (first + last) or organization names.
 */
export async function lookupNpi(name: string): Promise<NpiResult> {
  const cleaned = name.trim();
  if (!cleaned || cleaned.split(" ").length < 2) {
    return { found: false, provider_type: null, npi: null };
  }

  try {
    const parts = cleaned.split(" ");

    // Try individual provider first (person name)
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];

    const individualUrl = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&limit=1`;

    const res = await fetch(individualUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { found: false, provider_type: null, npi: null };

    const data = await res.json();

    if (data.result_count > 0) {
      const result = data.results[0];
      const taxonomy = result.taxonomies?.[0]?.desc || null;
      return {
        found: true,
        provider_type: taxonomy,
        npi: result.number || null,
      };
    }

    // Try organization name
    const orgUrl = `https://npiregistry.cms.hhs.gov/api/?version=2.1&organization_name=${encodeURIComponent(cleaned)}&limit=1`;
    const orgRes = await fetch(orgUrl, { signal: AbortSignal.timeout(5000) });
    if (!orgRes.ok) return { found: false, provider_type: null, npi: null };

    const orgData = await orgRes.json();

    if (orgData.result_count > 0) {
      const result = orgData.results[0];
      const taxonomy = result.taxonomies?.[0]?.desc || null;
      return {
        found: true,
        provider_type: taxonomy,
        npi: result.number || null,
      };
    }

    return { found: false, provider_type: null, npi: null };
  } catch {
    // Timeout or network error — don't block classification
    return { found: false, provider_type: null, npi: null };
  }
}

/**
 * Batch NPI lookup — checks multiple names in parallel.
 * Returns a Map of normalized_name → NpiResult.
 */
export async function batchNpiLookup(
  names: Array<{ normalized_name: string; original_name: string }>
): Promise<Map<string, NpiResult>> {
  const results = new Map<string, NpiResult>();

  // Run lookups in parallel (max 5 concurrent to be nice to the API)
  const CONCURRENCY = 5;
  for (let i = 0; i < names.length; i += CONCURRENCY) {
    const batch = names.slice(i, i + CONCURRENCY);
    const lookups = await Promise.all(
      batch.map(async (n) => ({
        key: n.normalized_name,
        result: await lookupNpi(n.original_name),
      }))
    );
    for (const { key, result } of lookups) {
      results.set(key, result);
    }
  }

  return results;
}
