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
  // Fetch providers
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("name, status, provider_type, doctor_name, specialty, phone_number, source")
    .eq("app_user_id", appUserId)
    .eq("status", "active");

  // Fetch user profile
  const { data: user } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  const profile = user?.patient_profile || {};
  const providerList = (providers || [])
    .map((p) => {
      const parts = [p.name];
      if (p.provider_type) parts.push(`(${p.provider_type})`);
      if (p.doctor_name) parts.push(`- Dr. ${p.doctor_name}`);
      if (p.specialty) parts.push(`- ${p.specialty}`);
      if (!p.phone_number) parts.push("- no phone number on file");
      return parts.join(" ");
    })
    .join("\n");

  return `User's name: ${profile.full_name || "Unknown"}
Providers on file:
${providerList || "No providers yet."}
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

  const systemPrompt = `You are Kate, a friendly and helpful healthcare assistant for Quarterback Health. You help users manage their healthcare — tracking providers, booking appointments, understanding their health data, and staying on top of visits.

Here is the user's current information:
${context}

Guidelines:
- Be warm, concise, and helpful. Use short responses (1-3 sentences usually).
- You can suggest actions: booking appointments, adding provider details, connecting their calendar, etc.
- If asked about medical advice, clarify that you're not a doctor — you help with scheduling and organization.
- If you don't know something, say so. Don't make things up.
- Reference their actual providers by name when relevant.
- Keep it conversational, not formal.`;

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
