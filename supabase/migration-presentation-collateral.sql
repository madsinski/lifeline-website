-- Editable content for the Fjarlækningar × HSU print collateral
-- (/admin/presentations/collateral). A single JSONB blob (CollateralContent,
-- see src/app/admin/presentations/collateral/content.ts). One row, id = 1.
-- API-mediated: all access goes through /api/admin/presentations/collateral
-- using supabaseAdmin. Apply manually in the Supabase SQL editor (idempotent).

CREATE TABLE IF NOT EXISTS public.presentation_collateral (
  id          integer PRIMARY KEY DEFAULT 1,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  CONSTRAINT presentation_collateral_singleton CHECK (id = 1)
);

ALTER TABLE public.presentation_collateral ENABLE ROW LEVEL SECURITY;

-- Block all direct client access; the API (service role) is the only path.
DROP POLICY IF EXISTS "Block client access" ON public.presentation_collateral;
CREATE POLICY "Block client access" ON public.presentation_collateral
  FOR ALL USING (false) WITH CHECK (false);

-- Seed the singleton row (empty → API falls back to DEFAULT_CONTENT).
INSERT INTO public.presentation_collateral (id, data)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
