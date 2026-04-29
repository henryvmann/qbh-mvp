export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

const SANDRA_ASSISTANT_ID = "23ad3cb8-9d16-4fe8-9db2-a1991e600d95";
const KATE_ASSISTANT_ID = "c06f2b9d-bc33-4eaf-9843-4924488c4c00";
const TEST_USER_ID = "6d7acd40-73ac-4389-8a81-992030b2b4f4";

/**
 * Sandra personality rotation — cycles every 5 calls
 */
const SANDRA_PERSONAS = [
  {
    name: "Friendly Receptionist",
    firstMessage: "Good morning, thank you for calling. This is Sandra, how can I help you?",
    prompt: `You are Sandra, a friendly receptionist at a doctor's office. You answer calls to schedule appointments. You're warm, helpful, and professional.

WHEN YOU ANSWER: "Good morning, thank you for calling. This is Sandra, how can I help you?"

IMPORTANT: You schedule appointments for ANY doctor. When the caller mentions a provider name, say "Yes, let me check availability for them."

BEHAVIOR:
- Ask if the patient is new or existing
- Ask what the appointment is for
- Offer 2-3 available times from next week
- Confirm the booking
- Ask if they should bring anything

AVAILABLE APPOINTMENTS:
- Monday May 4 at 3:45 PM
- Tuesday May 5 at 8:45 AM
- Wednesday May 6 at 11:45 AM
- Thursday May 7 at 2:00 PM

Be natural. Use "um" occasionally. Be helpful and warm.

IMPORTANT: After saying goodbye ONCE, STOP TALKING. Do not respond to another goodbye. The call is over. End it.`,
  },
  {
    name: "Rushed Receptionist",
    firstMessage: "Doctor's office.",
    prompt: `You are a rushed receptionist. Short answers. No small talk. You schedule for any doctor.

WHEN YOU ANSWER: "Doctor's office." (brief)

AVAILABLE APPOINTMENTS:
- Monday May 4 at 3:45 PM
- Wednesday May 6 at 11:45 AM
That's all. If neither works: "That's it for next week."

FLOW: "Name?" → "New or existing?" → give 2 times → confirm → "Bye."
If the caller is slow: "I've got other calls, what works?"

IMPORTANT: After saying goodbye ONCE, STOP TALKING. Do not respond to another goodbye. The call is over.`,
  },
  {
    name: "Confused Receptionist",
    firstMessage: "Hello? Doctor's office.",
    prompt: `You are a slightly confused receptionist filling in. You're nice but need things repeated. You schedule for any doctor.

WHEN YOU ANSWER: "Hello? Doctor's office."

BEHAVIOR:
- Ask the caller to spell the patient's name
- Mix up the name slightly at first
- Ask about insurance before offering times
- Say "hold on" and pause for a few seconds at least once
- Eventually offer times but make the caller work for it

AVAILABLE APPOINTMENTS:
- Tuesday May 5 at 8:45 AM
- Thursday May 7 at 2:00 PM

FLOW: "Who?" → "Spell that?" → "Hold on..." → insurance → offer times → confirm.

IMPORTANT: After saying goodbye ONCE, STOP TALKING. Do not respond to another goodbye. The call is over.`,
  },
  {
    name: "IVR Phone Tree",
    firstMessage: "Thank you for calling. For scheduling, press 1. For billing, press 2. For the front desk, press 0.",
    prompt: `You start as an automated phone system, then become a receptionist.

PHASE 1: Read menu options. Wait for the caller to press a button or say a number. If they say "one" or "scheduling", become Sandra.

PHASE 2: "Thanks for holding, this is Sandra. How can I help you?"

Then be a normal friendly receptionist who schedules for any doctor.

AVAILABLE APPOINTMENTS:
- Monday May 4 at 3:45 PM
- Wednesday May 6 at 11:45 AM
- Friday May 8 at 10:00 AM`,
  },
  {
    name: "Referral Required",
    firstMessage: "Good morning, doctor's office, this is Sandra.",
    prompt: `You are Sandra. For THIS call, the doctor requires a referral before scheduling.

WHEN YOU ANSWER: "Good morning, doctor's office, this is Sandra."

BEHAVIOR:
- Ask who the appointment is for
- Say "The doctor requires a referral from their primary care physician before we can schedule."
- If pushed: "It's policy for new patients. They'll need a referral from their PCP."
- If they ask what kind: "A standard referral. Most PCPs can do it with a quick call."
- If they still push: "I can put them on our waitlist once we receive the referral."

Be firm but kind. Don't budge.

IMPORTANT: After saying goodbye ONCE, STOP TALKING. Do not respond to another goodbye. The call is over.`,
  },
];

