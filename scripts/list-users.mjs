import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await supa.from("app_users").select("*").order("created_at", { ascending: false }).limit(15);
console.log("error:", error);
console.log("count:", data?.length ?? 0);
if (data?.[0]) console.log("columns:", Object.keys(data[0]).join(", "));
for (const u of data || []) {
  console.log(u.created_at, "|", u.id, "|", u.user_id || u.auth_user_id || "(no link)");
}
const ids = (data || []).map(u => u.user_id || u.auth_user_id).filter(Boolean);
if (ids.length) {
  const { data: authUsers } = await supa.auth.admin.listUsers({ perPage: 200 });
  const byId = new Map((authUsers?.users || []).map(u => [u.id, u.email]));
  console.log("\nresolved emails:");
  for (const u of data) {
    const link = u.user_id || u.auth_user_id;
    console.log(u.created_at, "|", u.id.slice(0, 8), "|", byId.get(link) ?? "(no email)");
  }
}
process.exit(0);
