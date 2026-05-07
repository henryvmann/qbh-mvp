-- providers.phone_candidates — when Places returns multiple confident
-- name-matches in the user's state, we store all of them here as a JSON
-- array so the user can pick which one is theirs. phone_number stays
-- null until the user confirms one (or until we resolve to a single
-- match downstream).
--
-- Shape: [{ name: string, phone: string, address: string | null }, ...]
-- A non-null phone_candidates with phone_number IS null means "user
-- confirmation pending." Once the user picks, phone_number is set and
-- phone_candidates is cleared (set back to null) by the same write.

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS phone_candidates jsonb;

-- Optional: index for the dashboard "X providers waiting on
-- confirmation" prompt. Cheap.
CREATE INDEX IF NOT EXISTS idx_providers_phone_candidates_pending
  ON providers (app_user_id)
  WHERE phone_candidates IS NOT NULL AND phone_number IS NULL;
