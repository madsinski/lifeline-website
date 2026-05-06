-- =============================================================
-- feedback_ai_summaries — cached AI-generated summary of a survey's
-- completed responses. Lets the team click "Generate AI insights"
-- on /admin/surveys/[id]/results without re-running the model on
-- every page view.
--
-- One row per (survey_id, version-of-responses). We don't version
-- the summary itself; clicking Regenerate replaces the existing row.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.feedback_ai_summaries (
  survey_id            UUID PRIMARY KEY REFERENCES public.feedback_surveys(id) ON DELETE CASCADE,
  -- Markdown summary surfaced as the headline panel.
  summary_md           TEXT,
  -- Structured arrays the UI breaks out into themes / actions / concerns.
  themes_jsonb         JSONB,         -- [{ title, description }, ...]
  action_items_jsonb   JSONB,         -- [{ title, description, priority? }, ...]
  concerns_jsonb       JSONB,         -- [{ title, description, severity? }, ...]
  praise_jsonb         JSONB,         -- [{ title, description }, ...]
  -- Snapshot info so the UI can show "based on N responses, generated X ago".
  responses_count      INTEGER NOT NULL DEFAULT 0,
  model                TEXT,          -- e.g. 'claude-sonnet-4-6'
  generated_by         UUID REFERENCES public.staff(id),
  generated_by_name    TEXT,
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_ai_summaries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedback_ai_summaries'
      AND policyname = 'ai_summaries_staff_read'
  ) THEN
    CREATE POLICY ai_summaries_staff_read
      ON public.feedback_ai_summaries
      FOR SELECT TO authenticated
      USING (public.is_active_staff());
  END IF;

  -- Writes flow through the API (service role); no RLS write policy
  -- needed for that path. We don't expose the table to non-service
  -- writers, so deliberately omit INSERT/UPDATE policies.
END $$;
