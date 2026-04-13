export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";

// Common US state names and abbreviations for detecting location in queries
const STATE_PATTERNS = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|ALABAMA|ALASKA|ARIZONA|ARKANSAS|CALIFORNIA|COLORADO|CONNECTICUT|DELAWARE|FLORIDA|GEORGIA|HAWAII|IDAHO|ILLINOIS|INDIANA|IOWA|KANSAS|KENTUCKY|LOUISIANA|MAINE|MARYLAND|MASSACHUSETTS|MICHIGAN|MINNESOTA|MISSISSIPPI|MISSOURI|MONTANA|NEBRASKA|NEVADA|NEW HAMPSHIRE|NEW JERSEY|NEW MEXICO|NEW YORK|NORTH CAROLINA|NORTH DAKOTA|OHIO|OKLAHOMA|OREGON|PENNSYLVANIA|RHODE ISLAND|SOUTH CAROLINA|SOUTH DAKOTA|TENNESSEE|TEXAS|UTAH|VERMONT|VIRGINIA|WASHINGTON|WEST VIRGINIA|WISCONSIN|WYOMING)\b/i;

function splitNameAndLocation(query: string): { name: string; city: string | null; state: string | null } {
  const trimmed = query.trim();

  // Check if last word(s) might be a location
  const stateMatch = trimmed.match(STATE_PATTERNS);

  if (stateMatch) {
    const stateIdx = trimmed.toUpperCase().lastIndexOf(stateMatch[0].toUpperCase());
    const beforeState = trimmed.slice(0, stateIdx).trim().replace(/,\s*$/, "").trim();
    const state = stateMatch[1].toUpperCase();

    // Check if there's a city before the state
    const parts = beforeState.split(/\s+/);
    if (parts.length >= 2) {
      // Last word before state might be the city
      // Try to detect: "Be Well Mental Health Westport CT"
      // Heuristic: if the query had results before adding location words, the last 1-2 words before state are the city
      return { name: beforeState, city: null, state };
    }

    return { name: beforeState, city: null, state };
  }

  // No state detected — check if last word could be a city (we'll use it as a filter)
  const words = trimmed.split(/\s+/);
  if (words.length >= 3) {
    // Try both: full query as name, and also name-without-last-word + last word as city filter
    return { name: trimmed, city: words[words.length - 1], state: null };
  }

  return { name: trimmed, city: null, state: null };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }

  try {
    const { name, city, state } = splitNameAndLocation(query);

    // Split name into potential first/last
    const nameParts = name.split(" ").filter(Boolean);

    // Build NPI search URLs
    const searches: Promise<Response>[] = [];

    // Search 1: Organization name (full name query)
    const orgParams = new URLSearchParams({
      version: "2.1",
      organization_name: `${name}*`,
      limit: "10",
    });
    if (state) orgParams.set("state", state);
    if (city && !state) orgParams.set("city", `${city}*`);
    searches.push(fetch(`https://npiregistry.cms.hhs.gov/api/?${orgParams}`, { signal: AbortSignal.timeout(5000) }));

    // Search 2: Individual provider by name
    if (nameParts.length >= 2) {
      const indParams = new URLSearchParams({
        version: "2.1",
        first_name: `${nameParts[0]}*`,
        last_name: `${nameParts[nameParts.length - 1]}*`,
        limit: "5",
      });
      if (state) indParams.set("state", state);
      if (city && !state) indParams.set("city", `${city}*`);
      searches.push(fetch(`https://npiregistry.cms.hhs.gov/api/?${indParams}`, { signal: AbortSignal.timeout(5000) }));
    } else {
      // Single word — search as last name
      const indParams = new URLSearchParams({
        version: "2.1",
        last_name: `${nameParts[0]}*`,
        limit: "5",
      });
      if (state) indParams.set("state", state);
      if (city && !state) indParams.set("city", `${city}*`);
      searches.push(fetch(`https://npiregistry.cms.hhs.gov/api/?${indParams}`, { signal: AbortSignal.timeout(5000) }));
    }

    // If we detected a city without state, also try without city filter (broader search)
    if (city && !state) {
      const nameWithoutCity = nameParts.slice(0, -1).join(" ");
      if (nameWithoutCity.length >= 2) {
        // Search 3: Org name without city word + city as location filter
        const broadOrgParams = new URLSearchParams({
          version: "2.1",
          organization_name: `${nameWithoutCity}*`,
          city: `${city}*`,
          limit: "5",
        });
        searches.push(fetch(`https://npiregistry.cms.hhs.gov/api/?${broadOrgParams}`, { signal: AbortSignal.timeout(5000) }));

        // Search 4: Org name without city word (no location filter — just broader)
        const broadestParams = new URLSearchParams({
          version: "2.1",
          organization_name: `${nameWithoutCity}*`,
          limit: "5",
        });
        searches.push(fetch(`https://npiregistry.cms.hhs.gov/api/?${broadestParams}`, { signal: AbortSignal.timeout(5000) }));
      }
    }

    const responses = await Promise.all(searches);
    const allData = await Promise.all(responses.map((r) => r.json().catch(() => ({}))));

    const results: Array<{
      npi: string;
      name: string;
      specialty: string | null;
      phone: string | null;
      city: string | null;
      state: string | null;
    }> = [];

    const seen = new Set<string>();

    for (const data of allData) {
      for (const r of data.results || []) {
        if (seen.has(r.number)) continue;
        seen.add(r.number);

        let provName = "";
        if (r.basic?.first_name && r.basic?.last_name) {
          const prefix = r.basic.credential ? `${r.basic.credential} ` : "";
          provName = `${prefix}${r.basic.first_name} ${r.basic.last_name}`.trim();
        } else if (r.basic?.organization_name) {
          provName = r.basic.organization_name;
        } else {
          continue;
        }

        const taxonomy = r.taxonomies?.[0]?.desc || null;
        const location = (r.addresses || []).find((a: any) => a.address_purpose === "LOCATION") || r.addresses?.[0];

        let phone: string | null = null;
        if (location?.telephone_number) {
          const digits = location.telephone_number.replace(/\D/g, "");
          if (digits.length === 10) phone = `+1${digits}`;
          else if (digits.length === 11 && digits.startsWith("1")) phone = `+${digits}`;
        }

        results.push({
          npi: r.number,
          name: provName,
          specialty: taxonomy,
          phone,
          city: location?.city || null,
          state: location?.state || null,
        });
      }
    }

    // Sort: prioritize results matching the city if one was detected
    if (city) {
      const cityUpper = city.toUpperCase();
      results.sort((a, b) => {
        const aMatch = a.city?.toUpperCase().includes(cityUpper) ? 0 : 1;
        const bMatch = b.city?.toUpperCase().includes(cityUpper) ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    return NextResponse.json({ ok: true, results: results.slice(0, 15) });
  } catch (err) {
    console.error("[npi/search] error:", err);
    return NextResponse.json({ ok: true, results: [] });
  }
}
