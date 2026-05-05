-- Unified notifications queue. Every email/SMS we send goes through
-- here so we have a single drain (cron) and a single audit trail.
-- Channels:
--   email — via AWS SES (lib/aws/ses.ts)
--   sms   — via Twilio (existing infra)
--
-- Lifecycle:
--   1. Caller inserts a row with status='pending', send_at=null/now
--   2. /api/cron/notifications-drain picks pending rows where
--      send_at <= now, attempts delivery, sets status='sent' or
--      'failed'. Failed rows can be retried by setting status back
--      to 'pending'.
--   3. Each row keeps the rendered subject/body for audit. We never
--      regenerate from a template at send time — what's stored is
--      what was sent.

do $$ begin
  create type notification_channel as enum ('email', 'sms');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_status as enum ('pending', 'sent', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  -- Owning user (the recipient of the notification, or the user
  -- whose action triggered it). NOT the same as the destination
  -- email/phone — caregivers might receive notifications they
  -- aren't a user of QBH.
  app_user_id uuid references app_users(id) on delete cascade,

  channel notification_channel not null,
  -- email address or E.164 phone
  recipient text not null,
  -- Display name to show in From: (email only). Defaults to env.
  recipient_name text,

  -- Subject line (email) or first line preview (sms).
  subject text,
  -- Final rendered body. HTML for email, plain for sms.
  body text not null,
  -- Plain-text fallback for email when body is HTML.
  body_text text,
  -- Optional reply-to override.
  reply_to text,

  -- Template identifier for analytics ("caregiver_invite",
  -- "booking_confirmed", "claim_followup_reminder", etc.).
  template text not null,

  -- Send-after timestamp. Cron only sends rows where send_at <= now.
  send_at timestamptz not null default now(),

  status notification_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  -- Provider-side message ID (SES messageId, Twilio sid).
  provider_message_id text,

  -- Free-form metadata for the trigger context (caregiver_id,
  -- calendar_event_id, etc.) — used to correlate webhooks back.
  metadata jsonb default '{}'::jsonb,

  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notifications_drain_idx
  on notifications (send_at)
  where status = 'pending';
create index if not exists notifications_user_idx on notifications (app_user_id, created_at desc);
