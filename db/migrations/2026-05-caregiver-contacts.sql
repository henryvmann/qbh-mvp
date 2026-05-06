-- Caregiver contacts: a user's saved rolodex of people they may want
-- to invite to appointments (spouse, parent, friend). Distinct from
-- appointment_caregivers, which is the per-visit invite. The reviewer
-- explicitly asked for this separation so she can pre-populate her
-- list of people without having to wait for an appointment.
--
-- Per-visit invites still live in appointment_caregivers; the picker
-- there will offer entries from this table as quick-add options
-- (separate UI change). Both tables can be linked via the email/phone
-- match if we ever want a unified view.

create table if not exists caregiver_contacts (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references app_users(id) on delete cascade,

  name text not null,
  email text,
  phone text,
  -- Free-form: "Mom", "Spouse", "Friend", "Sibling". Surfaces as a
  -- subtitle on the rolodex card; lets the user disambiguate two
  -- people with the same first name.
  relationship text,
  -- Free-form notes — "drives Wyatt to chemo," "lives nearby," etc.
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists caregiver_contacts_user_idx
  on caregiver_contacts (app_user_id, created_at desc);

-- One row per (user, email) — prevents accidental duplicates when the
-- email is set. NULL emails are allowed multiple times (deliberate;
-- some contacts only have a phone, or only a name to start).
create unique index if not exists caregiver_contacts_user_email_idx
  on caregiver_contacts (app_user_id, lower(email))
  where email is not null;
