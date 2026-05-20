-- Add prescribed_day to client_session_completions so the UI can mark
-- only the actual day's slot as Done instead of every same-modality
-- slot in the week. Without this column, completing Monday's strength
-- session marked Thursday's strength as Done too because we keyed
-- completion by modality, not by day.
--
-- Idempotent — safe to run multiple times.

ALTER TABLE client_session_completions
  ADD COLUMN IF NOT EXISTS prescribed_day text;

-- Constraint after add so existing rows (with NULL) don't fail.
ALTER TABLE client_session_completions
  DROP CONSTRAINT IF EXISTS csc_prescribed_day_chk;
ALTER TABLE client_session_completions
  ADD CONSTRAINT csc_prescribed_day_chk
  CHECK (prescribed_day IS NULL OR prescribed_day IN ('mon','tue','wed','thu','fri','sat','sun'));

CREATE INDEX IF NOT EXISTS csc_by_day_idx
  ON client_session_completions (client_id, prescribed_day, completed_at DESC)
  WHERE prescribed_day IS NOT NULL;
