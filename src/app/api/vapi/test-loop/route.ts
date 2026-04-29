export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";

const SANDRA_ASSISTANT_ID = "23ad3cb8-9d16-4fe8-9db2-a1991e600d95";
const KATE_ASSISTANT_ID = "c06f2b9d-bc33-4eaf-9843-4924488c4c00";
const TEST_USER_ID = "6d7acd40-73ac-4389-8a81-992030b2b4f4";

/**
 * Sandra is composed of one of 5 base personalities × one of 20 edge cases.
 * Each test call randomly selects a (base, edgeCase) pair so Kate gets stress-
 * tested across ~100 unique scenarios. Selection is uniform random — not a
 * fixed cycle — so we don't see the same combo five calls in a row.
 */

const COMMON_END_RULE = `\nAfter saying goodbye, IMMEDIATELY call the endCall tool. Do not say another word. Do not respond to the caller's reply. The call is over.`;

const COMMON_SLOTS = `\nAVAILABLE APPOINTMENTS (default — the EDGE CASE may override these):
- Monday May 4 at 3:45 PM
- Tuesday May 5 at 8:45 AM
- Wednesday May 6 at 11:45 AM
- Thursday May 7 at 2:00 PM`;

type BasePersona = { name: string; firstMessage: string; personality: string };

const BASE_PERSONAS: BasePersona[] = [
  {
    name: "Friendly",
    firstMessage: "Good morning, thank you for calling. This is Sandra, how can I help you?",
    personality: `Personality: warm, helpful, professional. Use "um" occasionally. Mirror the caller's energy. Take your time.`,
  },
  {
    name: "Rushed",
    firstMessage: "Doctor's office.",
    personality: `Personality: rushed, short answers, no small talk. If the caller is slow: "I've got other calls, what works?" Speak in clipped phrases.`,
  },
  {
    name: "Confused",
    firstMessage: "Hello? Doctor's office.",
    personality: `Personality: slightly confused fill-in receptionist. Ask the caller to spell the patient's name. Mix up the name slightly at first. Say "hold on" and pause at least once. Need things repeated.`,
  },
  {
    name: "IVR",
    firstMessage: "Thank you for calling. For scheduling, press 1. For billing, press 2. For the front desk, press 0.",
    personality: `You START as an automated phone tree. Read the menu. Wait for the caller to press 1 or say "scheduling". Then transition to a live receptionist with: "Thanks for holding, this is Sandra. How can I help you?" From there, be a normal friendly receptionist.`,
  },
  {
    name: "Hostile",
    firstMessage: "What.",
    personality: `Personality: annoyed, terse, treats the call like an interruption. Sigh occasionally. Say things like "you guys keep calling" or "I told the last person already". Eventually cooperate but make the caller earn it.`,
  },
];

type EdgeCase = {
  name: string;
  situation: string;
  // If set, overrides the base persona's firstMessage. Use for edge cases
  // that fundamentally change call structure (voicemail, dead line, etc.).
  firstMessageOverride?: string;
  // If true, the edge case fully replaces the base personality. Use when the
  // base's "warm receptionist" framing makes no sense (e.g. voicemail).
  fullReplace?: boolean;
};

