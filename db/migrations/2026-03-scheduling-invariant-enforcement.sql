-- Enforce scheduling invariant inside finalize_confirm_booking.
--
-- Before this migration, the invariant (at most one active future confirmed
-- calendar event per app_user_id + provider_id) was checked only at the
-- application layer in confirm-booking/route.ts. That check has a race
-- condition: two concurrent calls could both pass before either writes.
--
-- This migration adds an atomic check inside the DB function so the invariant
-- is enforced at the transaction level regardless of concurrency.
--
-- Temporary key: (app_user_id, provider_id)
-- Long-term canonical key: (app_user_id, provider_id, profile_id)
-- Do NOT change this to the canonical key until profiles are live.

create or replace function public.finalize_confirm_booking(
  p_attempt_id bigint,
  p_proposal_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_attempt          public.schedule_attempts%rowtype;
  v_proposal         public.proposals%rowtype;
  v_calendar_event_id uuid;
  v_conflicting_event_id uuid;
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

  -- Scheduling invariant check (atomic, inside transaction).
  -- Reject if a future confirmed event already exists for this
  -- (app_user_id, provider_id) pair that is not the current proposal.
  select id
  into v_conflicting_event_id
  from public.calendar_events
  where app_user_id = v_attempt.app_user_id
    and provider_id  = v_attempt.provider_id
    and status       = 'confirmed'
    and start_at     > now()
    and (proposal_id is null or proposal_id != p_proposal_id)
  limit 1;

  if v_conflicting_event_id is not null then
    raise exception 'QBH invariant violation: multiple future confirmed calendar events for (app_user_id=%, provider_id=%)',
      v_attempt.app_user_id, v_attempt.provider_id;
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
    start_at    = excluded.start_at,
    end_at      = excluded.end_at,
    status      = excluded.status,
    source      = excluded.source,
    attempt_id  = excluded.attempt_id
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
      'start_at',          v_proposal.normalized_start,
      'end_at',            v_proposal.normalized_end
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
    'provider_id',       v_attempt.provider_id,
    'app_user_id',       v_attempt.app_user_id,
    'start_at',          v_proposal.normalized_start,
    'end_at',            v_proposal.normalized_end,
    'status',            'BOOKED_CONFIRMED'
  );
end;
$$;
