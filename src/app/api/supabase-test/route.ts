export const dynamic = 'force-dynamic';
import { supabaseAdmin } from "../../../lib/supabase-server";

export async function GET() {
  const { data, error } = await supabaseAdmin.auth.getUser();

  if (error) {
    return Response.json(
      { ok: false, where: "supabaseAdmin.auth.getUser()", error: error.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, user: data?.user ?? null });
}