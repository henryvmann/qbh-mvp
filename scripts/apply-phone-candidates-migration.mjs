// Apply the phone_candidates column migration to the prod Supabase.
// Idempotent — IF NOT EXISTS clauses make repeat runs safe.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync } from "fs";

config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = readFileSync(
  "/Users/jennifermann/qbh-mvp/db/migrations/2026-05-phone-candidates.sql",
  "utf8"
);

// Supabase doesn't expose raw SQL via the JS client; route via the
// rpc-style "execute" extension if available, else use postgres-meta.
// Fallback: split + run individual statements via the data API.
//
// Simplest path: hit the Supabase SQL endpoint via fetch with
// service-role key.
const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
const body = { query: sql };

const res = await fetch(url, {
  method: "POST",
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

if (res.ok) {
  console.log("migration applied via exec_sql rpc");
} else {
  console.error("exec_sql rpc not available — apply manually via Supabase SQL editor:");
  console.error("");
  console.error(sql);
  console.error("");
  console.error("status:", res.status, await res.text());
  process.exit(1);
}
