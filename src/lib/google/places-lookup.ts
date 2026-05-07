/**
 * Uses Google Places API to find business phone numbers and addresses.
 * Requires GOOGLE_PLACES_API_KEY environment variable.
 *
 * Two flavors:
 *   lookupPlaceDetails(name, city?, state?)
 *     → single best confident match, or null. Used for paths that just
 *       want one answer.
 *   lookupPlaceCandidates(name, state?)
 *     → up to 5 confident name-matches in the user's state. Used by
 *       discovery so the user can pick from multiple if more than one
 *       legit practice has the same name.
 *
 * "Confident" = the place name contains all the significant words from
 * the provider name (with credentials and filler stripped). Catches
 * "Karen Nisenson" matching a search for "Megan Nisenson" — different
 * first names = reject.
 */

type PlaceLookupResult = {
  phone: string | null;
  address: string | null;
  placeName: string | null;
};

export type PlaceCandidate = {
  name: string;
  phone: string;
  address: string | null;
};

const NAME_STOP_WORDS = new Set([
  "the", "and", "of", "for", "a", "an", "&", "be", "in", "at", "to",
  "inc", "llc", "pc", "pllc", "pa", "plc", "group", "center", "associates",
  "practice", "office", "offices", "clinic", "md", "do", "dds", "dmd",
  "np", "lcsw", "lmft", "phd", "psyd", "mm", "ma", "mt", "bc", "rn", "fnp",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,()&/\\]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && w.length >= 3 && !NAME_STOP_WORDS.has(w));
}

/** Returns true if every significant token in providerName appears
 *  (as substring of any token) in placeName. Lets "pediatric" match
 *  "pediatrics" and "Modern Dermatology" match "Modern Dermatology of
 *  Westport" while rejecting "Karen Nisenson" for a "Megan Nisenson"
 *  search. */
export function namesMatchConfidently(providerName: string, placeName: string): boolean {
  const need = tokenize(providerName);
  const have = tokenize(placeName);
  if (need.length === 0) return false;
  for (const n of need) {
    const found = have.some((h) => h.includes(n) || n.includes(h));
    if (!found) return false;
  }
  return true;
}

function normalizePhoneE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone.replace(/[^\d+]/g, "");
  return null;
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<{ phone: string | null; address: string | null; name: string | null }> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,international_phone_number,formatted_address,name&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    const raw =
      data.result?.international_phone_number ||
      data.result?.formatted_phone_number;
    return {
      phone: raw ? normalizePhoneE164(raw) : null,
      address: data.result?.formatted_address || null,
      name: data.result?.name || null,
    };
  } catch {
    return { phone: null, address: null, name: null };
  }
}

/**
 * Returns up to `maxCandidates` confident name-matches in the user's
 * state, each with its phone + address. The Places `type=health`
 * filter is intentionally NOT applied — it excludes legitimate
 * practices that aren't categorized as "health" in Google's data.
 * Name validation provides the precision instead.
 */
export async function lookupPlaceCandidates(
  providerName: string,
  state?: string | null,
  maxCandidates = 5
): Promise<PlaceCandidate[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  try {
    const query = state ? `${providerName} ${state}` : providerName;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    const searchData = await searchRes.json();

    if (!searchData.results?.length) return [];

    // Filter to confident name matches first — usually drops 80% of
    // junk before we burn details lookups.
    const valid = searchData.results
      .filter((r: { name?: string; place_id?: string }) =>
        r.place_id && namesMatchConfidently(providerName, r.name || "")
      )
      .slice(0, maxCandidates);

    if (valid.length === 0) return [];

    // Hydrate phone + address per candidate (sequential — Places
    // doesn't love parallel detail calls and we cap at 5 anyway).
    const out: PlaceCandidate[] = [];
    for (const r of valid) {
      const detail = await fetchPlaceDetails(r.place_id, apiKey);
      if (detail.phone) {
        out.push({
          name: detail.name || r.name || providerName,
          phone: detail.phone,
          address: detail.address,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Single-best-match flavor — used by paths that don't surface a
 * candidate picker. Returns the first confident match with a phone.
 */
export async function lookupPlaceDetails(
  businessName: string,
  city?: string,
  state?: string
): Promise<PlaceLookupResult> {
  const candidates = await lookupPlaceCandidates(businessName, state || null, 1);
  if (candidates.length === 0) {
    return { phone: null, address: null, placeName: null };
  }
  const top = candidates[0];
  return { phone: top.phone, address: top.address, placeName: top.name };
}

/** Backwards-compatible wrapper used by build-provider-registry. */
export async function lookupPlacePhone(
  businessName: string,
  city?: string,
  state?: string
): Promise<string | null> {
  const result = await lookupPlaceDetails(businessName, city, state);
  return result.phone;
}
