// Smoke test for the Kate-state inference layer.
// Usage:  npx tsx scripts/kate-state-smoke.ts <app_user_id>
//
// Loads .env.local, calls getKateState, dumps the JSON output.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
  const appUserId = process.argv[2];
  if (!appUserId) {
    console.error("usage: tsx scripts/kate-state-smoke.ts <app_user_id>");
    process.exit(1);
  }
  const { getKateState } = await import("../src/lib/qbh/kate/state");
  const state = await getKateState(appUserId);
  console.log(JSON.stringify(state, null, 2));
}

main().catch((err) => {
  console.error("[smoke] failed:", err);
  process.exit(1);
});
