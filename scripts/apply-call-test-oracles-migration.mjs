// Apply the call_test_oracles migration. Idempotent.
import { config } from "dotenv";
import { readFileSync } from "fs";

config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const sql = readFileSync(
  "/Users/jennifermann/qbh-mvp/db/migrations/2026-05-call-test-oracles.sql",
  "utf8"
);

const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

if (res.ok) {
  console.log("call_test_oracles migration applied.");
} else {
  console.error("exec_sql rpc not available — apply via Supabase SQL editor:");
  console.error(sql);
  console.error("status:", res.status, await res.text());
  process.exit(1);
}
