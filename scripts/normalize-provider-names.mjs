// One-shot pass: re-run normalizeProviderName logic over existing
// providers rows so credentials that were stored as a prefix
// ("D.D.S. ERIC ECHELMAN") get reordered to the canonical
// "Eric Echelman, DDS" shape. New rows are already normalized at
// /api/providers/add-manual + write-discovered-providers; this
// script catches the legacy data.
//
// Usage:
//   node scripts/normalize-provider-names.mjs                  # dry run
//   node scripts/normalize-provider-names.mjs --execute        # apply
//   node scripts/normalize-provider-names.mjs --email=henry@…   # one user

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
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
const dryRun = flags.execute !== "true";

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const CRED_PREFIX = /^\s*(M\.?D\.?|D\.?D\.?S\.?|D\.?O\.?|D\.?P\.?M\.?|N\.?P\.?|P\.?A\.?|R\.?N\.?|D\.?C\.?|O\.?D\.?|Ph\.?D\.?|Psy\.?D\.?|D\.?M\.?D\.?|FNP-BC|LCSW|LMFT|LPC|APRN)\s+/i;
const CRED_TRAILING = /\s+(M\.?D\.?|D\.?D\.?S\.?|D\.?O\.?|D\.?P\.?M\.?|N\.?P\.?|P\.?A\.?|R\.?N\.?|D\.?C\.?|O\.?D\.?|Ph\.?D\.?|Psy\.?D\.?|D\.?M\.?D\.?|FNP-BC|LCSW|LMFT|LPC|APRN)\s*$/i;

function normalize(name) {
  let cleaned = name.trim();
  const credentials = [];

  let match = cleaned.match(CRED_PREFIX);
  while (match) {
    const raw = match[1].replace(/\./g, "").toUpperCase();
    credentials.push(raw);
    cleaned = cleaned.replace(CRED_PREFIX, "").trim();
    match = cleaned.match(CRED_PREFIX);
  }

  const trailing = cleaned.match(CRED_TRAILING);
  if (trailing) {
    const raw = trailing[1].replace(/\./g, "").toUpperCase();
    credentials.push(raw);
    cleaned = cleaned.replace(CRED_TRAILING, "").trim();
  }

  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  if (credentials.length > 0) {
    cleaned = `${cleaned}, ${credentials.join(", ")}`;
  }

  return cleaned || name.trim();
}

async function resolveAppUserId() {
  if (flags.email && flags.email !== "true") {
    const { data: list } = await supa.auth.admin.listUsers();
    const a = list.users.find((u) => u.email?.toLowerCase() === flags.email.toLowerCase());
    if (!a) throw new Error(`No auth user with email ${flags.email}`);
    const { data: row } = await supa.from("app_users").select("id").eq("auth_user_id", a.id).single();
    return row.id;
  }
  return null;
}

async function main() {
  const userId = await resolveAppUserId();
  console.log(`Mode: ${dryRun ? "DRY RUN" : "EXECUTE"}`);
  console.log(`Scope: ${userId ? `user ${userId}` : "all users"}`);

  let q = supa.from("providers").select("id, name").not("name", "is", null);
  if (userId) q = q.eq("app_user_id", userId);

  const { data, error } = await q;
  if (error) {
    console.error("query failed:", error.message);
    process.exit(1);
  }

  const changes = [];
  for (const p of data) {
    // Skip junk transaction strings — they're a separate cleanup
    // problem (manual review or re-run discovery), not a name-normalize
    // problem.
    if (/ORIG\s+CO\s+NAME|TRACE#|IND\s+ID/i.test(p.name)) continue;
    if (p.name.length > 60) continue;
    // Only apply when there's an actual credential prefix or trailing
    // credential — pure title-casing changes are skipped for safety
    // (e.g., "MODERN DERMATOLOGY" stays as-is unless we add explicit
    // case-fix scope later).
    const hasCredentialChange = CRED_PREFIX.test(p.name) || CRED_TRAILING.test(p.name);
    if (!hasCredentialChange) continue;
    const next = normalize(p.name);
    if (next !== p.name) changes.push({ id: p.id, from: p.name, to: next });
  }

  console.log(`\n${changes.length} of ${data.length} provider(s) would be renamed.`);
  for (const c of changes) {
    console.log(`  "${c.from}"  →  "${c.to}"`);
  }

  if (dryRun) {
    console.log(`\nDry run only. Re-run with --execute to apply.`);
    return;
  }

  for (const c of changes) {
    const { error: updErr } = await supa.from("providers").update({ name: c.to }).eq("id", c.id);
    if (updErr) console.error(`  update ${c.id} failed:`, updErr.message);
  }
  console.log(`\nRenamed ${changes.length} row(s). ✅`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
