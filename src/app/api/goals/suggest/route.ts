export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionAppUserId } from "../../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../../lib/supabase-server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Takes a user's free-text health concern and generates specific, actionable goals.
 * BAA is signed with OpenAI — PHI is covered under zero-retention.
 */
export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const userInput = String(body?.input || "").trim();

  if (!userInput || userInput.length < 3) {
    return NextResponse.json({ ok: false, error: "Please describe what you'd like to work on" }, { status: 400 });
  }

  try {
    // Get user's provider context for personalized suggestions
    const { data: providers } = await supabaseAdmin
      .from("providers")
      .select("name, status, care_recipient, phone_number")
      .eq("app_user_id", appUserId)
      .eq("status", "active");

    const providerNames = (providers || []).map(p => p.name).join(", ");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a care coordinator for Quarterback Health. The user will share what they want to work on. Generate 2-4 specific, actionable goals based on their input.

Each goal should be:
- About organizing, scheduling, or tracking their healthcare — NOT about health habits
- Actionable — something QB can help with (booking, tracking, following up)
- Related to their actual providers when possible

The user's current providers: ${providerNames || "none listed yet"}

Return JSON: { "response": "A 1-2 sentence warm response from Kate acknowledging what the user wants and explaining how QB can help. Be specific to their input.", "goals": [{ "title": "short goal title", "detail": "one sentence explaining what QB will help with" }] }

Examples of GOOD goals (care coordination):
- "Add your primary care doctor" — "Having your PCP on file lets Kate help manage your visits."
- "Book a follow-up with Dr. Chen" — "It's been a while — want Kate to call and schedule?"
- "Connect your calendar" — "Kate can check for conflicts before booking appointments."
- "Organize your provider contacts" — "Get all your doctor info in one place."

Examples of BAD goals (medical advice — NEVER suggest these):
- "Drink 8 glasses of water a day"
- "Schedule annual skin checks" (don't prescribe frequency)
- "Get blood pressure checked" (that's medical advice)
- "Plan a weekly meal prep session"

NEVER prescribe visit frequencies, health habits, lifestyle changes, or screening schedules. If the user asks about health habits, redirect to care coordination: "Talk to your doctor about that — want Kate to help you book a visit?"`
        },
        {
          role: "user",
          content: userInput,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ ok: true, goals: [] });
    }

    const parsed = JSON.parse(content);
    return NextResponse.json({ ok: true, goals: parsed.goals || [], response: parsed.response || null });
  } catch (err) {
    console.error("[goals/suggest] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to generate suggestions" }, { status: 500 });
  }
}
