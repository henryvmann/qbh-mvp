// One-shot duplicate-provider merger for an account.
//
// Why this exists:
//   Discovery has had several rounds of name-cleaning improvements
//   (card-processor prefix strip, entity-suffix strip, NPI dedup).
//   Accounts populated before those landed have rows like
//   "Med*Willows Pediatric" sitting next to "Willows Pediatric" — same
//   real provider, two providers rows. This script collapses them
//   without losing any visits / notes / events / call history.
//
// Usage:
//   node scripts/dedup-providers.mjs --email=henry@getquarterback.com
//   node scripts/dedup-providers.mjs --app-user-id=<uuid>
//
//   Default is dry-run: prints the merge plan, makes no writes.
//   Pass --execute to actually merge.
//
// Algorithm:
//   1. Load all providers for the user.
//   2. Group fuzzy-equivalent rows (NPI match wins; otherwise name
//      normalization with prefix/suffix strip).
//   3. For each group of 2+, pick the canonical row:
//        - prefer one with NPI
//        - then the most-complete (has phone, has specialty)
//        - then earliest created_at
//   4. For each non-canonical row in the group:
//        - reassign all FK references (visits, notes, events, calls,
//          insurance, caregivers) to the canonical row
//        - delete the non-canonical row
//
// Safety:
//   - Default --dry-run never writes.
//   - Each merge logs what it's about to do before the writes happen.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Match the pattern other scripts use — root .env.local is the source
// of truth for SUPABASE_URL / SERVICE_ROLE_KEY in this repo.
config({ path: new URL("../.env.local", import.meta.url).pathname });

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    })
);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const dryRun = flags.execute !== "true";

async function resolveAppUserId() {
  if (flags["app-user-id"] && flags["app-user-id"] !== "true") {
    return flags["app-user-id"];
  }
  if (flags.email && flags.email !== "true") {
    const { data: list } = await supa.auth.admin.listUsers();
    const authUser = list?.users?.find(
      (u) => u.email?.toLowerCase() === flags.email.toLowerCase()
    );
    if (!authUser) throw new Error(`No auth user with email ${flags.email}`);
    const { data: row } = await supa
      .from("app_users")
      .select("id")
      .eq("auth_user_id", authUser.id)
      .single();
    if (!row) throw new Error(`No app_users row for auth user ${authUser.id}`);
    return row.id;
  }
  throw new Error("Pass --email=<addr> or --app-user-id=<uuid>");
}

function cleanName(s) {
  return (s || "").trim().toLowerCase();
}

function strip(s) {
  return s
    .replace(/^[a-z]{2,5}\*\s*/, "")
    .replace(
      /[,\s]+(gifts?|shop|store|pharmacy|rx|inc|ltd|llc|pc|pllc|plc|pa|p|md|dds|do)\s*$/g,
      ""
    )
    .trim();
}

function fuzzyKey(name) {
  // Repeated strip handles "modern dermatology, p" / "modern dermatology pc"
  // converging on the same token both ways.
  let s = cleanName(name);
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = strip(s);
  }
  return s;
}

function pickCanonical(rows) {
  // Prefer NPI > completeness > earliest created_at.
  const completeness = (r) =>
    [r.phone_number, r.specialty, r.doctor_name, r.npi].filter(Boolean).length;
  return rows.slice().sort((a, b) => {
    if (Boolean(a.npi) !== Boolean(b.npi)) return a.npi ? -1 : 1;
    const ca = completeness(a);
    const cb = completeness(b);
    if (ca !== cb) return cb - ca;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
}

// All tables with a provider_id (or related_provider_id) FK to providers.id.
// Order doesn't matter for UPDATEs (no row count gate); each table is
// reassigned independently.
const FK_TABLES_PROVIDER_ID = [
  "provider_visits",
  "schedule_attempts",
  "proposals",
  "calendar_events",
  "portal_facts",
  "patient_notes",
  "classifier_dismissals",
  "appointment_caregivers",
];
const FK_TABLES_RELATED_PROVIDER_ID = ["insurance_eobs", "insurance_claims"];

async function reassignAndDelete(canonicalId, dupeId) {
  for (const table of FK_TABLES_PROVIDER_ID) {
    const { error } = await supa
      .from(table)
      .update({ provider_id: canonicalId })
      .eq("provider_id", dupeId);
    if (error) {
      // 42P01 = table doesn't exist (older migrations); skip silently.
      if (!/relation .* does not exist/i.test(error.message ?? "")) {
        console.error(`  ! ${table} reassign failed:`, error.message);
      }
    }
  }
  for (const table of FK_TABLES_RELATED_PROVIDER_ID) {
    const { error } = await supa
      .from(table)
      .update({ related_provider_id: canonicalId })
      .eq("related_provider_id", dupeId);
    if (error && !/relation .* does not exist/i.test(error.message ?? "")) {
      console.error(`  ! ${table} reassign failed:`, error.message);
    }
  }
  const { error: delError } = await supa.from("providers").delete().eq("id", dupeId);
  if (delError) {
    console.error(`  ! delete provider ${dupeId} failed:`, delError.message);
    throw delError;
  }
}

async function main() {
  const appUserId = await resolveAppUserId();
  console.log(`App user: ${appUserId}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "EXECUTE"}`);
  console.log();

  const { data: providers, error } = await supa
    .from("providers")
    .select("id, name, npi, phone_number, specialty, doctor_name, created_at")
    .eq("app_user_id", appUserId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to load providers:", error.message);
    process.exit(1);
  }
  console.log(`Loaded ${providers.length} providers.`);

  // Group by NPI first; within "no NPI" group, group by fuzzyKey.
  const groups = new Map();
  for (const p of providers) {
    const key = p.npi ? `npi:${p.npi}` : `name:${fuzzyKey(p.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const dupeGroups = [...groups.entries()].filter(([_, rows]) => rows.length > 1);
  if (dupeGroups.length === 0) {
    console.log("No duplicates found. ✅");
    return;
  }

  console.log(`Found ${dupeGroups.length} duplicate group(s):`);
  console.log();

  let totalDupes = 0;
  for (const [key, rows] of dupeGroups) {
    const canonical = pickCanonical(rows);
    const dupes = rows.filter((r) => r.id !== canonical.id);
    totalDupes += dupes.length;
    console.log(`  Group [${key}]`);
    console.log(`    Canonical: ${canonical.name}  (id=${canonical.id}, npi=${canonical.npi ?? "none"})`);
    for (const d of dupes) {
      console.log(`    Merging:   ${d.name}  (id=${d.id}, npi=${d.npi ?? "none"})`);
    }
    console.log();
  }

  if (dryRun) {
    console.log(`Dry run only — no rows changed. Would merge ${totalDupes} duplicate row(s).`);
    console.log(`Re-run with --execute to apply.`);
    return;
  }

  console.log(`Executing merges...`);
  let merged = 0;
  for (const [, rows] of dupeGroups) {
    const canonical = pickCanonical(rows);
    for (const d of rows) {
      if (d.id === canonical.id) continue;
      await reassignAndDelete(canonical.id, d.id);
      merged++;
    }
  }
  console.log(`Merged ${merged} duplicate row(s) into their canonical providers. ✅`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
