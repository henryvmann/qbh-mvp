-- Enable UUID extension (safe if already enabled)
create extension if not exists "pgcrypto";

-- =========================================
-- 1. schedule_attempts
-- =========================================

create table if not exists public.schedule_attempts (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  provider_id bigint not null,
  patient_name text,
  provider_name text,
  preferred_timeframe text,

  status text not null default 'INITIATED', 
  demo_autoconfirm boolean not null default false,

  vapi_call_id text,
  vapi_assistant_id text,
  office_phone text,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_schedule_attempts_provider_id
  on public.schedule_attempts(provider_id);


-- =========================================
-- 2. proposals
-- =========================================

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  attempt_id bigint not null references public.schedule_attempts(id) on delete cascade,

  tool_call_id text,
  office_offer_raw_text text not null,

  normalized_start timestamptz,
  normalized_end timestamptz,
  timezone text,

  conflict boolean not null default false,

  message_to_say text,
  next_action text,
  status text not null default 'PROPOSED',

  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_proposals_attempt_id
  on public.proposals(attempt_id);


-- =========================================
-- 3. call_events (optional but useful)
-- =========================================

create table if not exists public.call_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  attempt_id bigint references public.schedule_attempts(id) on delete set null,

  source text not null,
  event_type text not null,
  tool_name text,
  tool_payload jsonb,
  vapi_event jsonb
);

create index if not exists idx_call_events_attempt_id
  on public.call_events(attempt_id);


-- =========================================
-- Auto-update updated_at trigger
-- =========================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_schedule_attempts_updated
  on public.schedule_attempts;

create trigger trg_schedule_attempts_updated
before update on public.schedule_attempts
for each row execute function public.set_updated_at();

drop trigger if exists trg_proposals_updated
  on public.proposals;

create trigger trg_proposals_updated
before update on public.proposals
for each row execute function public.set_updated_at();