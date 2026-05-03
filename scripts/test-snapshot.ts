import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { writeTodaysSnapshot, computeReadinessScore } = await import("../src/lib/qbh/health-score");
  const { data: users } = await supa.from("app_users").select("id");
  console.log("app_users:", users?.length);
  for (const u of users || []) {
    const score = await computeReadinessScore(u.id);
    const ok = await writeTodaysSnapshot(u.id);
    console.log(" ", u.id, "score:", score, ok ? "✓ written" : "✗ failed");
  }
  // Verify snapshots landed
  const { data: snaps } = await supa.from("health_score_snapshots").select("app_user_id, score, measured_on").order("created_at", { ascending: false }).limit(10);
  console.log("\nlatest snapshots:");
  for (const s of snaps || []) console.log(" ", s.measured_on, s.app_user_id, "→", s.score);
}

main().catch((err) => { console.error(err); process.exit(1); });
