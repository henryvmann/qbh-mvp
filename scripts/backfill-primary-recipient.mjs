// Backfill care_recipient for existing providers that still have it
// null ("no one yet"). For each affected user, looks up the primary
// recipient (Self entry, or first one on file) and tags every untagged
// provider with that name.
//
// Pairs with the May 11 review #T3 extension that made Plaid + calendar
// + manual-add paths default to the primary user going forward. This
// catches the legacy rows.
//
// Run once:
//   source ~/.nvm/nvm.sh && node scripts/backfill-primary-recipient.mjs
//
// Idempotent: only touches rows where care_recipient IS NULL.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function getPrimary(profile) {
  const recipients = profile?.care_recipients;
  if (!Array.isArray(recipients) || recipients.length === 0) return null;
  const self = recipients.find(
    (r) => r?.relationship === "Self" && typeof r.name === "string" && r.name.trim()
  );
  if (self?.name?.trim()) return self.name.trim();
  const first = recipients.find((r) => typeof r?.name === "string" && r.name.trim());
  return first?.name?.trim() ?? null;
}

const { data: rows, error } = await sb
  .from("providers")
  .select("id, app_user_id, name")
  .neq("status", "deleted")
  .is("care_recipient", null);

if (error) {
  console.error("read failed:", error.message);
  process.exit(1);
}

console.log(`Found ${rows?.length ?? 0} untagged providers.`);
if (!rows || rows.length === 0) process.exit(0);

const usersById = new Map();
for (const r of rows) {
  if (!usersById.has(r.app_user_id)) usersById.set(r.app_user_id, []);
  usersById.get(r.app_user_id).push(r);
}

let updated = 0;
let skippedNoPrimary = 0;

for (const [appUserId, userProviders] of usersById.entries()) {
  const { data: userRow } = await sb
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .maybeSingle();
  const primary = getPrimary(userRow?.patient_profile);
  if (!primary) {
    skippedNoPrimary += userProviders.length;
    console.log(`  - user ${appUserId.slice(0, 8)}…: no primary recipient on file — skipping ${userProviders.length} provider(s)`);
    continue;
  }
  const recipientJson = JSON.stringify([primary]);
  for (const p of userProviders) {
    const { error: updErr } = await sb
      .from("providers")
      .update({ care_recipient: recipientJson })
      .eq("id", p.id);
    if (updErr) {
      console.error(`  ✗ ${p.name} (${p.id}): ${updErr.message}`);
    } else {
      updated++;
    }
  }
  console.log(`  ✓ user ${appUserId.slice(0, 8)}…: tagged ${userProviders.length} provider(s) → ${primary}`);
}

console.log(`\nDone. ${updated} providers tagged. ${skippedNoPrimary} skipped (no primary on file).`);
