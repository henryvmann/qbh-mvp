-- Daily snapshots of each user's readiness score, so Kate can say
-- "+6 this week" truthfully instead of falling back to null.
--
-- One row per user per UTC day. The signal cron (or whatever produces
-- the canonical readiness score) writes a snapshot once a day; the
-- Kate signals layer reads the latest two snapshots to compute delta.

create table if not exists public.health_score_snapshots (
  id            bigserial primary key,
  app_user_id   uuid not null references public.app_users(id) on delete cascade,
  score         numeric not null,
  measured_on   date not null,
  created_at    timestamptz not null default now(),
  unique (app_user_id, measured_on)
);

create index if not exists health_score_snapshots_user_idx
  on public.health_score_snapshots (app_user_id, measured_on desc);

alter table public.health_score_snapshots enable row level security;

drop policy if exists health_score_snapshots_owner on public.health_score_snapshots;
create policy health_score_snapshots_owner
  on public.health_score_snapshots
  for select using (
    app_user_id in (
      select id from public.app_users where auth_user_id = auth.uid()
    )
  );
