// Re-classify existing providers whose name implies a specific
// specialty but were stored with the generic "specialist" type.
// "Modern Dermatology" stays specialist=true but provider_type
// flips to "dermatology" so the UI can group + label correctly.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SPECIALTY_HINTS = [
  ["DERMATOLOG", "dermatology"],
  ["CARDIOLOG", "cardiology"],
  ["GASTROENTEROLOG", "gastroenterology"],
  ["NEUROLOG", "neurology"],
  ["ORTHOPEDIC", "orthopedic"],
  ["OBGYN", "gynecology"],
  ["GYNECOLOG", "gynecology"],
  ["ONCOLOG", "oncology"],
  ["UROLOG", "urology"],
  ["ENDOCRINOLOG", "endocrinology"],
  ["RHEUMATOLOG", "rheumatology"],
  ["PULMONOLOG", "pulmonology"],
  ["ALLERGIST", "allergy"],
  ["ALLERGY", "allergy"],
];

const { data, error } = await sb
  .from("providers")
  .select("id, name, provider_type, status")
  .neq("status", "deleted")
  .or("provider_type.eq.specialist,provider_type.is.null");

if (error) {
  console.error(error);
  process.exit(1);
}

let updated = 0;
for (const p of data || []) {
  const upper = (p.name || "").toUpperCase();
  let newType = null;
  for (const [hint, type] of SPECIALTY_HINTS) {
    if (upper.includes(hint)) {
      newType = type;
      break;
    }
  }
  if (!newType) continue;
  if (p.provider_type === newType) continue;

  const { error: updErr } = await sb
    .from("providers")
    .update({ provider_type: newType })
    .eq("id", p.id);
  if (updErr) {
    console.error(`  ✗ ${p.name}: ${updErr.message}`);
  } else {
    console.log(`  ✓ ${p.name}: ${p.provider_type || "(null)"} → ${newType}`);
    updated++;
  }
}

console.log(`\n${updated} providers re-typed.`);
