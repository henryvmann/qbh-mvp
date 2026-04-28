/**
 * Uses Google Places API to find a business phone number and address.
 * Requires GOOGLE_PLACES_API_KEY environment variable.
 */

type PlaceLookupResult = {
  phone: string | null;
  address: string | null;
  placeName: string | null;
};

export async function lookupPlaceDetails(
  businessName: string,
  city?: string,
  state?: string
): Promise<PlaceLookupResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return { phone: null, address: null, placeName: null };
  }

  try {
    const query =
      city && state ? `${businessName} ${city} ${state}` : businessName;

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=health&key=${apiKey}`;
    const searchRes = await fetch(searchUrl, {
      signal: AbortSignal.timeout(5000),
    });
    const searchData = await searchRes.json();

    if (!searchData.results?.[0]?.place_id) return { phone: null, address: null, placeName: null };

    const topResult = searchData.results[0];
    const placeId = topResult.place_id;
    const placeName = topResult.name || null;

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,international_phone_number,formatted_address,name&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl, {
      signal: AbortSignal.timeout(5000),
    });
    const detailsData = await detailsRes.json();

    const phone =
      detailsData.result?.international_phone_number ||
      detailsData.result?.formatted_phone_number;
    const address = detailsData.result?.formatted_address || null;
    const detailedName = detailsData.result?.name || placeName;

    return {
      phone: phone ? normalizePhoneE164(phone) : null,
      address,
      placeName: detailedName,
    };
  } catch {
    return { phone: null, address: null, placeName: null };
  }
}

/** Backwards-compatible wrapper */
export async function lookupPlacePhone(
  businessName: string,
  city?: string,
  state?: string
): Promise<string | null> {
  const result = await lookupPlaceDetails(businessName, city, state);
  return result.phone;
}

function normalizePhoneE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone.replace(/[^\d+]/g, "");
  return null;
}
