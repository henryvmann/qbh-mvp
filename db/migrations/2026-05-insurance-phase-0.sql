-- Phase 0 insurance features. Two new tables, three patient_profile
-- field additions. No new vendors — all the parsing/extraction runs
-- through existing OpenAI vision + S3 storage we already pay for.

-- ─────────────────────────────────────────────────────────────────
-- 1. EOBs — uploaded Explanation of Benefits docs that GPT-4o vision
--    has parsed into structured fields. Raw PDF lives in S3 under
--    pseudonymized key; we store the s3 key + extracted data here.
-- ─────────────────────────────────────────────────────────────────

create table if not exists insurance_eobs (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references app_users(id) on delete cascade,
  s3_key text not null,
  uploaded_at timestamptz not null default now(),

  -- Extracted by GPT-4o vision on upload. Nullable because parsing
  -- can fail or partial-extract.
  payer text,
  claim_number text,
  date_of_service date,
  provider_name text,
  billed_amount numeric(10, 2),
  allowed_amount numeric(10, 2),
  plan_paid numeric(10, 2),
  patient_owes numeric(10, 2),
  status text,                  -- "Paid" | "Denied" | "In review" | "Processed"
  -- Plain-English explanation Kate generates for the user.
  kate_explanation text,
  -- Raw extracted JSON for debugging / future re-processing.
  raw_extraction jsonb,

  -- Optional link to the provider on the user's care team (matched
  -- via name fuzzy-match at upload time).
  related_provider_id uuid references providers(id) on delete set null,

  -- User can mark "I've reviewed this".
  reviewed_at timestamptz
);

create index if not exists insurance_eobs_user_idx on insurance_eobs (app_user_id, uploaded_at desc);

-- ─────────────────────────────────────────────────────────────────
-- 2. Insurance claims — manual tracker. User logs that they
--    submitted a superbill or claim, sets status, Kate sets a
--    follow-up reminder. No payer integration; this is a workflow
--    layer the user manages. Phase 1 will swap in Flexpa for
--    auto-pulled status; for now everything is user-entered.
-- ─────────────────────────────────────────────────────────────────

create type insurance_claim_status as enum (
  'submitted',
  'in_review',
  'approved',
  'denied',
  'paid',
  'appealed'
);

create table if not exists insurance_claims (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references app_users(id) on delete cascade,
  related_provider_id uuid references providers(id) on delete set null,
  related_eob_id uuid references insurance_eobs(id) on delete set null,
  related_visit_id uuid references provider_visits(id) on delete set null,

  -- What the user submitted.
  amount_submitted numeric(10, 2),
  payer text,
  date_submitted date not null,
  date_of_service date,

  status insurance_claim_status not null default 'submitted',
  -- Reimbursement actually received.
  amount_received numeric(10, 2),
  date_resolved date,

  -- Kate's reminder. Auto-set to 28 days from submitted unless
  -- overridden. Cron checks this and pings the user.
  expected_followup_date date,
  last_reminder_sent_at timestamptz,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_claims_user_idx on insurance_claims (app_user_id, date_submitted desc);
create index if not exists insurance_claims_followup_idx on insurance_claims (expected_followup_date) where status in ('submitted', 'in_review');

-- ─────────────────────────────────────────────────────────────────
-- 3. patient_profile additions — handled via the existing jsonb
--    column. New keys added when the user fills them in:
--      - insurance_card_front_s3_key, insurance_card_back_s3_key
--      - insurance_group_number, insurance_plan_type
--      - insurance_customer_service_phone
--      - annual_deductible, annual_oop_max
--      - tax_id_consent  (legal: user consents to share their tax
--        ID on superbills they download)
--    No schema change needed — patient_profile is jsonb. Documenting
--    here so future migrations don't accidentally collide.
-- ─────────────────────────────────────────────────────────────────
