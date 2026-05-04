// Surface merchants that have been dismissed by many users — these
// are candidates to add to the universe eval / OBVIOUS_NOT_HEALTHCARE
// keyword list.
//
// Usage: source ~/.nvm/nvm.sh && node scripts/classifier-eval/feedback-candidates.mjs
//
// Threshold defaults are conservative — we want strong agreement
// before promoting anything. Run periodically as users accumulate.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env.local") });

const MIN_USERS = Number(process.env.FEEDBACK_MIN_USERS ?? 10);
const MIN_DISMISS_RATE = Number(process.env.FEEDBACK_MIN_DISMISS_RATE ?? 0.8);

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// All dismissals
const { data: dismissals } = await supa
  .from("classifier_dismissals")
  .select("normalized_name, app_user_id");

if (!dismissals || dismissals.length === 0) {
  console.log("no dismissals recorded yet");
  process.exit(0);
}

// Count distinct users per merchant
const dismissByName = new Map();
for (const d of dismissals) {
  const key = String(d.normalized_name).toUpperCase().trim();
  let entry = dismissByName.get(key);
  if (!entry) {
    entry = new Set();
    dismissByName.set(key, entry);
  }
  entry.add(d.app_user_id);
}

// For each merchant, count total users who saw it (as a discovered
// provider — active OR dismissed) so we can compute dismissal rate
const allProviderRows = await supa
  .from("providers")
  .select("name, app_user_id, status");

const seenByName = new Map();
for (const p of allProviderRows.data ?? []) {
  const key = String(p.name).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  let entry = seenByName.get(key);
  if (!entry) {
    entry = new Set();
    seenByName.set(key, entry);
  }
  entry.add(p.app_user_id);
}

const candidates = [];
for (const [name, dismissUsers] of dismissByName.entries()) {
  const seenUsers = seenByName.get(name) ?? new Set();
  const total = seenUsers.size;
  const dismissed = dismissUsers.size;
  const rate = total > 0 ? dismissed / total : 0;
  if (dismissed >= MIN_USERS && rate >= MIN_DISMISS_RATE) {
    candidates.push({ name, dismissed, total, rate });
  }
}

candidates.sort((a, b) => b.dismissed - a.dismissed);

console.log(
  `\nFEEDBACK CANDIDATES (≥${MIN_USERS} users, ≥${(MIN_DISMISS_RATE * 100).toFixed(0)}% dismiss rate):\n`
);
if (candidates.length === 0) {
  console.log("  none yet — wait for more dismissal data");
} else {
  for (const c of candidates) {
    console.log(`  ${c.name.padEnd(45)} ${c.dismissed}/${c.total} (${(c.rate * 100).toFixed(0)}%)`);
  }
  console.log(
    "\nNext step: review each. If it's truly never healthcare, add to:" +
      "\n  - scripts/classifier-eval/universe.ts UNIVERSE list (with is_healthcare:false)" +
      "\n  - src/lib/qbh/discovery/build-provider-registry.ts OBVIOUS_NOT_HEALTHCARE keywords" +
      "\nThen rerun: npm run classifier:variance-universe"
  );
}
process.exit(0);
