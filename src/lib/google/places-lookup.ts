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

const STATE_CODE_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
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
 * area, each with its phone + address. The Places `type=health`
 * filter is intentionally NOT applied — it excludes legitimate
 * practices that aren't categorized as "health" in Google's data.
 * Name validation + state-in-address validation provide precision.
 *
 * Pass `zip` when you have it — including a zip in the search query
 * gives much more local results than a state code alone. State is
 * still used to validate results post-search.
 */
export async function lookupPlaceCandidates(
  providerName: string,
  state?: string | null,
  maxCandidates = 5,
  zip?: string | null
): Promise<PlaceCandidate[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  try {
    // Prefer zip in the query — "Modern Dermatology 06880" gives
    // dramatically more local results than "Modern Dermatology CT".
    const locHint = zip || state || "";
    const query = locHint ? `${providerName} ${locHint}` : providerName;
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

    // Hydrate phone + address per candidate in parallel.
    const detailed = await Promise.all(
      valid.map(async (r: { place_id: string; name?: string }) => {
        const detail = await fetchPlaceDetails(r.place_id, apiKey);
        if (!detail.phone) return null;
        return {
          name: detail.name || r.name || providerName,
          phone: detail.phone,
          address: detail.address,
        };
      })
    );
    let results = detailed.filter((c): c is PlaceCandidate => c !== null);

    // State-in-address validation. Even with state/zip in the query,
    // Google sometimes returns an out-of-state result that name-matches.
    // ("Modern Dermatology" → MD practice for a CT user.) Reject any
    // candidate whose formatted_address doesn't include the user's
    // state code (or full state name).
    if (state && results.length > 0) {
      const stateCode = state.toUpperCase();
      const stateName = STATE_CODE_TO_NAME[stateCode];
      const filtered = results.filter((c) => {
        if (!c.address) return false;
        const upper = c.address.toUpperCase();
        if (upper.includes(`, ${stateCode} `) || upper.endsWith(`, ${stateCode}`) || upper.includes(`, ${stateCode},`)) return true;
        if (stateName && upper.includes(stateName.toUpperCase())) return true;
        return false;
      });
      // If filtering wiped everything, fall back to original — better
      // a candidate the user can confirm/reject than nothing at all.
      results = filtered.length > 0 ? filtered : results;
    }

    return results;
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

/**
 * Searches Google Places for businesses near the user — no strict name
 * validation, just nearest results for the given query + location. Used
 * by Kate chat for "find pharmacies near me" style asks where the user
 * isn't naming a specific business. Always pass a zip if you have one
 * — without it Places falls back to the IP geolocation of the caller
 * (us, on Vercel) and returns results in Iowa.
 */
export type NearbyPlace = {
  name: string;
  phone: string | null;
  address: string | null;
};

export async function searchPlacesNearby(
  query: string,
  zip: string,
  maxResults = 5
): Promise<NearbyPlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !zip) return [];

  try {
    const fullQuery = `${query} near ${zip}`;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(fullQuery)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    const searchData = await searchRes.json();
    if (!searchData.results?.length) return [];

    const top = searchData.results.slice(0, maxResults);
    const detailed = await Promise.all(
      top.map(async (r: { place_id?: string; name?: string; formatted_address?: string }) => {
        if (!r.place_id) return null;
        const detail = await fetchPlaceDetails(r.place_id, apiKey);
        return {
          name: detail.name || r.name || "Unknown",
          phone: detail.phone,
          address: detail.address || r.formatted_address || null,
        };
      })
    );
    return detailed.filter((c): c is NearbyPlace => c !== null);
  } catch {
    return [];
  }
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
