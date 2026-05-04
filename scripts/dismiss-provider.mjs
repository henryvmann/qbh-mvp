// Erase a provider for one user + record the dismissal so future
// Plaid scans skip it.
//
// Usage:
//   source ~/.nvm/nvm.sh && node scripts/dismiss-provider.mjs <app_user_id> <name_substring>

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

const [, , appUserId, q] = process.argv;
if (!appUserId || !q) {
  console.error("usage: node scripts/dismiss-provider.mjs <app_user_id> <name_substring>");
  process.exit(1);
}

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: providers } = await supa
  .from("providers")
  .select("id, name, provider_type, status")
  .eq("app_user_id", appUserId)
  .ilike("name", `%${q}%`);

if (!providers?.length) {
  console.log(`no provider matching "${q}" for that user`);
  process.exit(0);
}

for (const p of providers) {
  console.log(`erasing ${p.name} (${p.provider_type}, status=${p.status}, id=${p.id})`);

  // 1. Record the dismissal so future scans skip it for this user.
  const normalized = p.name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const { error: dErr } = await supa.from("classifier_dismissals").upsert(
    {
      app_user_id: appUserId,
      normalized_name: normalized,
      merchant_name: p.name,
      provider_id: p.id,
      reason: "manual erase via script",
    },
    { onConflict: "app_user_id,normalized_name" }
  );
  if (dErr) console.error("  dismissal upsert error:", dErr.message);
  else console.log(`  dismissal recorded: ${normalized}`);

  // 2. Delete dependent rows in FK order.
  const tables = [
    "patient_notes",
    "provider_visits",
    "schedule_attempts",
    "calendar_events",
  ];
  for (const t of tables) {
    const { error, count } = await supa
      .from(t)
      .delete({ count: "exact" })
      .eq("provider_id", p.id);
    if (error) console.error(`  delete ${t}:`, error.message);
    else console.log(`  ${t}: ${count ?? 0} rows`);
  }

  // 3. Delete the provider itself.
  const { error: pErr } = await supa.from("providers").delete().eq("id", p.id);
  if (pErr) console.error("  delete providers:", pErr.message);
  else console.log(`  provider ${p.id} deleted ✓`);
}

process.exit(0);