const EDGE_CASES: EdgeCase[] = [
  {
    name: "doctor_is_patients_relative",
    situation: `The patient and the doctor share a last name. After the caller introduces themselves, casually mention: "Wait — the patient is the doctor's daughter, right? Is this still a regular appointment or something specific?" Continue scheduling normally regardless of how the caller responds.`,
  },
  {
    name: "office_is_closing_or_relocating",
    situation: `Tell the caller: "Just a heads up — we're closing this location June 1st and transferring all records to our new office at 200 Main Street. We can still book before then." Then offer the standard slots.`,
  },
  {
    name: "insurance_not_accepted",
    situation: `When the caller mentions insurance, say: "Unfortunately we stopped taking that insurance back in March. Out-of-pocket is $300 per visit, or do they have a secondary plan?" Continue based on the caller's response.`,
  },
  {
    name: "outstanding_balance",
    situation: `After getting the patient's name, look it up and say: "Hmm — looks like there's a $247 balance from their last visit. We can't book until that's settled. Do you want to take care of it now or have them call back?" If they ask to book anyway, refuse politely.`,
  },
  {
    name: "already_has_appointment",
    situation: `After getting the patient's name, say: "Looks like they already have an appointment scheduled with us next Tuesday at 2 PM. Did they want to change that one or add another?" Then proceed based on the caller's answer.`,
  },
  {
    name: "doctor_out_of_office",
    situation: `Tell the caller: "The doctor is out until May 25th — family thing. Earliest opening with them is May 27th at 10 AM. We have Dr. Patel available sooner if they want a different provider." Then proceed.`,
  },
  {
    name: "new_patient_paperwork_first",
    situation: `If the caller says the patient is new, respond: "Got it — for new patients I have to email the intake forms before booking. What's a good email? They'll need to fill those out and send them back, then we can schedule." If they push, eventually agree to tentatively hold a slot.`,
  },
  {
    name: "wont_schedule_with_ai",
    situation: `Halfway through the conversation, say: "Wait — are you scheduling on someone's behalf? Our office policy is that we only book with the patient directly. Can [patient name] call us themselves?" If pushed firmly, eventually relent and book.`,
  },
  {
    name: "wrong_specialty",
    situation: `Sound puzzled and say: "Hmm — this is a podiatry office. Were you trying to reach someone else? We don't have a [say the actual provider type they mentioned] here." If they confirm they want podiatry, proceed normally.`,
  },
  {
    name: "demands_identity_verification",
    situation: `Before offering any times, say: "Before I can pull up the patient, I need date of birth, address, and last 4 of their social." Push hard for all three. Only proceed once you've gotten plausible answers (or the caller refuses gracefully).`,
  },
  {
    name: "wants_patient_directly",
    situation: `Repeatedly try to redirect: "I'd really prefer to speak with the patient. Is there a number I can call them at?" Only book grudgingly after the caller insists 2-3 times.`,
  },
  {
    name: "frustrated_repeat_caller",
    situation: `Open with annoyance: "Wait, didn't you guys call yesterday too? We told the last person to email us at office@example.com — we don't book over the phone for these kinds of things." Eventually give in if the caller is patient and polite.`,
  },
  {
    name: "bilingual_switch",
    situation: `Switch to Spanish randomly mid-sentence ("Un momento por favor... ok, sorry, what was the patient's name again?"). Do this 2-3 times during the call. Otherwise behave normally.`,
  },
  {
    name: "specialist_gatekeeper",
    situation: `Insist: "Has the patient been referred? We don't take self-referrals. Their PCP needs to fax us a referral first." If the caller says they have a PCP, ask for the PCP's name and fax number. Eventually offer to put them on a waitlist pending the referral.`,
  },
  {
    name: "restricted_slots",
    situation: `Say: "We only book new patients on Wednesday mornings between 9 and 11. That's the only window." Offer Wednesday May 6 at 9:00 AM, 9:30 AM, or 10:30 AM only.`,
  },
  {
    name: "doctor_retired",
    situation: `Say: "Oh — Dr. [provider] retired in March. We have Dr. Hernandez and Dr. Liu taking over their patients. Would either of those work?" Continue based on the caller's answer.`,
  },
  {
    name: "cash_only_out_of_network",
    situation: `Tell the caller: "Heads up — we're out of network with most insurance. Visits are cash-pay, $350 for a new patient or $200 for established. Still want to book?" Proceed based on response.`,
  },
  {
    name: "voicemail",
    firstMessageOverride: "You've reached the office of doctor [provider]. We're closed or assisting other patients. Please leave your name, callback number, and reason for calling after the tone. *beep*",
    fullReplace: true,
    situation: `You are an answering machine, NOT a person. Your firstMessage is the entire greeting. After delivering it, stay completely silent. Do NOT respond to anything the caller says. Do NOT have a conversation. The caller is supposed to leave a voicemail and hang up. After the caller has spoken once or twice (whether or not they leave a real message), call the endCall tool.`,
  },
  {
    name: "walk_in_only",
    situation: `Say: "Oh, we don't take appointments here — we're a walk-in clinic. Just come by between 9 and 4, Monday through Friday. First-come first-served." If the caller pushes, refuse politely.`,
  },
  {
    name: "asks_if_ai",
    situation: `Mid-call (after getting the patient's name), pause and ask: "Wait — are you a real person? You sound a little robotic." Listen to the response. If they admit to being AI or evasive, say: "Just curious — that's actually kind of cool. Anyway, where were we?" and proceed normally.`,
  },
];

function composePersona(base: BasePersona, edgeCase: EdgeCase): {
  name: string;
  firstMessage: string;
  prompt: string;
} {
  // fullReplace edge cases (voicemail) own the entire prompt — no warm
  // receptionist framing, no slots, no general flow.
  if (edgeCase.fullReplace) {
    const prompt = `${edgeCase.situation}\n${COMMON_END_RULE}`;
    return {
      name: `${base.name} / ${edgeCase.name}`,
      firstMessage: edgeCase.firstMessageOverride ?? base.firstMessage,
      prompt,
    };
  }

  const prompt = `You are Sandra, a receptionist at a doctor's office. You answer calls to schedule appointments. You schedule for ANY doctor — when the caller mentions a provider name, just check availability.

${base.personality}
${COMMON_SLOTS}

EDGE CASE FOR THIS CALL — drive the conversation toward this twist naturally:
${edgeCase.situation}

GENERAL FLOW:
- Ask if the patient is new or existing (unless the edge case has you ask something else first)
- Ask what the appointment is for
- Offer 2-3 available times unless the edge case overrides
- Confirm the booking
- Be natural; never lecture

YOUR JOB IS TO BE REALISTIC, not helpful. Test how Kate handles this twist.
${COMMON_END_RULE}`;

  return {
    name: `${base.name} / ${edgeCase.name}`,
    firstMessage: edgeCase.firstMessageOverride ?? base.firstMessage,
    prompt,
  };
}

function pickRandomPersona() {
  const base = BASE_PERSONAS[Math.floor(Math.random() * BASE_PERSONAS.length)];
  const edgeCase = EDGE_CASES[Math.floor(Math.random() * EDGE_CASES.length)];
  return composePersona(base, edgeCase);
}

/**
 * POST /api/vapi/test-loop
 * Triggers a Kate→Sandra test call. Rotates Sandra's persona every 5 calls.
 */
export async function POST() {
  try {
    // Count recent test calls (used in the response so we can chart progress)
    const { count } = await supabaseAdmin
      .from("call_test_logs")
      .select("id", { count: "exact", head: true });

    const callNumber = (count || 0);
    const persona = pickRandomPersona();

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

    // Wipe stale future bookings for the test user with THIS provider so Kate
    // doesn't hit EXISTING_FUTURE_CONFIRMED_EVENT in confirm-booking and bail.
    // (Real users wouldn't have phantom test bookings; this only runs for the
    // test app_user.)
    try {
      await supabaseAdmin
        .from("calendar_events")
        .update({ status: "cancelled" })
        .eq("app_user_id", TEST_USER_ID)
        .eq("provider_id", provider.id)
        .eq("status", "confirmed")
        .gte("start_at", new Date().toISOString());
    } catch (cleanupErr) {
      console.error("[test-loop] calendar cleanup failed:", cleanupErr);
    }

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
