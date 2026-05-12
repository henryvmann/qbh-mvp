// One-shot data fix: change Henry's appointment with Caroline Andrew
// from May 14 → May 28 at 2:30 PM ET. The propose-office-slot bug
// booked the wrong date on a real call.
//
// ET in May = UTC-4 (DST). 2:30 PM ET = 18:30 UTC.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const EMAIL = "henry@getquarterback.com";
const NEW_START = "2026-05-28T18:30:00+00:00";
const NEW_END   = "2026-05-28T19:00:00+00:00";

const { data: auths } = await sb.auth.admin.listUsers({ perPage: 200 });
const auth = (auths?.users || []).find((u) => (u.email || "").toLowerCase() === EMAIL.toLowerCase());
const { data: appUser } = await sb
  .from("app_users").select("id").eq("auth_user_id", auth.id).maybeSingle();

const { data: providers } = await sb
  .from("providers").select("id, name").eq("app_user_id", appUser.id)
  .ilike("name", "%Caroline%Andrew%");
const provider = providers[0];
console.log(`Henry's ${provider.name} appointments:`);

// Update May-14 calendar_events
const { data: events } = await sb
  .from("calendar_events")
  .select("id, start_at, end_at, status")
  .eq("app_user_id", appUser.id)
  .eq("provider_id", provider.id);

let updatedEvents = 0;
for (const e of events || []) {
  if (e.start_at && e.start_at.startsWith("2026-05-14")) {
    const { error } = await sb
      .from("calendar_events")
      .update({ start_at: NEW_START, end_at: NEW_END })
      .eq("id", e.id);
    if (error) console.error(`  ✗ event ${e.id}: ${error.message}`);
    else {
      console.log(`  ✓ calendar_events ${e.id}: ${e.start_at} → ${NEW_START}`);
      updatedEvents++;
    }
  } else {
    console.log(`  (skip) event ${e.id}: ${e.start_at} status=${e.status}`);
  }
}

// Update any May-14 proposals
const { data: proposals } = await sb
  .from("proposals")
  .select("id, start_at, end_at, status, attempt_id");
const ours = (proposals || []).filter(
  (p) => p.start_at && p.start_at.startsWith("2026-05-14")
);
// Filter by attempt — only those tied to Henry's Caroline Andrew attempts
const { data: attempts } = await sb
  .from("schedule_attempts")
  .select("id")
  .eq("app_user_id", appUser.id)
  .eq("provider_id", provider.id);
const ourAttemptIds = new Set((attempts || []).map((a) => a.id));
const oursOfOurs = ours.filter((p) => ourAttemptIds.has(p.attempt_id));
for (const p of oursOfOurs) {
  const { error } = await sb
    .from("proposals")
    .update({ start_at: NEW_START, end_at: NEW_END })
    .eq("id", p.id);
  if (error) console.error(`  ✗ proposal ${p.id}: ${error.message}`);
  else console.log(`  ✓ proposals ${p.id}: ${p.start_at} → ${NEW_START}`);
}

console.log(`\nUpdated ${updatedEvents} calendar_events + ${oursOfOurs.length} proposals.`);
console.log(`New appointment: May 28, 2026 at 2:30 PM ET.`);
