import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await sb
  .from("providers")
  .select("name, source, npi, phone_number, status")
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(60);

if (error) { console.error(error); process.exit(1); }

let withPhone = 0, withoutPhone = 0;
const sources = {};
for (const p of data || []) {
  const has = !!p.phone_number;
  if (has) withPhone++; else withoutPhone++;
  const k = p.source || "(none)";
  sources[k] = sources[k] || { withPhone: 0, withoutPhone: 0 };
  if (has) sources[k].withPhone++;
  else sources[k].withoutPhone++;
}

console.log(`active providers sampled: ${data?.length}`);
console.log(`  with phone_number:    ${withPhone}`);
console.log(`  without phone_number: ${withoutPhone}`);
console.log(`\nby source:`);
for (const [src, c] of Object.entries(sources)) {
  console.log(`  ${src}: ${c.withPhone} with / ${c.withoutPhone} without`);
}

console.log(`\nproviders missing phone:`);
for (const p of (data || []).filter((x) => !x.phone_number).slice(0, 20)) {
  console.log(`  - ${p.name} (src=${p.source}, npi=${p.npi || "—"})`);
}
