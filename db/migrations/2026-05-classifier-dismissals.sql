-- Per-user classifier-feedback log.
--
-- When a user dismisses a discovered provider as "not healthcare," we
-- record the merchant fingerprint here so:
--   1. Future Plaid scans for THAT user filter the merchant out
--      pre-classification (so they don't see it again).
--   2. Aggregate rollups across all users feed a candidate denylist
--      for the universe eval (Henry reviews before promoting).
--
-- Critical: this is a SIGNAL, not an authority. Real chains on the
-- hardcoded HEALTHCARE_ALLOWLIST (CVS, Walgreens, Mount Sinai, etc.)
-- IGNORE rows here — one user's "I don't think CVS is my pharmacy"
-- never affects another user's classification.

create table if not exists classifier_dismissals (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references app_users(id) on delete cascade,
  -- Normalized merchant name (uppercase, alphanumeric+space only).
  -- Same shape buildProviderRegistry uses internally.
  normalized_name text not null,
  -- Raw merchant string for human review.
  merchant_name text,
  -- Optional: which provider row was dismissed (for traceability).
  provider_id uuid references providers(id) on delete set null,
  dismissed_at timestamptz not null default now(),
  -- Free-text reason if the UI ever asks ("not my pharmacy",
  -- "actually a grocery store"). Null until the UI surfaces it.
  reason text
);

create index if not exists classifier_dismissals_user_idx
  on classifier_dismissals (app_user_id);
create index if not exists classifier_dismissals_name_idx
  on classifier_dismissals (normalized_name);
create unique index if not exists classifier_dismissals_user_name_uniq
  on classifier_dismissals (app_user_id, normalized_name);
