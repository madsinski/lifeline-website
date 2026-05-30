-- =============================================================
-- feedback_surveys: add a free-text category column.
--
-- Surveys are grouped by purpose (e.g. "Post-assessment",
-- "3-month follow-up", or any custom label). Free text so admins can
-- introduce new categories without a schema change. NULL = uncategorised.
--
-- Idempotent.
-- =============================================================

ALTER TABLE public.feedback_surveys
  ADD COLUMN IF NOT EXISTS category text;

-- Partial index — most rows will have a category once this is rolled out,
-- but skipping NULLs keeps the legacy uncategorised rows out of the way.
CREATE INDEX IF NOT EXISTS idx_feedback_surveys_category
  ON public.feedback_surveys (category)
  WHERE category IS NOT NULL;

NOTIFY pgrst, 'reload schema';
