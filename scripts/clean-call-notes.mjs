// Sanity-gate existing call_notes rows in place. The webhook used to
// fall back to a regex extractor that leaked Kate's verbatim dialogue
// ("Can you spell the patient's name?") into office_instructions.
// Now that the AI summarizer is the only writer + a gate function
// drops dialogue-shaped output, run that same gate over the historical
// rows so the bad strings stop showing on provider pages.
//
// Usage:
//   node scripts/clean-call-notes.mjs                    # dry run, all users
//   node scripts/clean-call-notes.mjs --execute          # apply
//   node scripts/clean-call-notes.mjs --email=henry@..   # one user only
//
// Re-runs are safe — clean rows are skipped.

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

// Same heuristic as lib/openai/summarize-office-notes.ts gateOutput().
// Anything that looks like raw dialogue gets nulled.
function looksLikeRawDialogue(text) {
  if (!text || text.length < 5) return true;
  const t = text.trim();
  if (t.endsWith("?")) return true;
  if (/^(i\b|i'm|i'll|i just|let me|hold on|oh\b|sorry\b|um\b|uh\b|wait\b|yeah\b|okay so)/i.test(t)) return true;
  if (/^["“]/.test(t)) return true;
  return false;
}

async function resolveAttemptIds() {
  if (flags.email && flags.email !== "true") {
    const { data: list } = await supa.auth.admin.listUsers();
    const authUser = list?.users?.find((u) => u.email?.toLowerCase() === flags.email.toLowerCase());
    if (!authUser) throw new Error(`No auth user with email ${flags.email}`);
    const { data: row } = await supa
      .from("app_users")
      .select("id")
      .eq("auth_user_id", authUser.id)
      .single();
    if (!row) throw new Error(`No app_users row`);
    const { data: attempts } = await supa
      .from("schedule_attempts")
      .select("id")
      .eq("app_user_id", row.id);
    return (attempts || []).map((a) => a.id);
  }
  return null; // null = all rows
}

async function main() {
  const attemptIds = await resolveAttemptIds();
  console.log(`Mode: ${dryRun ? "DRY RUN" : "EXECUTE"}`);
  console.log(attemptIds ? `Scope: ${attemptIds.length} attempts for ${flags.email}` : "Scope: all users");

  let q = supa
    .from("call_notes")
    .select("id, attempt_id, office_instructions, follow_up_notes")
    .not("office_instructions", "is", null);
  if (attemptIds) q = q.in("attempt_id", attemptIds);

  const { data: officeRows, error: officeErr } = await q;
  if (officeErr) {
    console.error("query failed:", officeErr.message);
    process.exit(1);
  }

  let q2 = supa
    .from("call_notes")
    .select("id, attempt_id, office_instructions, follow_up_notes")
    .not("follow_up_notes", "is", null);
  if (attemptIds) q2 = q2.in("attempt_id", attemptIds);
  const { data: followRows, error: followErr } = await q2;
  if (followErr) {
    console.error("query failed:", followErr.message);
    process.exit(1);
  }

  const allRows = new Map();
  for (const r of [...officeRows, ...followRows]) {
    allRows.set(r.id, r);
  }

  console.log(`Loaded ${allRows.size} candidate row(s) with non-null office or follow-up notes.`);

  let dirtyOffice = 0;
  let dirtyFollow = 0;
  const updates = [];

  for (const r of allRows.values()) {
    const dropOffice = looksLikeRawDialogue(r.office_instructions);
    const dropFollow = looksLikeRawDialogue(r.follow_up_notes);
    if (!dropOffice && !dropFollow) continue;

    if (dropOffice) {
      dirtyOffice++;
      console.log(`  attempt=${r.attempt_id} office: "${(r.office_instructions || "").slice(0, 80)}…"`);
    }
    if (dropFollow) {
      dirtyFollow++;
      console.log(`  attempt=${r.attempt_id} follow: "${(r.follow_up_notes || "").slice(0, 80)}…"`);
    }
    updates.push({
      id: r.id,
      ...(dropOffice ? { office_instructions: null } : {}),
      ...(dropFollow ? { follow_up_notes: null } : {}),
    });
  }

  console.log(`\nDirty: ${dirtyOffice} office_instructions, ${dirtyFollow} follow_up_notes — ${updates.length} row(s) to clean.`);

  if (dryRun) {
    console.log(`Dry run only. Re-run with --execute to apply.`);
    return;
  }

  for (const u of updates) {
    const patch = {};
    if (u.office_instructions === null) patch.office_instructions = null;
    if (u.follow_up_notes === null) patch.follow_up_notes = null;
    const { error } = await supa.from("call_notes").update(patch).eq("id", u.id);
    if (error) console.error(`  update ${u.id} failed:`, error.message);
  }
  console.log(`Cleaned ${updates.length} row(s). ✅`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
