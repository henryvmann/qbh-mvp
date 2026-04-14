export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Insight = {
  id: string;
  type: string;
  title: string;
  body: string;
  action_label?: string | null;
  action_href?: string | null;
  priority: "high" | "medium" | "low";
  generated_at: string;
};

async function buildUserContext(appUserId: string) {
  const [providersRes, eventsRes, userRes, visitsRes] = await Promise.all([
    supabaseAdmin
      .from("providers")
      .select("id, name, status, provider_type, doctor_name, specialty, phone_number, source")
      .eq("app_user_id", appUserId)
      .eq("status", "active")
      .neq("provider_type", "calendar"),
    supabaseAdmin
      .from("calendar_events")
      .select("id, provider_id, start_at, end_at, status")
      .eq("app_user_id", appUserId)
      .eq("status", "confirmed")
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(10),
    supabaseAdmin
      .from("app_users")
      .select("patient_profile, created_at")
      .eq("id", appUserId)
      .single(),
    supabaseAdmin
      .from("provider_visits")
      .select("provider_id, visit_date")
      .eq("app_user_id", appUserId)
      .order("visit_date", { ascending: false })
      .limit(50),
  ]);

  const providers = providersRes.data || [];
  const upcomingEvents = eventsRes.data || [];
  const profile = (userRes.data?.patient_profile || {}) as Record<string, string | null>;
  const accountCreated = userRes.data?.created_at || null;
  const visits = visitsRes.data || [];

  // Build provider summaries with last visit
  const providerSummaries = providers.map((p) => {
    const lastVisit = visits.find((v) => v.provider_id === p.id);
    const upcoming = upcomingEvents.find((e) => e.provider_id === p.id);
    return {
      name: p.name,
      type: p.provider_type || "doctor",
      doctor_name: p.doctor_name,
      specialty: p.specialty,
      has_phone: !!p.phone_number,
      source: p.source,
      last_visit: lastVisit?.visit_date || null,
      upcoming_appointment: upcoming?.start_at || null,
    };
  });

  // Detect missing provider types
  const providerTypes = new Set(providers.map((p) => (p.specialty || p.provider_type || "").toLowerCase()));
  const hasType = (keywords: string[]) => keywords.some((k) =>
    [...providerTypes].some((t) => t.includes(k)) || providers.some((p) => p.name.toLowerCase().includes(k))
  );

  const missingTypes = [];
  if (!hasType(["dental", "dentist"])) missingTypes.push("dentist");
  if (!hasType(["eye", "vision", "optom", "ophthalm"])) missingTypes.push("eye doctor");
  if (!hasType(["primary", "pcp", "internal medicine", "family medicine", "general practice"])) missingTypes.push("primary care physician");
  if (!hasType(["derma", "skin"])) missingTypes.push("dermatologist");

  return {
    profile,
    accountCreated,
    providerSummaries,
    upcomingCount: upcomingEvents.length,
    upcomingEvents: upcomingEvents.slice(0, 5).map((e) => ({
      provider_id: e.provider_id,
      start_at: e.start_at,
    })),
    missingTypes,
    totalProviders: providers.length,
    providersWithoutPhone: providers.filter((p) => !p.phone_number && p.provider_type !== "pharmacy").length,
  };
}

export async function GET(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Check if we've already generated insights today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existing } = await supabaseAdmin
    .from("kate_insights")
    .select("id, type, title, body, action_label, action_href, priority, generated_at")
    .eq("app_user_id", appUserId)
    .gte("generated_at", todayStart.toISOString())
    .is("dismissed_at", null)
    .order("priority", { ascending: true })
    .limit(10);

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, insights: existing, cached: true });
  }

  // Generate fresh insights
  try {
    const context = await buildUserContext(appUserId);

    // Read Kate focus/proactivity settings from patient_profile
    const focusAreas = context.profile?.kate_focus_areas || null;
    const proactivity = context.profile?.kate_proactivity || "balanced";

    // Determine insight count range based on proactivity
    let insightCountInstruction = "generate 2-4 personalized insights";
    if (proactivity === "minimal") {
      insightCountInstruction = "generate 1-2 personalized insights (the user prefers fewer, higher-signal notifications)";
    } else if (proactivity === "proactive") {
      insightCountInstruction = "generate 3-5 personalized insights (the user wants more proactive suggestions)";
    }

    // Build focus area weighting instruction
    const focusInstruction = focusAreas
      ? `\nThe user has chosen these health focus areas: ${focusAreas}. Weight your insights toward these areas — at least half of insights should relate to their focus areas when possible.`
      : "";

    const prompt = `You are Kate, a friendly healthcare assistant. Based on this user's health data, ${insightCountInstruction}. Each insight should be actionable, encouraging, or informative.${focusInstruction}

User context:
${JSON.stringify(context, null, 2)}

Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}

Generate insights as JSON array. Each insight has:
- type: "upcoming_prep" | "care_gap" | "encouragement" | "action_needed" | "tip" | "connection"
- title: Short title (under 60 chars)
- body: 1-2 sentence detail. Be warm, specific, use provider names. Not generic.
- action_label: Optional button text (e.g., "Book now", "View details", "Add provider")
- action_href: Optional link path (e.g., "/visits", "/goals", "/dashboard")
- priority: "high" (needs action), "medium" (good to know), "low" (encouragement/tip)

Rules:
- If there's an upcoming appointment, ALWAYS include a prep insight
- If there are care gaps (missing provider types), mention ONE
- Include at least one encouraging/positive insight
- Be specific — use real provider names and dates
- Don't be generic. "Stay healthy!" is bad. "Your visit with Dr. Chen is in 3 days — want me to prep some questions?" is good.
- If the user is new (few providers), focus on helping them get set up

Respond with JSON only: { "insights": [...] }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ ok: true, insights: [] });
    }

    const parsed = JSON.parse(content);
    const rawInsights = parsed.insights || [];

    // Store insights
    const rows = rawInsights.map((ins: any) => ({
      app_user_id: appUserId,
      type: ins.type || "tip",
      title: ins.title || "",
      body: ins.body || "",
      action_label: ins.action_label || null,
      action_href: ins.action_href || null,
      priority: ins.priority || "medium",
      generated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { data: inserted } = await supabaseAdmin
        .from("kate_insights")
        .insert(rows)
        .select("id, type, title, body, action_label, action_href, priority, generated_at");

      return NextResponse.json({ ok: true, insights: inserted || rows });
    }

    return NextResponse.json({ ok: true, insights: [] });
  } catch (err) {
    console.error("[kate/insights] error:", err);
    return NextResponse.json({ ok: true, insights: [] });
  }
}

// Dismiss an insight
export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const insightId = body.insight_id;
  const action = body.action || "dismiss";

  if (!insightId) {
    return NextResponse.json({ ok: false, error: "insight_id required" }, { status: 400 });
  }

  if (action === "dismiss") {
    await supabaseAdmin
      .from("kate_insights")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", insightId)
      .eq("app_user_id", appUserId);
  } else if (action === "read") {
    await supabaseAdmin
      .from("kate_insights")
      .update({ read_at: new Date().toISOString() })
      .eq("id", insightId)
      .eq("app_user_id", appUserId);
  }

  return NextResponse.json({ ok: true });
}
