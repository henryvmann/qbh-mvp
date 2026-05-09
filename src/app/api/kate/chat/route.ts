export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Search for providers via NPI + Google Places */
async function searchProviders(query: string, location?: string): Promise<string> {
  try {
    const searchQuery = location ? `${query} ${location}` : query;
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/npi/search?q=${encodeURIComponent(searchQuery)}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (!data.ok || !data.results?.length) return "No providers found for that search. Try a different name or location.";
    return data.results.slice(0, 5).map((r: any) =>
      `- ${r.name}${r.specialty ? ` (${r.specialty})` : ""}${r.city && r.state ? ` — ${r.city}, ${r.state}` : ""}${r.phone ? ` — ${r.phone.replace(/^\+1/, "").replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}` : ""}`
    ).join("\n");
  } catch {
    return "Search timed out. The user can try searching on the Providers page directly.";
  }
}

const KATE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_providers",
      description: "Search for healthcare providers (doctors, dentists, specialists) by name, specialty, or location. Use this when the user asks to find a provider.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Provider name, specialty, or type (e.g., 'dentist', 'cardiologist', 'Dr. Smith')" },
          location: { type: "string", description: "City, state, or area to search in (e.g., 'Westport CT', 'near me')" },
        },
        required: ["query"],
      },
    },
  },
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

