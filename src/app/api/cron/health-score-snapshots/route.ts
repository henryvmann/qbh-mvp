export const dynamic = "force-dynamic";
// Vercel function timeout — score computation iterates all users.
// 60s gives us comfortable headroom for ~hundreds of users; bump
// when we cross that scale.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { writeTodaysSnapshot } from "../../../../lib/qbh/health-score";

/**
 * GET /api/cron/health-score-snapshots
 *
 * Vercel cron entry point. Iterates active app_users and upserts each
 * one's current readiness score into health_score_snapshots for today's
 * date. Idempotent — re-running the same day overwrites today's row.
 *
 * Once this is running daily, Kate's status band can show truthful
 * "+6 this week" deltas (computed from yesterday's vs ~7d-ago snapshot).
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` header. Vercel
 * cron sends this automatically when configured in vercel.json.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const { data: users, error } = await supabaseAdmin
    .from("app_users")
    .select("id");

  if (error) {
    console.error("[cron/health-score-snapshots] failed to list app_users:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let written = 0;
  let failed = 0;
  for (const u of users ?? []) {
    const ok = await writeTodaysSnapshot(u.id);
    if (ok) written++;
    else failed++;
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(
    `[cron/health-score-snapshots] ${written} written, ${failed} failed, ${elapsedMs}ms`
  );
  return NextResponse.json({
    ok: true,
    total: users?.length ?? 0,
    written,
    failed,
    elapsed_ms: elapsedMs,
  });
}
