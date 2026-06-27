-- =============================================================
-- Research Data Module — data-quality exclusions
-- Lets staff exclude specific patients (rows) and variables (columns) from a
-- cohort's analysis (e.g. an incomplete enrolment, or a sparsely-recorded
-- conditional screener). Idempotent; run in the Supabase SQL editor.
-- =============================================================

ALTER TABLE public.research_cohorts
  ADD COLUMN IF NOT EXISTS excluded_patients uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.research_cohorts
  ADD COLUMN IF NOT EXISTS excluded_features text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
