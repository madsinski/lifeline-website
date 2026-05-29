-- =============================================================
-- Job descriptions → multi-document.
--
-- The table started as a single fixed row ('framkvaemdastjori').
-- This generalises it to many documents: each row is one job
-- description / recruiting doc, identified by a generated id, with
-- a title for the admin list, the candidate it's for, and a status
-- that tracks it through to a signed employment contract.
--
-- `fields` (jsonb) is unchanged — still the whole editable form.
-- The existing row is kept and backfilled with a title.
--
-- Idempotent.
-- =============================================================

ALTER TABLE public.job_descriptions
  ADD COLUMN IF NOT EXISTS title          text NOT NULL DEFAULT 'Untitled',
  ADD COLUMN IF NOT EXISTS candidate_name text,
  ADD COLUMN IF NOT EXISTS candidate_email text,
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','agreed','contract_sent','signed','archived')),
  ADD COLUMN IF NOT EXISTS created_at     timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_descriptions_status     ON public.job_descriptions (status);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_created_at ON public.job_descriptions (created_at DESC);

-- Backfill the original document's title + status so it shows nicely
-- in the new list. Title is read from the saved fields when present,
-- otherwise a sensible default.
UPDATE public.job_descriptions
SET title = COALESCE(NULLIF(fields->>'starfsheiti', ''), 'Framkvæmdastjóri')
WHERE id = 'framkvaemdastjori'
  AND (title = 'Untitled' OR title IS NULL);

-- RLS unchanged: all access flows through /api/job-description with the
-- service role. The "Block client access" policy from the original
-- migration still applies.

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.job_descriptions;
  RAISE NOTICE 'job_descriptions: % document(s) after multi-doc migration', v_count;
END $$;
