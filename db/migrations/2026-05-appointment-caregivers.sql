-- Per-appointment caregiver loop. Lets a user share an upcoming
-- appointment with someone caring for them (a spouse, parent,
-- friend) along with a checklist of asks: "I need a ride", "bring
-- magazines", "music", timing, and free-text notes.
--
-- The caregiver receives a view-only link they can open without an
-- account. Phase 0 has no email send — the user copies the link
-- manually. Phase 1 hookup: send via Postmark/Resend with an opt-in
-- subject line.

create table if not exists appointment_caregivers (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references app_users(id) on delete cascade,
  -- Which appointment this caregiver is attached to. We support both
  -- calendar_events (already-confirmed appointments) and
  -- schedule_attempts (Kate's pending bookings) so caregivers can
  -- get pulled in BEFORE the appointment is confirmed.
  calendar_event_id uuid references calendar_events(id) on delete cascade,
  schedule_attempt_id integer references schedule_attempts(id) on delete cascade,
  provider_id uuid references providers(id) on delete cascade,

  caregiver_name text not null,
  -- Either email or phone is required for the share link path. For
  -- the manual-copy MVP, neither is strictly required — the user
  -- just copies the URL to send themselves.
  caregiver_email text,
  caregiver_phone text,

  -- The asks the user has flagged for this caregiver. Free-form
  -- jsonb so we can evolve the checklist without migrations:
  --   { needs_ride: bool, bring: text[], music: text, timing_note: text }
  asks jsonb default '{}'::jsonb,

  -- Free-text notes for the caregiver (anything specific to this
  -- visit — instructions, what to expect, etc.).
  notes text,

  -- View-only access token. The caregiver opens
  -- /caregiver/<share_token> to see their info. Random per row.
  share_token text not null unique default replace(gen_random_uuid()::text, '-', ''),

  invited_at timestamptz not null default now(),
  -- When the caregiver first opened the link (analytics + lets us
  -- show the user "Sarah viewed this on May 3").
  viewed_at timestamptz,

  -- One of {invited, viewed, declined, expired}. Phase 0 only sets
  -- invited / viewed; the others are placeholders for richer flow.
  status text not null default 'invited'
);

create index if not exists appointment_caregivers_user_idx
  on appointment_caregivers (app_user_id);
create index if not exists appointment_caregivers_event_idx
  on appointment_caregivers (calendar_event_id) where calendar_event_id is not null;
create index if not exists appointment_caregivers_token_idx
  on appointment_caregivers (share_token);
