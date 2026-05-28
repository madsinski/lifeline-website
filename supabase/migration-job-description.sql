-- =============================================================
-- Recruiting-document store (job descriptions).
--
-- Backs /admin/job-description (admin editor) and the public,
-- password-gated mirror /verkefnalysing. A single row per
-- document id holds the whole editable form as JSON in `fields`,
-- so adding/removing fields never requires a schema change.
--
-- All access is mediated by /api/job-description using the
-- service role (public GET behind a shared view key; admin-only
-- PUT). Direct client access is therefore blocked by RLS.
--
-- Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.job_descriptions (
  id          text PRIMARY KEY,
  fields      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;

-- All reads/writes go through the API route (service role). Block any
-- direct anon/authenticated client access.
DROP POLICY IF EXISTS "Block client access" ON public.job_descriptions;
CREATE POLICY "Block client access"
ON public.job_descriptions
FOR ALL
USING (false)
WITH CHECK (false);

-- Seed the single document row. Empty fields → the app falls back to its
-- built-in DEFAULTS until an admin saves edits.
INSERT INTO public.job_descriptions (id, fields)
VALUES ('framkvaemdastjori', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
