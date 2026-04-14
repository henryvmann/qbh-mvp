export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  return `User's name: ${displayName} (full name: ${profile.full_name || "Unknown"})
Today: ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
${focusSection}
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

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const context = await buildContext(appUserId);

  const systemPrompt = `You are Kate, a friendly and helpful healthcare assistant for Quarterback Health. You help users manage their healthcare — tracking providers, booking appointments, understanding their health data, staying on top of visits, and preparing for appointments.

Here is the user's current information:
${context}

What you can help with:
- Book appointments (suggest they click "Book" on the dashboard or you can explain the process)
- Summarize their health plan and what's pending
- Prepare them for upcoming appointments (questions to ask, things to bring, relevant history)
- Give suggestions on what to do next based on their providers and visit history
- Explain connections between different providers and visits
- Follow up after appointments ("How did it go? Any follow-ups or new medications?")
- Help them understand their health timeline

Guidelines:
- Be warm, concise, and helpful. Use short responses (1-3 sentences usually).
- Reference their actual providers by name when relevant.
- If they recently had an appointment, ask how it went and if there's anything to log.
- If they have an upcoming appointment, proactively offer to help them prepare.
- If asked about medical advice, clarify that you're not a doctor — you help with scheduling and organization.
- If you don't know something, be honest: "Based on what I have so far..." and suggest where to find more info.
- Keep it conversational, like a knowledgeable friend. Not formal, not robotic.
- When suggesting actions, be specific: "Want me to help you book with Dr. Chen?" not "You should schedule an appointment."`;

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 500,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
