import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const provider_uuid = String(body?.provider_id || '').trim();

    if (!provider_uuid) {
      return NextResponse.json({ ok: false, error: 'provider_id (UUID) is required' }, { status: 400 });
    }

    const office_number = process.env.DEMO_OFFICE_NUMBER;
    if (!office_number) {
      return NextResponse.json({ ok: false, error: 'DEMO_OFFICE_NUMBER not set' }, { status: 500 });
    }

    const apiKey = process.env.VAPI_API_KEY;
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

    if (!apiKey || !assistantId || !phoneNumberId) {
      return NextResponse.json(
        { ok: false, error: 'Missing VAPI_API_KEY / VAPI_ASSISTANT_ID / VAPI_PHONE_NUMBER_ID' },
        { status: 500 }
      );
    }

    // 1) Create schedule_attempt (legacy bigint provider_id required; set to 0)
    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from('schedule_attempts')
      .insert({
        provider_id: 0, // legacy required bigint placeholder
        provider_uuid,  // real provider UUID
        demo_autoconfirm: true,
        office_phone: office_number,
        status: 'APPROVED',
        metadata: { source: 'followup/approve' },
      })
      .select('id')
      .single();

    if (attemptErr || !attempt?.id) {
      console.error('approve: failed to create schedule_attempts', attemptErr);
      return NextResponse.json(
        { ok: false, error: 'Failed to create schedule_attempt', detail: attemptErr?.message },
        { status: 500 }
      );
    }

    const attempt_id = attempt.id; // bigint

    // 2) Start Vapi call
    const vapiRes = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId,
        assistantId,
        customer: { number: office_number, numberE164CheckEnabled: false },
        assistantOverrides: {
          variableValues: {
            attempt_id,              // bigint
            provider_id: provider_uuid, // send UUID as provider_id for the assistant context
            demo_autoconfirm: true,
          },
        },
      }),
    });

    const vapiJson = await vapiRes.json().catch(() => ({}));

    if (!vapiRes.ok) {
      console.error('approve: vapi call create failed', vapiRes.status, vapiJson);
      await supabaseAdmin
        .from('schedule_attempts')
        .update({
          status: 'FAILED',
          metadata: { last_event: 'VAPI_CALL_CREATE_FAILED', vapi_status: vapiRes.status, vapi_error: vapiJson },
        })
        .eq('id', attempt_id);

      return NextResponse.json(
        { ok: false, error: 'Vapi call create failed', status: vapiRes.status, vapi: vapiJson, attempt_id },
        { status: 500 }
      );
    }

    const vapi_call_id = vapiJson?.id ?? vapiJson?.call?.id ?? null;

    await supabaseAdmin
      .from('schedule_attempts')
      .update({
        status: 'CALLING',
        vapi_call_id,
        vapi_assistant_id: assistantId,
        office_phone: office_number,
        metadata: { last_event: 'CALLING' },
      })
      .eq('id', attempt_id);

    revalidatePath('/providers');

    return NextResponse.json({ ok: true, attempt_id, vapi: vapiJson });
  } catch (e: any) {
    console.error('approve: unexpected error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 });
  }
}