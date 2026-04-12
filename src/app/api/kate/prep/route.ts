export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function buildPrepContext(appUserId: string, providerId: string) {
  const [providerRes, allProvidersRes, visitsRes, eventsRes, profileRes, notesRes] = await Promise.all([
    supabaseAdmin
      .from("providers")
      .select("id, name, doctor_name, specialty, provider_type, phone_number")
      .eq("id", providerId)
      .single(),
    supabaseAdmin
      .from("providers")
      .select("id, name, specialty, provider_type, doctor_name")
      .eq("app_user_id", appUserId)
      .eq("status", "active")
      .neq("provider_type", "calendar"),
    supabaseAdmin
      .from("provider_visits")
      .select("provider_id, visit_date, amount_cents")
      .eq("app_user_id", appUserId)
      .order("visit_date", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("calendar_events")
      .select("provider_id, start_at, end_at, status")
      .eq("app_user_id", appUserId)
      .eq("status", "confirmed")
      .order("start_at", { ascending: true })
      .limit(20),
    supabaseAdmin
      .from("app_users")
      .select("patient_profile")
      .eq("id", appUserId)
      .single(),
    supabaseAdmin
      .from("call_notes")
      .select("summary, created_at")
      .eq("app_user_id", appUserId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const provider = providerRes.data;
  const allProviders = allProvidersRes.data || [];
  const visits = visitsRes.data || [];
  const events = eventsRes.data || [];
  const profile = (profileRes.data?.patient_profile || {}) as Record<string, string | null>;
  const notes = notesRes.data || [];

  // Find visits for this provider
  const providerVisits = visits.filter((v) => v.provider_id === providerId);

  // Find upcoming event for this provider
  const upcomingEvent = events.find(
    (e) => e.provider_id === providerId && new Date(e.start_at) > new Date()
  );

  // Related providers (same specialty area)
  const providerSpecialty = (provider?.specialty || provider?.provider_type || "").toLowerCase();
  const relatedProviders = allProviders.filter(
    (p) => p.id !== providerId && (p.specialty || p.provider_type || "").toLowerCase().includes(providerSpecialty.split(" ")[0])
  );

  return {
    provider,
    providerVisits: providerVisits.slice(0, 10),
    upcomingEvent,
    allProviders: allProviders.map((p) => ({ name: p.name, specialty: p.specialty, type: p.provider_type })),
    relatedProviders,
    profile,
    recentNotes: notes.slice(0, 5),
    today: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
  };
}

export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const providerId = body.provider_id;

  if (!providerId) {
    return NextResponse.json({ ok: false, error: "provider_id required" }, { status: 400 });
  }

  try {
    const context = await buildPrepContext(appUserId, providerId);

    const prompt = `You are Kate, a healthcare assistant. Generate a pre-appointment preparation report for the user's upcoming visit.

Context:
${JSON.stringify(context, null, 2)}

Generate a JSON response with:
{
  "provider_name": "Name of the provider/doctor",
  "appointment_date": "Date if known, or null",
  "visit_type": "What type of visit this likely is (e.g., annual checkup, follow-up, specialist consultation)",
  "history_summary": "1-2 sentence summary of past visits with this provider based on available data. Be honest if data is limited.",
  "related_care": "How this visit connects to other providers/care the patient is receiving. If no clear connections, say so.",
  "questions_to_ask": ["Array of 4-6 specific, useful questions the patient should consider asking their doctor. Make them relevant to the provider type and specialty."],
  "things_to_bring": ["Array of items to bring (e.g., insurance card, medication list, previous test results, specific concerns)"],
  "prep_notes": "Any preparation advice (fasting, arriving early for paperwork, etc.)",
  "kate_note": "A brief encouraging personal note from Kate"
}

Rules:
- Be specific and practical, not generic
- If data is limited, acknowledge it: "Based on what I know so far..."
- Questions should be genuinely useful for this type of provider
- Include at least one question about follow-ups or preventive care
- The kate_note should be warm and brief (1 sentence)`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ ok: false, error: "No response generated" }, { status: 500 });
    }

    const prep = JSON.parse(content);

    return NextResponse.json({ ok: true, prep });
  } catch (err) {
    console.error("[kate/prep] error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to generate prep" },
      { status: 500 }
    );
  }
}
