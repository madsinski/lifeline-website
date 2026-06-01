-- ============================================================================
-- migration-presentations.sql
-- Admin-managed slideshow / presentation builder.
--
-- Backs the /admin/presentations editor and the public /present/[slug] route.
-- A presentation is a row whose `data` jsonb holds the full slide deck (see
-- src/lib/presentations/types.ts for the shape). All reads/writes go through
-- /api/admin/presentations* using supabaseAdmin; the public deck is rendered
-- server-side (also via supabaseAdmin) and is only fetched when is_published.
--
-- Conventions: idempotent, applied manually in the Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.presentations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  title             text NOT NULL DEFAULT 'Untitled presentation',
  template_version  text NOT NULL DEFAULT 'standard-v2',
  data              jsonb NOT NULL DEFAULT '{"slides":[]}'::jsonb,
  is_published      boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_presentations_slug       ON public.presentations (slug);
CREATE INDEX IF NOT EXISTS idx_presentations_published  ON public.presentations (is_published);
CREATE INDEX IF NOT EXISTS idx_presentations_updated_at ON public.presentations (updated_at DESC);

-- ----------------------------------------------------------------------------
-- updated_at trigger (shared helper; create if it doesn't already exist)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_presentations_updated_at ON public.presentations;
CREATE TRIGGER trg_presentations_updated_at
  BEFORE UPDATE ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — block all direct client access. The API (supabaseAdmin) is the only
-- path; the public deck is rendered server-side, so no public read policy is
-- needed on the table itself.
-- ----------------------------------------------------------------------------
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block client access" ON public.presentations;
CREATE POLICY "Block client access"
  ON public.presentations
  FOR ALL USING (false) WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- Storage bucket for uploaded presentation imagery (backgrounds, phone
-- mock-ups, team photos). PUBLIC so the shareable /present/[slug] deck can
-- load images by URL with no auth. Writes are restricted to admin staff;
-- uploads happen client-side from the admin editor using the staff session.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('presentation-assets', 'presentation-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin manage presentation assets" ON storage.objects;
CREATE POLICY "admin manage presentation assets" ON storage.objects
  FOR ALL USING (bucket_id = 'presentation-assets' AND is_admin_staff())
  WITH CHECK (bucket_id = 'presentation-assets' AND is_admin_staff());

DROP POLICY IF EXISTS "public read presentation assets" ON storage.objects;
CREATE POLICY "public read presentation assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'presentation-assets');

-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
