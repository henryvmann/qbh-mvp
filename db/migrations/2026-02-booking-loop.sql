begin;

create extension if not exists "pgcrypto";

-- USERS
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- PROVIDERS
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- PROVIDER VISITS
create table if not exists public.provider_visits (
  id bigserial primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  visit_date date not null,
  source text not null default 'transaction',
  created_at timestamptz not null default now()
);

-- SCHEDULE ATTEMPTS
create table if not exists public.schedule_attempts (
  id bigserial primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  status text not null default 'CREATED',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PROPOSALS
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  attempt_id bigint not null references public.schedule_attempts(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'PROPOSED',
  office_raw_text text,
  created_at timestamptz not null default now()
);

-- CALENDAR EVENTS
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed',
  source text not null default 'qbh',
  attempt_id bigint references public.schedule_attempts(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  created_at timestamptz not null default now()
);

-- PORTAL FACTS
create table if not exists public.portal_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  fact_type text not null,
  fact_json jsonb not null default '{}'::jsonb,
  fact_date date not null default (now()::date),
  source text not null default 'qbh',
  attempt_id bigint references public.schedule_attempts(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  created_at timestamptz not null default now()
);

-- CHECK CONSTRAINTS (SAFE)
do $$
begin
-- calendar_events source migration + canonical constraint
-- drop legacy constraint if it exists
if exists (
  select 1 from pg_constraint
  where conname = 'calendar_events_source_check'
    and conrelid = 'public.calendar_events'::regclass
) then
  alter table public.calendar_events
    drop constraint calendar_events_source_check;
end if;

-- normalize legacy values
update public.calendar_events
set source = case
  when source = 'manual' then 'manual'
  when source in ('google','apple','import') then 'portal'
  when source = 'confirm_booking' then 'qbh'
  when source is null then 'qbh'
  else 'qbh'
end;

-- add canonical constraint if missing
if not exists (
  select 1 from pg_constraint
  where conname = 'calendar_events_source_chk'
    and conrelid = 'public.calendar_events'::regclass
) then
  alter table public.calendar_events
    add constraint calendar_events_source_chk
    check (source in ('qbh','manual','portal'));
end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'portal_facts_source_chk'
      and conrelid = 'public.portal_facts'::regclass
  ) then
    alter table public.portal_facts
      add constraint portal_facts_source_chk
      check (source in ('qbh','manual','portal'));
  end if;

-- provider_visits source migration + canonical constraint
if exists (
  select 1 from pg_constraint
  where conname = 'provider_visits_source_check'
    and conrelid = 'public.provider_visits'::regclass
) then
  alter table public.provider_visits
    drop constraint provider_visits_source_check;
end if;

update public.provider_visits
set source = case
  when source = 'manual' then 'manual'
  when source in ('import') then 'portal'
  when source = 'charges' then 'transaction'
  when source is null then 'transaction'
  else 'transaction'
end;

if not exists (
  select 1 from pg_constraint
  where conname = 'provider_visits_source_chk'
    and conrelid = 'public.provider_visits'::regclass
) then
  alter table public.provider_visits
    add constraint provider_visits_source_chk
    check (source in ('transaction','portal','manual'));
end if;

-- schedule_attempts status: normalize legacy values + enforce canonical lifecycle
update public.schedule_attempts
set status = case
  when status = 'CALL_STARTED' then 'CALLING'
  when status = 'BOOKED' then 'BOOKED_CONFIRMED'
  else status
end;

if not exists (
  select 1 from pg_constraint
  where conname = 'schedule_attempts_status_chk'
    and conrelid = 'public.schedule_attempts'::regclass
) then
  alter table public.schedule_attempts
    add constraint schedule_attempts_status_chk
    check (status in ('CREATED','CALLING','PROPOSED','WAITING_APPROVAL','BOOKED_CONFIRMED','FAILED'));
end if;

end $$;

-- UNIQUE INDEXES
create unique index if not exists uq_calendar_events_provider_start_confirmed
on public.calendar_events (provider_id, start_at)
where status = 'confirmed';

create unique index if not exists uq_portal_facts_booking_confirmed_per_proposal
on public.portal_facts (proposal_id)
where fact_type = 'booking_confirmed';

-- LOGGING TABLE
create table if not exists public.call_events (
  id bigserial primary key,
  user_id uuid,
  attempt_id bigint,
  proposal_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- FINALIZE FUNCTION
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
  select * into v_attempt
  from public.schedule_attempts
  where id = p_attempt_id;

  select * into v_proposal
  from public.proposals
  where id = p_proposal_id
    and attempt_id = p_attempt_id;

  insert into public.calendar_events(user_id, provider_id, start_at, end_at, status, source, attempt_id, proposal_id)
  values (v_attempt.user_id, v_attempt.provider_id, v_proposal.start_at, v_proposal.end_at, 'confirmed', 'qbh', v_attempt.id, v_proposal.id)
  on conflict (provider_id, start_at) where status = 'confirmed'
  do update set
    end_at = excluded.end_at,
    proposal_id = excluded.proposal_id,
    attempt_id = excluded.attempt_id,
    user_id = excluded.user_id
  returning id into v_calendar_event_id;

  insert into public.portal_facts(user_id, provider_id, fact_type, fact_json, fact_date, source, attempt_id, proposal_id)
  values (
    v_attempt.user_id,
    v_attempt.provider_id,
    'booking_confirmed',
    jsonb_build_object(
      'calendar_event_id', v_calendar_event_id,
      'start_at', v_proposal.start_at,
      'end_at', v_proposal.end_at
    ),
    (v_proposal.start_at::date),
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
    'user_id', v_attempt.user_id,
    'start_at', v_proposal.start_at,
    'end_at', v_proposal.end_at,
    'status', 'BOOKED_CONFIRMED'
  );
end;
$$;

commit;