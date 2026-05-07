// Backfill missing phone numbers on active providers using Google Places.
//
// Loops every active, non-pharmacy, non-calendar provider that's missing
// a phone_number and tries Places. If we get a hit, updates the row.
//
// Usage:
//   node scripts/backfill-places-phones.mjs            # write changes
//   node scripts/backfill-places-phones.mjs --dry-run  # preview only
//   node scripts/backfill-places-phones.mjs --user <app_user_id>  # one user only
//
// Pulls user state from app_users.patient_profile.zip when available so
// the search query is "<provider> <city> <state>" — much higher hit rate
// than a global lookup that returns a random same-named practice.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const dryRun = process.argv.includes("--dry-run");
const userArgIdx = process.argv.indexOf("--user");
const onlyUserId = userArgIdx >= 0 ? process.argv[userArgIdx + 1] : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}
if (!PLACES_KEY) {
  console.error("GOOGLE_PLACES_API_KEY is empty or missing — set it in .env.local first");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// Crude state-from-zip table for the most common ones — Google's lookup is
// already pretty forgiving when given just the state, so we don't need
// city-level precision. If we don't have a zip, we'll search globally.
function stateFromZip(zip) {
  if (!zip) return null;
  const n = parseInt(String(zip).slice(0, 3), 10);
  if (Number.isNaN(n)) return null;
  // Rough US Census zip-prefix → state map (covers the common ones)
  const ranges = [
    [["010", "027"], "MA"], [["028", "029"], "RI"], [["030", "038"], "NH"],
    [["039", "049"], "ME"], [["050", "059"], "VT"], [["060", "069"], "CT"],
    [["070", "089"], "NJ"], [["100", "149"], "NY"],
    [["150", "196"], "PA"], [["197", "199"], "DE"], [["200", "205"], "DC"],
    [["206", "219"], "MD"], [["220", "246"], "VA"], [["247", "268"], "WV"],
    [["270", "289"], "NC"], [["290", "299"], "SC"], [["300", "319"], "GA"],
    [["320", "349"], "FL"], [["350", "369"], "AL"], [["370", "385"], "TN"],
    [["386", "397"], "MS"], [["400", "427"], "KY"], [["430", "459"], "OH"],
    [["460", "479"], "IN"], [["480", "499"], "MI"], [["500", "528"], "IA"],
    [["530", "549"], "WI"], [["550", "567"], "MN"], [["570", "577"], "SD"],
    [["580", "588"], "ND"], [["590", "599"], "MT"], [["600", "629"], "IL"],
    [["630", "658"], "MO"], [["660", "679"], "KS"], [["680", "693"], "NE"],
    [["700", "714"], "LA"], [["716", "729"], "AR"], [["730", "749"], "OK"],
    [["750", "799"], "TX"], [["800", "816"], "CO"], [["820", "831"], "WY"],
    [["832", "838"], "ID"], [["840", "847"], "UT"], [["850", "865"], "AZ"],
    [["870", "884"], "NM"], [["889", "898"], "NV"], [["900", "961"], "CA"],
    [["970", "979"], "OR"], [["980", "994"], "WA"], [["995", "999"], "AK"],
    [["967", "968"], "HI"],
  ];
  for (const [[from, to], state] of ranges) {
    if (n >= parseInt(from, 10) && n <= parseInt(to, 10)) return state;
  }
  return null;
}

// Reject matches where the place name doesn't include all significant
// words from the provider name. Catches cases like:
//   "Megan Nisenson" → "Karen Nisenson" (different first name)
//   "Elizabeth Seckler" → "Elizabeth Lacy" (different last name)
//   "Be Well Mental Health" → "Liv Well Behavioral Health" (different keywords)
// Common business/filler words and credentials are stripped before
// comparison so "Pediatrics" can match "Pediatric Group" etc.
function namesMatchConfidently(providerName, placeName) {
  const stop = new Set([
    "the", "and", "of", "for", "a", "an", "&", "be", "in", "at", "to",
    "inc", "llc", "pc", "pllc", "pa", "plc", "group", "center", "associates",
    "practice", "office", "offices", "clinic", "md", "do", "dds", "dmd",
    "np", "pa", "lcsw", "lmft", "phd", "psyd", "mm", "ma", "mt", "bc",
    "rn", "fnp",
  ]);
  function toks(s) {
    return s
      .toLowerCase()
      .replace(/[.,()&/\\]+/g, " ")
      .split(/\s+/)
      .filter((w) => w && w.length >= 3 && !stop.has(w));
  }
  const need = toks(providerName);
  const have = toks(placeName);
  if (need.length === 0) return false;
  // Every significant provider token must appear (as a substring of any
  // place token) — substring lets "pediatric" match "pediatrics".
  for (const n of need) {
    const found = have.some((h) => h.includes(n) || n.includes(h));
    if (!found) return false;
  }
  return true;
}

async function lookupPlace(name, state) {
  const query = state ? `${name} ${state}` : name;
  // type=health filter often excludes legitimate practices; drop it for
  // wider recall. The provider names already came from healthcare-classified
  // sources, so false positives are unlikely.
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${PLACES_KEY}`;
  let searchData;
  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    searchData = await res.json();
  } catch (err) {
    return { phone: null, error: `search-failed: ${err.message}` };
  }
  if (searchData.status === "REQUEST_DENIED") {
    return { phone: null, error: `denied: ${searchData.error_message || "(no message)"}` };
  }
  if (!searchData.results?.[0]?.place_id) {
    return { phone: null, error: "no-results" };
  }
  // Walk the top results until we find one whose name matches the
  // provider name well enough to be confident. Top result isn't always
  // the best — Google sometimes promotes paid/popular listings.
  const candidates = searchData.results.slice(0, 5);
  const matched = candidates.find((r) => namesMatchConfidently(name, r.name || ""));
  if (!matched) {
    return { phone: null, error: `name-mismatch: top-was "${candidates[0]?.name || "?"}"` };
  }
  const placeId = matched.place_id;
  const placeName = matched.name;

  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,international_phone_number,formatted_address,name&key=${PLACES_KEY}`;
  let detailsData;
  try {
    const res = await fetch(detailsUrl, { signal: AbortSignal.timeout(8000) });
    detailsData = await res.json();
  } catch (err) {
    return { phone: null, error: `details-failed: ${err.message}` };
  }
  const raw = detailsData.result?.international_phone_number || detailsData.result?.formatted_phone_number;
  if (!raw) return { phone: null, error: "no-phone-on-place", placeName };
  const digits = raw.replace(/\D/g, "");
  let e164 = null;
  if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) e164 = `+${digits}`;
  else if (raw.startsWith("+")) e164 = raw.replace(/[^\d+]/g, "");
  return {
    phone: e164,
    placeName,
    address: detailsData.result?.formatted_address || null,
  };
}

