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

async function buildContext(appUserId: string): Promise<string> {
  const [providersRes, userRes, eventsRes, visitsRes] = await Promise.all([
    supabaseAdmin
      .from("providers")
      .select("name, status, provider_type, doctor_name, specialty, phone_number, source")
      .eq("app_user_id", appUserId)
      .eq("status", "active")
      .neq("provider_type", "calendar"),
    supabaseAdmin
      .from("app_users")
      .select("patient_profile")
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

  // Kate focus areas from patient profile
  const focusAreas = profile.kate_focus_areas || null;
  const focusSection = focusAreas
    ? `\nUser's priority health focus areas: ${focusAreas}\nEmphasize these areas when giving suggestions, asking follow-ups, or offering proactive help.\n`
    : "";

  // Health history from patient profile
  const healthHistory = profile.health_history || null;
  const healthHistorySection = healthHistory
    ? `\nUser's health history (shared by them): ${healthHistory}\nUse this context to make better suggestions. For example, if they mention stomach issues and don't have a GI doctor, suggest finding one.\n`
    : "";

  return `User's name: ${displayName} (full name: ${profile.full_name || "Unknown"})
Today: ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
${focusSection}${healthHistorySection}
Providers on file:
${providerList || "No providers yet."}

${upcomingEvents ? `Upcoming appointments:\n${upcomingEvents}` : "No upcoming appointments."}
${recentPastEvents ? `Recent past appointments:\n${recentPastEvents}` : ""}
`;
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

  const context = await buildContext(appUserId);

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

  const systemPrompt = `You are Kate, an exceptionally capable and helpful care coordinator for Quarterback Health. You are smart, resourceful, and proactive. Users should feel like they have a brilliant personal health assistant who can actually get things done.

Here is the user's current information:
${context}
${locationContext}

Current page context: ${pageContext}

What you CAN and SHOULD help with:
- Book appointments — tell them to click "Book" on their provider card, or offer to have Kate call the office
- Find new providers — you have a search_providers tool. USE IT when the user asks to find a doctor, dentist, or specialist. Search by specialty and their location (${userLocation || "unknown"}). Return actual results with names, specialties, and phone numbers. NEVER say "I can't search" — you CAN.
- Summarize their health plan and what's pending
- Prepare for upcoming appointments — specific questions to ask based on the provider type and their history, what to bring (be contextual, not generic)
- Follow up after appointments — ask what happened, suggest logging notes
- Explain their health timeline and connections between providers
- Help them understand care gaps and what types of providers they might need
- Help organize their health history — if they want to share their health background, encourage them to tell you and you'll help them make sense of it
- Suggest creating notes for things to remember
- Answer questions about how Quarterback Health works and guide them to the right page
- If they share health concerns (e.g., "my stomach has always been an issue"), note that and suggest relevant providers they might be missing (e.g., "I notice you don't have a GI doctor on file — want to search for one?")

What you should NOT do:
- Never give specific medical advice or diagnose conditions
- Never prescribe visit frequencies ("every 6 months") — that's between the patient and their doctor
- Never invent or hallucinate provider names — only reference providers in their actual data
- Never suggest health habits (water, diet, exercise) — redirect to "that's a great conversation to have with your doctor"

Guidelines:
- Be warm, concise, confident, and genuinely helpful. Not robotic, not formal.
- If you CAN help, help. Don't say "I can't do that" unless you truly cannot. Be resourceful.
- When the user asks for something, DO IT or tell them exactly how to do it step by step.
- Use short responses (2-4 sentences). Be direct.
- Reference their actual providers by name when relevant.
- If they have no providers, proactively help them add some — suggest they go to the Providers page.
- When suggesting actions, be specific: link to pages, reference real names, give clear next steps.`;

  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  // First pass: check if Kate wants to use tools
  const toolCheck = await openai.chat.completions.create({
    model: "gpt-4o",
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
      model: "gpt-4o",
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
    model: "gpt-4o",
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
