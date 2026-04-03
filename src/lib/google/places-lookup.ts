/**
 * Uses Google Places API to find a business phone number.
 * Requires GOOGLE_PLACES_API_KEY environment variable.
 */
export async function lookupPlacePhone(
  businessName: string,
  city?: string,
  state?: string
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[places-lookup] GOOGLE_PLACES_API_KEY not set");
    return null;
  }

  try {
    const query =
      city && state ? `${businessName} ${city} ${state}` : businessName;

    // Use Places Text Search to find the place
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=health&key=${apiKey}`;
    const searchRes = await fetch(searchUrl, {
      signal: AbortSignal.timeout(5000),
    });
    const searchData = await searchRes.json();

    if (!searchData.results?.[0]?.place_id) return null;

    // Get place details including phone number
    const placeId = searchData.results[0].place_id;
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,international_phone_number&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl, {
      signal: AbortSignal.timeout(5000),
    });
    const detailsData = await detailsRes.json();

    const phone =
      detailsData.result?.international_phone_number ||
      detailsData.result?.formatted_phone_number;
    if (!phone) return null;

    // Normalize to E.164
    return normalizePhoneE164(phone);
  } catch {
    return null;
  }
}

function normalizePhoneE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone.replace(/[^\d+]/g, "");
  return null;
}
