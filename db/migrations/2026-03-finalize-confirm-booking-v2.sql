create or replace function public.finalize_confirm_booking(
  p_attempt_id bigint,
  p_proposal_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_attempt public.schedule_attempts%rowtype;
  v_proposal public.proposals%rowtype;
  v_calendar_event_id uuid;
begin
  select *
  into v_attempt
  from public.schedule_attempts
  where id = p_attempt_id;

  if v_attempt.id is null then
    raise exception 'schedule_attempt not found for id %', p_attempt_id;
  end if;

  select *
  into v_proposal
  from public.proposals
  where id = p_proposal_id
    and attempt_id = p_attempt_id;

  if v_proposal.id is null then
    raise exception 'proposal not found for id % and attempt %', p_proposal_id, p_attempt_id;
  end if;

  if v_attempt.app_user_id is null then
    raise exception 'schedule_attempt % missing app_user_id', p_attempt_id;
  end if;

  if v_attempt.provider_id is null then
    raise exception 'schedule_attempt % missing provider_id', p_attempt_id;
  end if;

  if v_proposal.normalized_start is null or v_proposal.normalized_end is null then
    raise exception 'proposal % missing normalized times', p_proposal_id;
  end if;

  insert into public.calendar_events (
    app_user_id,
    provider_id,
    start_at,
    end_at,
    status,
    source,
    attempt_id,
    proposal_id
  )
  values (
    v_attempt.app_user_id,
    v_attempt.provider_id,
    v_proposal.normalized_start,
    v_proposal.normalized_end,
    'confirmed',
    'qbh',
    v_attempt.id,
    v_proposal.id
  )
  on conflict (proposal_id) where proposal_id is not null
  do update set
    app_user_id = excluded.app_user_id,
    provider_id = excluded.provider_id,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    status = excluded.status,
    source = excluded.source,
    attempt_id = excluded.attempt_id
  returning id into v_calendar_event_id;

  insert into public.portal_facts (
    app_user_id,
    provider_id,
    fact_type,
    fact_json,
    fact_date,
    source,
    attempt_id,
    proposal_id
  )
  values (
    v_attempt.app_user_id,
    v_attempt.provider_id,
    'booking_confirmed',
    jsonb_build_object(
      'calendar_event_id', v_calendar_event_id,
      'start_at', v_proposal.normalized_start,
      'end_at', v_proposal.normalized_end
    ),
    (v_proposal.normalized_start::date),
    'qbh',
    v_attempt.id,
    v_proposal.id
  )
  on conflict (proposal_id) where fact_type = 'booking_confirmed'
  do update set
    fact_json = excluded.fact_json,
    fact_date = excluded.fact_date;

  update public.schedule_attempts
  set status = 'BOOKED_CONFIRMED'
  where id = v_attempt.id;

  return jsonb_build_object(
    'calendar_event_id', v_calendar_event_id,
    'provider_id', v_attempt.provider_id,
    'app_user_id', v_attempt.app_user_id,
    'start_at', v_proposal.normalized_start,
    'end_at', v_proposal.normalized_end,
    'status', 'BOOKED_CONFIRMED'
  );
end;
$$;