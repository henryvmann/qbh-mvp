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
          content: `You are a health goal advisor for Quarterback Health. The user will share what they want to work on health-wise. Generate 2-4 specific, actionable health goals based on their input.

Each goal should be:
- Specific and measurable (not vague)
- Achievable within 1-6 months
- Related to healthcare management (appointments, screenings, medications, lifestyle)
- Actionable — something QB can help track

The user's current providers: ${providerNames || "none listed yet"}

Return JSON: { "goals": [{ "title": "short goal title", "detail": "one sentence explaining why and what to do" }] }

Examples of good goals:
- "Schedule annual physical" — "It's been over a year. A routine checkup catches problems early."
- "Get blood pressure checked" — "Regular monitoring helps prevent heart disease."
- "Schedule dermatology screening" — "Annual skin checks are recommended for early detection."
- "Review current medications with doctor" — "A medication review ensures everything is still needed and working."

Do NOT give medical advice. Frame goals around scheduling, screening, and staying organized — not treatment decisions.`
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
    return NextResponse.json({ ok: true, goals: parsed.goals || [] });
  } catch (err) {
    console.error("[goals/suggest] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to generate suggestions" }, { status: 500 });
  }
}
