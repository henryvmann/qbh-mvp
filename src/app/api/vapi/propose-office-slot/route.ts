import { supabaseAdmin } from '../../../../lib/supabase-server';

type AnyObj = Record<string, any>;

function extractToolCalls(body: AnyObj) {
  const candidates =
    body?.message?.toolCalls ||
    body?.message?.tool_calls ||
    body?.toolCalls ||
    body?.tool_calls ||
    body?.message?.toolCallList ||
    body?.toolCallList ||
    null;

  if (Array.isArray(candidates) && candidates.length > 0) return candidates;

  const toolCallId = body?.toolCallId || body?.tool_call_id || body?.id || null;
  if (!toolCallId) return [];
  return [{ id: toolCallId, function: { arguments: body } }];
}

function parseArgs(tc: AnyObj) {
  let args = tc?.function?.arguments ?? {};
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      args = {};
    }
  }
  return args || {};
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as AnyObj));
  console.log('PROPOSE_OFFICE_SLOT:', JSON.stringify(body, null, 2));

  const toolCalls = extractToolCalls(body);
  if (!toolCalls.length) {
    return Response.json({
      results: [{ toolCallId: 'missing_toolCallId', error: 'Missing toolCallId in request payload' }],
    });
  }

  const results: AnyObj[] = [];

  for (const tc of toolCalls) {
    const toolCallId = tc?.id;
    if (!toolCallId) {
      results.push({ toolCallId: 'missing_toolCallId', error: 'Missing toolCallId in request payload' });
      continue;
    }

    const args = parseArgs(tc);

    const attempt_id = Number(args?.attempt_id);
    const provider_id = String(args?.provider_id || '').trim(); // UUID string (optional)
    const raw = args?.office_offer?.raw_text || '';

  if (!Number.isFinite(attempt_id)) {
    results.push({
      toolCallId,
      result: JSON.stringify({
        message_to_say:
          "Thanks — I’m missing the scheduling context on my side. Could you repeat the date and time once more?",
        next_action: "WAIT_FOR_USER_APPROVAL",
        proposal_id: null,
        conflict: false,
        office_offer_raw: raw,
        error: "Missing or invalid attempt_id",
      }),
    });
    continue;
  }

    // Read demo_autoconfirm from Supabase system-of-record
    let demo_autoconfirm = false;
    const { data: attemptRow } = await supabaseAdmin
      .from("schedule_attempts")
      .select("demo_autoconfirm")
      .eq("id", attempt_id)
      .maybeSingle();

    if (attemptReadErr) {
      console.error('propose-office-slot: schedule_attempts read failed', attemptReadErr);
    }
    if (attemptRow?.demo_autoconfirm === true) demo_autoconfirm = true;

    const message_to_say = demo_autoconfirm
      ? 'Great — that works. Please go ahead and book it.'
      : 'Slot recorded. Awaiting patient approval.';

    const next_action = demo_autoconfirm ? 'CONFIRM_BOOKING' : 'WAIT_FOR_USER_APPROVAL';

    // Insert proposal (FK requires attempt_id exists)
    const { data: proposal, error: propErr } = await supabaseAdmin
      .from('proposals')
      .insert({
        attempt_id,
        tool_call_id: toolCallId,
        office_offer_raw_text: raw || '(empty)',
        conflict: false,
        message_to_say,
        next_action,
        status: 'PROPOSED',
        payload: { provider_id: provider_id || null },
      })
      .select('id')
      .single();

    if (!propErr && proposal?.id) {
      await supabaseAdmin
        .from('schedule_attempts')
        .update({ status: 'PROPOSED', metadata: { last_event: 'PROPOSE_OFFICE_SLOT' } })
        .eq('id', attempt_id);
    } else if (propErr) {
      console.error('propose-office-slot: proposals insert failed', propErr);
    }

    const payload = {
      message_to_say,
      next_action,
      proposal_id: proposal?.id ?? null,
      conflict: false,
      office_offer_raw: raw,
      ...(propErr ? { error: propErr.message } : {}),
    };

    results.push({ toolCallId, result: JSON.stringify(payload) });
  }

  return Response.json({ results });
}