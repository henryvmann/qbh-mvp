-- Primary provider designation.
--
-- The reviewer asked for a way to mark one provider as the primary
-- (effectively the "starred" provider) so it surfaces visually
-- ahead of the rest of the care team. V1 = single primary per
-- app_user_id; we enforce that invariant in the update API by
-- clearing is_primary on the user's other providers when one is
-- set true. Per-care-recipient primaries (Henry's primary vs Jenny's
-- primary) come later if needed.

alter table providers
  add column if not exists is_primary boolean not null default false;

-- Partial index — fast lookup of "what's the user's primary?" without
-- scanning the whole providers table. Multiple primaries per user
-- aren't blocked at the DB layer (V1 enforces in app code) so this
-- is a btree, not a unique partial index.
create index if not exists providers_primary_idx
  on providers (app_user_id)
  where is_primary = true;
