-- Editable content for the homepage "What's new" (Nýtt hjá Lifeline) carousel
-- (/admin/whats-new). A single JSONB blob (WhatsNewContent, see
-- src/lib/whats-new.ts) with a `cards` array. One row, id = 1.
-- API-mediated: the homepage reads public /api/whats-new; the editor reads/writes
-- /api/admin/whats-new. All access uses supabaseAdmin (service role). Apply
-- manually in the Supabase SQL editor (idempotent).

CREATE TABLE IF NOT EXISTS public.whats_new (
  id          integer PRIMARY KEY DEFAULT 1,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  CONSTRAINT whats_new_singleton CHECK (id = 1)
);

ALTER TABLE public.whats_new ENABLE ROW LEVEL SECURITY;

-- Block all direct client access; the API (service role) is the only path.
DROP POLICY IF EXISTS "Block client access" ON public.whats_new;
CREATE POLICY "Block client access" ON public.whats_new
  FOR ALL USING (false) WITH CHECK (false);

-- Seed the singleton row (empty → API falls back to DEFAULT_WHATS_NEW).
INSERT INTO public.whats_new (id, data)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
