// Look up NPI numbers for any provider rows that don't have one yet
// and update the row in place. Idempotent — safe to re-run.
//
// Usage:
//   source ~/.nvm/nvm.sh && node scripts/backfill-npi.mjs            (all users)
//   source ~/.nvm/nvm.sh && node scripts/backfill-npi.mjs <app_user_id>   (one user)

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

const NON_MEDICAL_TAXONOMIES = [
  "athletic trainer", "equipment supplier", "personal care",
  "nutritionist", "veterinar", "in home supportive care",
  "supportive care", "homemaker", "personal care attendant",
  "local education agency", "school", "massage therapist",
  "massage therapy", "aide", "assistant", "technician", "support staff",
];

function isMedicalTaxonomy(taxonomy) {
  if (!taxonomy) return false;
  const t = taxonomy.toLowerCase();
  for (const nc of NON_MEDICAL_TAXONOMIES) {
    if (t.includes(nc)) return false;
  }
  return true;
}

async function lookupNpi(name) {
  const cleaned = (name || "").trim();
  if (!cleaned || cleaned.split(" ").length < 2) return null;
  try {
    const parts = cleaned.split(" ");
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const indUrl = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&limit=1`;
    let res = await fetch(indUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.result_count > 0) {
        const r = data.results[0];
        const tax = r.taxonomies?.[0]?.desc || null;
        if (isMedicalTaxonomy(tax) && r.number) return r.number;
      }
    }
    const orgUrl = `https://npiregistry.cms.hhs.gov/api/?version=2.1&organization_name=${encodeURIComponent(cleaned)}&limit=1`;
    res = await fetch(orgUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.result_count > 0) {
        const r = data.results[0];
        const tax = r.taxonomies?.[0]?.desc || null;
        if (isMedicalTaxonomy(tax) && r.number) return r.number;
      }
    }
    return null;
  } catch {
    return null;
  }
}

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const filterUserId = process.argv[2] || null;
let q = supa
  .from("providers")
  .select("id, name, app_user_id, provider_type, status")
  .is("npi", null)
  .eq("status", "active");
if (filterUserId) q = q.eq("app_user_id", filterUserId);

const { data: rows, error } = await q;
if (error) {
  console.error("query failed:", error);
  process.exit(1);
}
console.log(`${rows.length} active providers without NPI${filterUserId ? ` for user ${filterUserId}` : ""}\n`);

let hits = 0;
let misses = 0;
for (const row of rows) {
  // Skip pharmacies and labs — usually big chains, NPI lookup
  // matches them but it's noise; keep this script focused on real
  // doctors/specialists.
  const skip = ["pharmacy", "urgent_care", "hospital", "lab", "imaging", "other_healthcare"];
  if (skip.includes(row.provider_type ?? "")) {
    console.log(`  skip ${row.name} (${row.provider_type})`);
    continue;
  }
  const npi = await lookupNpi(row.name);
  if (npi) {
    await supa.from("providers").update({ npi }).eq("id", row.id);
    console.log(`  ✓ ${row.name.padEnd(40)} → ${npi}`);
    hits++;
  } else {
    console.log(`  · ${row.name.padEnd(40)} (no NPI match)`);
    misses++;
  }
  // Be gentle to the NPI registry
  await new Promise((r) => setTimeout(r, 200));
}

console.log(`\ndone: ${hits} updated, ${misses} no match`);
process.exit(0);
