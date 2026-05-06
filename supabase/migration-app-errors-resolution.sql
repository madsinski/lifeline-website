-- =============================================================
-- app_errors: resolution tracking
--
-- Add resolved_at + resolved_by_name so a group can be marked
-- "fixed" from /admin/errors. New occurrences of the same
-- signature default to resolved_at NULL, so a regression
-- automatically shows up as a mixed (some-resolved-some-not)
-- group rather than getting silently swallowed.
--
-- Idempotent. Run in the Supabase SQL editor.
-- =============================================================

ALTER TABLE public.app_errors
  ADD COLUMN IF NOT EXISTS resolved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by_name TEXT;

-- Speed up the "open / resolved" filter on the admin list.
CREATE INDEX IF NOT EXISTS app_errors_resolved_idx
  ON public.app_errors (resolved_at)
  WHERE resolved_at IS NOT NULL;
