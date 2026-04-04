export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }

  try {
    // Split query into potential first/last name
    const parts = query.split(" ").filter(Boolean);
    let npiUrl: string;

    if (parts.length >= 2) {
      // Search as person name
      npiUrl = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(parts[0])}*&last_name=${encodeURIComponent(parts[parts.length - 1])}*&limit=10`;
    } else {
      // Search as last name or organization
      npiUrl = `https://npiregistry.cms.hhs.gov/api/?version=2.1&last_name=${encodeURIComponent(parts[0])}*&limit=5`;
    }

    const [individualRes, orgRes] = await Promise.all([
      fetch(npiUrl, { signal: AbortSignal.timeout(5000) }),
      fetch(`https://npiregistry.cms.hhs.gov/api/?version=2.1&organization_name=${encodeURIComponent(query)}*&limit=5`, { signal: AbortSignal.timeout(5000) }),
    ]);

    const individualData = await individualRes.json();
    const orgData = await orgRes.json();

    const results: Array<{
      npi: string;
      name: string;
      specialty: string | null;
      phone: string | null;
      city: string | null;
      state: string | null;
    }> = [];

    const seen = new Set<string>();

    for (const r of [...(individualData.results || []), ...(orgData.results || [])]) {
      if (seen.has(r.number)) continue;
      seen.add(r.number);

      // Build display name
      let name = "";
      if (r.basic?.first_name && r.basic?.last_name) {
        const prefix = r.basic.credential ? `${r.basic.credential} ` : "";
        name = `${prefix}${r.basic.first_name} ${r.basic.last_name}`.trim();
      } else if (r.basic?.organization_name) {
        name = r.basic.organization_name;
      } else {
        continue;
      }

      const taxonomy = r.taxonomies?.[0]?.desc || null;
      const location = (r.addresses || []).find((a: any) => a.address_purpose === "LOCATION") || r.addresses?.[0];

      // Format phone
      let phone: string | null = null;
      if (location?.telephone_number) {
        const digits = location.telephone_number.replace(/\D/g, "");
        if (digits.length === 10) phone = `+1${digits}`;
        else if (digits.length === 11 && digits.startsWith("1")) phone = `+${digits}`;
      }

      results.push({
        npi: r.number,
        name,
        specialty: taxonomy,
        phone,
        city: location?.city || null,
        state: location?.state || null,
      });
    }

    return NextResponse.json({ ok: true, results: results.slice(0, 10) });
  } catch (err) {
    console.error("[npi/search] error:", err);
    return NextResponse.json({ ok: true, results: [] });
  }
}
