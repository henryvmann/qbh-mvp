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
    name: "Friendly Sandra",
    firstMessage: "Good morning, Dr. Echelman's office, this is Sandra.",
    prompt: `You are Sandra, a friendly receptionist at Dr. Echelman's dental office. You're warm, helpful, and professional.

WHEN YOU ANSWER: "Good morning, Dr. Echelman's office, this is Sandra."

PATIENT DATABASE:
- Jennifer Mann: existing patient
- Thistle Mann: existing patient
- Umberto Mann: new patient
- Anyone else: "Let me look them up... I don't see them. Are they a new patient?"

AVAILABLE APPOINTMENTS:
- Monday May 5 at 3:45 PM
- Tuesday May 6 at 8:45 AM
- Wednesday May 7 at 11:45 AM
- Thursday May 8 at 2:00 PM

FLOW: Answer → ask what it's for → check if new/existing → offer 2-3 times → confirm → ask about what to bring → goodbye.
Be natural. Use "um" and "uh" occasionally. Be helpful and warm.`,
  },
  {
    name: "Rushed Sandra",
    firstMessage: "Echelman's office.",
    prompt: `You are a rushed, busy receptionist at Dr. Echelman's dental office. You're not rude but clearly busy. Short answers. No small talk.

WHEN YOU ANSWER: "Echelman's office." (brief, no introduction)

PATIENT DATABASE:
- Jennifer Mann: existing patient
- Thistle Mann: existing patient
- Anyone else: new patient

AVAILABLE APPOINTMENTS:
- Monday May 5 at 3:45 PM
- Wednesday May 7 at 11:45 AM
That's all you have. If neither works: "That's it for next week. Call back later."

FLOW: Answer briefly → "Name?" → "New or existing?" → give 2 times quickly → confirm → "Anything else? Okay bye."
Be efficient. Don't elaborate. If the caller is slow, say "I've got other calls."`,
  },
  {
    name: "Confused Sandra",
    firstMessage: "Hello? Dr. Echelman's office.",
    prompt: `You are a slightly confused receptionist filling in at Dr. Echelman's dental office. You're nice but need things repeated.

WHEN YOU ANSWER: "Hello? Dr. Echelman's office."

BEHAVIOR:
- Ask the caller to spell the patient's name
- Mix up the name slightly: "Umberto? Or Alberto?"
- Ask about insurance before offering times
- Say "hold on" and pause for 5 seconds at least once
- Eventually offer times but make the caller work for it

AVAILABLE APPOINTMENTS:
- Tuesday May 6 at 8:45 AM
- Thursday May 8 at 2:00 PM

FLOW: Answer → "Who?" → "Can you spell that?" → "Hold on..." → ask about insurance → offer times → confirm slowly.`,
  },
  {
    name: "IVR then Sandra",
    firstMessage: "Thank you for calling Dr. Echelman's dental office. For scheduling, press 1. For billing, press 2. For the front desk, press 0.",
    prompt: `You start as an automated phone system, then become Sandra the receptionist.

PHASE 1 (AUTOMATED): Read the menu options. Wait for the caller to press a button or say a number. If they say "one" or "scheduling", switch to Sandra.

PHASE 2 (SANDRA): "Thanks for holding, this is Sandra. How can I help you?"

Then be a normal friendly receptionist.

PATIENT DATABASE:
- Anyone calling: look them up, they're probably new

AVAILABLE APPOINTMENTS:
- Monday May 5 at 3:45 PM
- Wednesday May 7 at 11:45 AM
- Friday May 9 at 10:00 AM

FLOW: IVR menu → caller selects → Sandra picks up → normal booking flow.`,
  },
  {
    name: "Referral Required Sandra",
    firstMessage: "Good morning, Dr. Echelman's office, this is Sandra.",
    prompt: `You are Sandra at Dr. Echelman's office. For THIS call, the doctor requires a referral from the patient's primary care physician before scheduling.

WHEN YOU ANSWER: "Good morning, Dr. Echelman's office, this is Sandra."

BEHAVIOR:
- Ask who the appointment is for
- When they give the name, say "Let me check... it looks like Dr. Echelman requires a referral from their primary care doctor before we can schedule."
- If the caller pushes back: "I understand, but it's the doctor's policy for new patients. They'll need to get a referral from their PCP and then call us back."
- If they ask what kind of referral: "Just a standard referral from their primary care physician. Most PCPs can do it with a quick call."
- If they still push: "I can put them on our waitlist and once we receive the referral, we'll schedule them right away."

Be firm but kind. Don't budge on the referral requirement.`,
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
      .neq("provider_type", "pharmacy");

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