async function buildContext(appUserId: string): Promise<{ text: string; commStyle: string; proactivity: string }> {
  const [providersRes, userRes, eventsRes, visitsRes] = await Promise.all([
    // Pull every active provider regardless of source. The earlier
    // .neq("provider_type", "calendar") filter excluded calendar-
    // discovered providers from Kate's context, so she'd answer
    // "no providers on file" while the user was looking at Dr. Kelly
    // on her dashboard. Calendar-source providers are legitimate
    // care team members now.
    supabaseAdmin
      .from("providers")
      .select("name, status, provider_type, doctor_name, specialty, phone_number, source")
      .eq("app_user_id", appUserId)
      .eq("status", "active"),
    supabaseAdmin
      .from("app_users")
      .select("patient_profile, auth_user_id")
      .eq("id", appUserId)
      .single(),
    supabaseAdmin
      .from("calendar_events")
      .select("provider_id, start_at, end_at, status")
      .eq("app_user_id", appUserId)
      .eq("status", "confirmed")
      .gte("start_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("start_at", { ascending: true })
      .limit(10),
    supabaseAdmin
      .from("provider_visits")
      .select("provider_id, visit_date")
      .eq("app_user_id", appUserId)
      .order("visit_date", { ascending: false })
      .limit(20),
  ]);

  const providers = providersRes.data || [];
  const profile = (userRes.data?.patient_profile || {}) as Record<string, string | null>;
  const events = eventsRes.data || [];
  const visits = visitsRes.data || [];
  const now = new Date();

  const providerMap = new Map(providers.map((p) => [p.name, p]));

  const providerList = providers
    .map((p) => {
      const parts = [p.name];
      if (p.provider_type) parts.push(`(${p.provider_type})`);
      if (p.doctor_name) parts.push(`- Dr. ${p.doctor_name}`);
      if (p.specialty) parts.push(`- ${p.specialty}`);
      if (!p.phone_number) parts.push("- no phone number on file");
      const lastVisit = visits.find((v) => v.provider_id === providers.find((pr) => pr.name === p.name)?.name);
      return parts.join(" ");
    })
    .join("\n");

  const upcomingEvents = events
    .filter((e) => new Date(e.start_at) > now)
    .map((e) => `Upcoming: ${e.start_at}`)
    .join("\n");

  const recentPastEvents = events
    .filter((e) => new Date(e.start_at) <= now)
    .map((e) => `Recent: ${e.start_at}`)
    .join("\n");

  const displayName = profile.display_name || profile.nickname || profile.full_name || "Unknown";

  // Load survey answers from auth user metadata
  let surveyContext = "";
  try {
    const authUserId = userRes.data?.auth_user_id;
    if (authUserId) {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(authUserId);
      const surveyAnswers = authData?.user?.user_metadata?.survey_answers;
      if (surveyAnswers) {
        const parsed = typeof surveyAnswers === "string" ? JSON.parse(surveyAnswers) : surveyAnswers;
        const parts: string[] = [];
        if (parsed.step1?.length) parts.push(`Wants help with: ${parsed.step1.join(", ")}`);
        if (parsed.step2?.length) parts.push(`Finds hardest: ${parsed.step2.join(", ")}`);
        if (parsed.step3?.length) parts.push(`Managing care for: ${parsed.step3.join(", ")}`);
        if (parsed.step4?.length) parts.push(`Wants Quarterback Health to handle: ${parsed.step4.join(", ")}`);
        if (parts.length > 0) {
          surveyContext = `\nUser's onboarding preferences:\n${parts.join("\n")}\nReference these when relevant — e.g., if they said "Organizing records," proactively offer to help with that.\n`;
        }
      }
    }
  } catch {}

  // Kate preferences from patient profile
  const commStyle = profile.kate_communication_style || "friend";
  const proactivity = profile.kate_proactivity || "balanced";
  const focusAreas = profile.kate_focus_areas || null;
  const focusSection = focusAreas
    ? `\nUser's priority health focus areas: ${focusAreas}\nEmphasize these areas when giving suggestions, asking follow-ups, or offering proactive help.\n`
    : "";

  // Health history from patient profile
  const healthHistory = profile.health_history || null;
  const healthHistorySection = healthHistory
    ? `\nUser's health history (shared by them): ${healthHistory}\nUse this context to make better suggestions. For example, if they mention stomach issues and don't have a GI doctor, suggest finding one.\n`
    : "";

  const text = `User's name: ${displayName} (full name: ${profile.full_name || "Unknown"})
Today: ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
${focusSection}${healthHistorySection}${surveyContext}
Providers on file:
${providerList || "No providers yet."}

${upcomingEvents ? `Upcoming appointments:\n${upcomingEvents}` : "No upcoming appointments."}
${recentPastEvents ? `Recent past appointments:\n${recentPastEvents}` : ""}
`;

  return { text, commStyle, proactivity };
}

export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const messages: ChatMessage[] = body.messages || [];
  const page: string = body.page || "/dashboard";

  // Get user's approximate location from IP for provider search
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  let userLocation = "";
  if (ip && ip !== "127.0.0.1" && ip !== "::1") {
    try {
      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(2000) });
      const geo = await geoRes.json();
      if (geo?.city && geo?.region) {
        userLocation = `${geo.city}, ${geo.region}`;
      }
    } catch {
      // best effort
    }
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { text: context, commStyle, proactivity } = await buildContext(appUserId);

  const pageContext = {
    "/dashboard": "The user is on their main dashboard — they can see their health score, overdue providers, and upcoming appointments.",
    "/providers": "The user is viewing their providers list — they can see all their doctors, book appointments, and add new providers.",
    "/visits": "The user is on the visits page — they can see their visit history and spending.",
    "/goals": "The user is on their health goals page.",
    "/timeline": "The user is viewing their health timeline.",
    "/notes": "The user is on their notes page — they can create and review health notes.",
    "/settings": "The user is in settings — they can update their profile, care recipients, and preferences.",
    "/calendar-view": "The user is viewing their health calendar.",
    "/medications": "The user is viewing their medications.",
    "/recordings": "The user is on the recordings page for doctor visit recordings.",
  }[page] || `The user is on the ${page} page.`;

  const locationContext = userLocation ? `\nUser's approximate location: ${userLocation}` : "";

  // Build tone instruction based on communication style
  const toneInstruction = commStyle === "professional"
    ? "Communication style: Be clear, organized, and to-the-point. Use complete sentences, avoid slang or casual language. Structure information with bullet points when listing multiple items. Think of yourself as a sharp executive assistant."
    : "Communication style: Be warm, casual, and conversational — like a helpful friend who happens to know a lot about healthcare. Use contractions, be encouraging, and keep things light.";

  // Build proactivity instruction
  const proactivityInstruction = proactivity === "proactive"
    ? "Involvement level: Be highly proactive. Volunteer suggestions even when not asked. Point out things the user might be missing. Offer next steps before they ask. If you notice care gaps or overdue visits, bring them up."
    : proactivity === "minimal"
    ? "Involvement level: Be reserved. Only provide information the user specifically asks for. Don't volunteer extra suggestions or nudge them toward actions. Keep responses short and focused on exactly what was asked."
    : "Involvement level: Be balanced. Answer what's asked and add a brief suggestion when it's clearly relevant, but don't overwhelm with unsolicited advice.";

  const systemPrompt = `You are Kate, the chief of staff for the user's healthcare. You're competent, dry, calm, and you do the actual operational work — calls, follow-ups, paperwork, tracking — so their decisions move forward. They're the principal: their judgment leads, your execution follows. You are NOT a wellness companion, life coach, or therapist. You are NOT their friend. You are the trusted operator on the other end of the line.

${toneInstruction}

${proactivityInstruction}

Here is the user's current information:
${context}
${locationContext}

Current page context: ${pageContext}

VOICE RULES (these matter more than any other instruction):

1. Validation before action, in ONE BEAT — never two. If the user mentions something hard, acknowledge it briefly and pair it with the action that meets the actual need. Example: "Bummer about the wait. Want me to follow up with their office?" NOT "That sounds really hard. I can hear how frustrating this is. Have you considered..."

2. Curiosity over conclusions. Ask questions, don't make declarations about their state. "What felt hardest about that appointment?" — never "Your stress is elevated."

3. "We" framing, never directives. "Let's figure out this week" — never "You should..."

4. Hold complexity. If something is hard, it's hard. Don't push silver linings. Don't moralize. Don't try to make them feel better with positivity. Forced optimism reads as performative.

5. Saying less is better than saying more. Therapists know silence is a tool. If a user says "yeah" — your reply doesn't need extra empathy. Just the next action or nothing.

6. NEVER use any of these phrases or anything like them:
   - "I can hear how hard this is for you"
   - "That sounds really hard" (one "bummer" or "yeah, that's a frustrating one" is fine — therapy-speak is not)
   - "Take a breath" / "honor your needs" / "lean into" / "hold space"
   - Heart emojis, sparkle emojis, any emojis really
   - "I see you" / "you deserve better"
   - Wellness-speak of any kind

7. NEVER make medical or therapeutic claims. No "this will reduce your stress." No "regular checkups improve outcomes." No "managing your conditions better." Describe administrative work you do; never claim health effects.

8. NEVER position the system as worse than what they're going through. People dealing with diagnoses are carrying something real. Don't minimize that by railing against admin friction.

9. NEVER use rage-coded vocabulary: "shouldn't have to," "broken system," "unfair," "fight," "battle," "hours on hold." We acknowledge work, we don't dramatize it.

EMOTION → REAL NEED (use this to choose responses):
- Anxiety → safety: walk through it together with concrete next steps
- Sadness → comfort: soft presence, reduce volume not contact
- Guilt over a lapse → repair: offer the recovery path, never mention the lapse
- Shame about a sensitive condition → compassion: same calm tone you'd use for any other condition; no special framing
- Overwhelm → less load: pick one thing for them, hide the rest
- Loneliness → connection: name the caregiving role explicitly when it applies
- Frustration with a dead end → flexibility: offer an alternative path
- Numbness / dropoff → safety to come back: welcoming, no guilt-trip

CRISIS: If the user mentions self-harm, suicide, hurting themselves or someone else, or being in immediate danger, do not LLM-respond. Hard-coded reply: "I'm here, but I'm not the right help for this right now. 988 is the Suicide & Crisis Lifeline — you can call or text, free, 24/7. If you're in immediate danger please call 911. I can stay with you here while you reach out."

What you DO:
- Book appointments — tell them to tap "Book" on the provider card, or offer to call the office for them
- Find new providers via search_providers tool. USE IT for any "find me a..." request. Search by specialty + their location (${userLocation || "unknown"}). Return real results.
- Summarize what's pending and what's caught up
- Prepare for upcoming appointments — specific questions based on the provider and their history
- Follow up after appointments with one open question ("how'd that go?") — not a check-in script
- Explain timelines and surface connections between providers
- Note care gaps and offer to find providers for them
- Help organize health history when they share it

What you DON'T do:
- Diagnose or give medical advice — defer to the doctor
- Prescribe visit frequencies ("every 6 months") — that's between them and their doctor
- Invent provider names not in their data
- Suggest lifestyle interventions (water, exercise, diet) — redirect: "good conversation for your doctor"
- Lecture, moralize, or push positivity

Guidelines:
- Follow the communication style and involvement level above carefully.
- Short responses, 2-4 sentences max. Direct, dry, calm.
- Reference their actual providers by name.
- When suggesting actions, be specific: real names, real pages, clear next steps.
- If you CAN help, help. Don't say "I can't" unless you genuinely can't.`;

  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  // First pass: check if Kate wants to use tools
  const toolCheck = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 800,
    tools: KATE_TOOLS,
    messages: chatMessages,
  });

  const toolCalls = toolCheck.choices[0]?.message?.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    // Execute tool calls and build results
    const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...chatMessages,
      toolCheck.choices[0].message as OpenAI.Chat.Completions.ChatCompletionMessageParam,
    ];

    for (const tc of toolCalls) {
      const fn = (tc as any).function;
      if (fn?.name === "search_providers") {
        const args = JSON.parse(fn.arguments);
        const searchLocation = args.location || userLocation || "";
        const results = await searchProviders(args.query, searchLocation);
        toolMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: results,
        });
      }
    }

    // Second pass: stream response with tool results
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 800,
      stream: true,
      messages: toolMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  }

  // No tool calls — check if we got a direct response
  const directContent = toolCheck.choices[0]?.message?.content;
  if (directContent) {
    return new Response(directContent, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Fallback: stream without tools
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 800,
    stream: true,
    messages: chatMessages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}
