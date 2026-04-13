export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body?.password || "").trim();
  const adminPassword = (process.env.QBH_ADMIN_PASSWORD || "").trim();

  if (!adminPassword) {
    return NextResponse.json({ ok: false, error: "Admin password not configured" }, { status: 500 });
  }

  if (password === adminPassword) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
}