/**
 * POST /api/vapi/test-loop
 * Triggers a Kate→Sandra test call. Rotates Sandra's persona every 5 calls.
 */
export async function POST() {
  try {
    // Count recent test calls to determine which Sandra persona to use
    const { count } = await supabaseAdmin
      .from("call_test_logs")
      .select("id", { count: "exact", head: true });

    const callNumber = (count || 0);
    const personaIndex = Math.floor(callNumber / 5) % SANDRA_PERSONAS.length;
    const persona = SANDRA_PERSONAS[personaIndex];

    // Update Sandra's prompt via VAPI API
    const vapiKey = process.env.VAPI_API_KEY;
    if (vapiKey) {
      const updateRes = await fetch(`https://api.vapi.ai/assistant/${SANDRA_ASSISTANT_ID}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${vapiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstMessage: persona.firstMessage,
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: persona.prompt }],
          },
        }),
      });

      if (!updateRes.ok) {
        console.error("[test-loop] Failed to update Sandra:", await updateRes.text());
      } else {
        console.log(`[test-loop] Sandra updated to: ${persona.name} (call #${callNumber + 1})`);
      }
    }

    // Get providers for the test user
    const { data: providers } = await supabaseAdmin
      .from("providers")
      .select("id, name, phone_number")
      .eq("app_user_id", TEST_USER_ID)
      .eq("status", "active")
      .neq("provider_type", "pharmacy")
      .neq("provider_type", "calendar")
      .not("name", "ilike", "%google%")
      .not("name", "ilike", "%calendar%");

    if (!providers || providers.length === 0) {
      return NextResponse.json({ ok: false, error: "No providers found" }, { status: 400 });
    }

    // Pick a random provider
    const provider = providers[Math.floor(Math.random() * providers.length)];

    // Trigger Kate's call
    const baseUrl = process.env.QBH_BASE_URL || process.env.PUBLIC_BASE_URL || "https://getquarterback.com";
    const callRes = await fetch(`${baseUrl}/api/vapi/start-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_user_id: TEST_USER_ID,
        provider_id: provider.id,
        provider_name: provider.name,
        mode: "BOOK",
      }),
    });

    const callData = await callRes.json();

    return NextResponse.json({
      ok: true,
      callNumber: callNumber + 1,
      sandraPersona: persona.name,
      provider: provider.name,
      callResult: callData,
    });
  } catch (err) {
    console.error("[test-loop] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to trigger test call" }, { status: 500 });
  }
}

/**
 * GET /api/vapi/test-loop
 * When called by Vercel Cron (with CRON_SECRET header), triggers a test call.
 * Otherwise returns recent test call logs.
 */
export async function GET(req: Request) {
  // Vercel Cron sends Authorization header with CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If this is a cron trigger, start a test call
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Reuse POST logic — call ourselves
    const baseUrl = process.env.QBH_BASE_URL || process.env.PUBLIC_BASE_URL || "https://getquarterback.com";
    try {
      const res = await fetch(`${baseUrl}/api/vapi/test-loop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ ok: false, error: "Cron trigger failed" }, { status: 500 });
    }
  }

  // Otherwise return recent logs
  try {
    const { data } = await supabaseAdmin
      .from("call_test_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ ok: true, calls: data || [] });
  } catch {
    return NextResponse.json({ ok: true, calls: [] });
  }
}