// Simple concurrency limiter
async function runConcurrent(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

// Pull users so we can map app_user_id → state
const { data: users } = await sb
  .from("app_users")
  .select("id, patient_profile");
const stateByUser = new Map();
for (const u of users || []) {
  const zip = u.patient_profile?.zip || u.patient_profile?.zip_code || null;
  stateByUser.set(u.id, stateFromZip(zip));
}

// Find candidates — active, healthcare, no phone, not the calendar stub
let q = sb
  .from("providers")
  .select("id, name, app_user_id, source, provider_type, phone_number, address")
  .eq("status", "active")
  .is("phone_number", null)
  .neq("provider_type", "pharmacy")
  .neq("provider_type", "calendar");
if (onlyUserId) q = q.eq("app_user_id", onlyUserId);

const { data: rows, error } = await q;
if (error) {
  console.error("provider query failed:", error);
  process.exit(1);
}

const candidates = (rows || []).filter((r) => r.name && r.name !== "Google Calendar");
console.log(`candidates: ${candidates.length}${dryRun ? " (DRY RUN — no writes)" : ""}`);

let hits = 0;
let misses = 0;
let updated = 0;
let denied = 0;

await runConcurrent(candidates, 4, async (row) => {
  const state = stateByUser.get(row.app_user_id) || null;
  const result = await lookupPlace(row.name, state);
  if (result.error === "denied:") denied++;
  if (result.phone) {
    hits++;
    console.log(
      `  ✓ ${row.name.padEnd(40)} → ${result.phone}` +
        (result.placeName && result.placeName !== row.name ? `  [matched: ${result.placeName}]` : "")
    );
    if (!dryRun) {
      const update = { phone_number: result.phone };
      if (result.address && !row.address) update.address = result.address;
      const { error: updErr } = await sb
        .from("providers")
        .update(update)
        .eq("id", row.id);
      if (updErr) console.error(`    update failed: ${updErr.message}`);
      else updated++;
    }
  } else {
    misses++;
    if (!result.error || result.error === "no-results") {
      console.log(`  ○ ${row.name.padEnd(40)} → (not found)`);
    } else {
      console.log(`  ✗ ${row.name.padEnd(40)} → ${result.error}`);
    }
  }
});

console.log(`\nresults: ${hits} hits, ${misses} misses${dryRun ? "" : `, ${updated} rows updated`}`);
if (denied > 0) {
  console.error(`\n⚠️  ${denied} requests were DENIED. Check that GOOGLE_PLACES_API_KEY is correct and Places API is enabled.`);
}
