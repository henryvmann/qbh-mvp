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
          content: `You are Kate, a care coordinator for Quarterback Health. The user will share a health topic or goal they want to work on. Your job is to:

1. Acknowledge what they want to focus on warmly
2. Tell them which TYPES of providers typically help with that area (this is care coordination, not medical advice)
3. Suggest specific goals around adding those providers, booking appointments, or getting organized

The user's current providers: ${providerNames || "none listed yet"}

Return JSON: {
  "response": "A 2-3 sentence warm response. First acknowledge their focus area. Then explain which provider types typically work in that area (e.g., 'Heart health is usually managed by your primary care doctor and a cardiologist. A nutritionist can also play a role.'). Then offer to help them get organized.",
  "goals": [{ "title": "short goal title", "detail": "one sentence explaining what Kate will help with" }]
}

IMPORTANT — when suggesting provider types for a health topic:
- Heart health → Primary care, Cardiologist, Nutritionist. Mention cholesterol, blood panels as things their doctor can test.
- Digestive/stomach issues → Primary care, Gastroenterologist, Nutritionist
- Mental health → Therapist, Psychiatrist, Psychiatric NP (APRN/PMHNP), Primary care
- Joint/bone pain → Orthopedist, Physical therapist, Primary care
- Skin concerns → Dermatologist, Primary care
- Weight management → Nutritionist, Primary care, Endocrinologist
- Women's health → OB/GYN, Primary care
- Eye health → Optometrist, Ophthalmologist
- General wellness → Primary care, Dentist, Eye doctor

This is NOT medical advice — you are telling them which TYPES OF DOCTORS handle their area of concern. This is exactly what a care coordinator does.

CRITICAL: You MUST suggest specific provider types in your response. Do NOT say "I can't provide health advice." You are NOT giving health advice — you are telling them which doctors to see. That is your job.

Example response for "heart health":
"Heart health is typically managed by your primary care doctor and a cardiologist. A nutritionist can also help with things like cholesterol management. Let me help you get the right team in place."

Goals should be about:
- Adding a specific provider type ("Add a cardiologist to your care team")
- Booking with an existing provider ("Book with your PCP to discuss heart health")
- Getting organized ("Ask your doctor about relevant lab work like cholesterol panels")
- Tracking and follow-up ("Set a reminder to follow up after your visit")

Do NOT suggest lifestyle habits (water, exercise, diet, sleep). Do NOT prescribe screening frequencies. But DO tell them which provider types are relevant.`
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
