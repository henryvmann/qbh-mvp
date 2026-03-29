-- Row Level Security (RLS) for all user-owned tables.
--
-- Architecture context:
--   All backend data operations use supabaseAdmin (service role key), which
--   bypasses RLS entirely. These policies are defense-in-depth — they enforce
--   the ownership invariant at the DB level so that no anon/authenticated key
--   request can ever read or write another user's data, regardless of any
--   application-layer bug.
--
-- Policy model:
--   - SELECT: users can only read rows they own.
--   - INSERT/UPDATE/DELETE: no policies added — all writes go through the
--     service role, so direct writes via anon key are denied by default.
--
-- Identity mapping:
--   auth.uid()  →  app_users.auth_user_id  →  app_users.id (= app_user_id)
--   The helper function current_app_user_id() resolves this lookup.

-- ────────────────────────────────────────────────
-- Helper: resolve current Supabase auth user → app_user_id
-- ────────────────────────────────────────────────

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.app_users
  where auth_user_id = auth.uid()
  limit 1
$$;

-- ────────────────────────────────────────────────
-- app_users
-- ────────────────────────────────────────────────

alter table public.app_users enable row level security;

create policy "app_users_select_own"
  on public.app_users
  for select
  using (auth_user_id = auth.uid());

-- ────────────────────────────────────────────────
-- providers
-- ────────────────────────────────────────────────

alter table public.providers enable row level security;

create policy "providers_select_own"
  on public.providers
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- provider_visits
-- ────────────────────────────────────────────────

alter table public.provider_visits enable row level security;

create policy "provider_visits_select_own"
  on public.provider_visits
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- schedule_attempts
-- ────────────────────────────────────────────────

alter table public.schedule_attempts enable row level security;

create policy "schedule_attempts_select_own"
  on public.schedule_attempts
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- proposals
-- ────────────────────────────────────────────────

alter table public.proposals enable row level security;

create policy "proposals_select_own"
  on public.proposals
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- calendar_events
-- ────────────────────────────────────────────────

alter table public.calendar_events enable row level security;

create policy "calendar_events_select_own"
  on public.calendar_events
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- portal_facts
-- ────────────────────────────────────────────────

alter table public.portal_facts enable row level security;

create policy "portal_facts_select_own"
  on public.portal_facts
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- integrations
-- ────────────────────────────────────────────────

alter table public.integrations enable row level security;

create policy "integrations_select_own"
  on public.integrations
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- calendar_connections
-- ────────────────────────────────────────────────

alter table public.calendar_connections enable row level security;

create policy "calendar_connections_select_own"
  on public.calendar_connections
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- candidate_slots
-- ────────────────────────────────────────────────

alter table public.candidate_slots enable row level security;

create policy "candidate_slots_select_own"
  on public.candidate_slots
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- plaid_items
-- ────────────────────────────────────────────────

alter table public.plaid_items enable row level security;

create policy "plaid_items_select_own"
  on public.plaid_items
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- plaid_transactions
-- ────────────────────────────────────────────────

alter table public.plaid_transactions enable row level security;

create policy "plaid_transactions_select_own"
  on public.plaid_transactions
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- portal_connections
-- ────────────────────────────────────────────────

alter table public.portal_connections enable row level security;

create policy "portal_connections_select_own"
  on public.portal_connections
  for select
  using (app_user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- call_events
-- (user_id column, nullable — legacy name, not yet renamed)
-- ────────────────────────────────────────────────

alter table public.call_events enable row level security;

create policy "call_events_select_own"
  on public.call_events
  for select
  using (user_id is not null and user_id = public.current_app_user_id());

-- ────────────────────────────────────────────────
-- call_notes
-- (no direct app_user_id — owned via attempt_id → schedule_attempts)
-- ────────────────────────────────────────────────

alter table public.call_notes enable row level security;

create policy "call_notes_select_own"
  on public.call_notes
  for select
  using (
    exists (
      select 1
      from public.schedule_attempts sa
      where sa.id = call_notes.attempt_id
        and sa.app_user_id = public.current_app_user_id()
    )
  );
