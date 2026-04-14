-- =============================================================
-- Translations table for website i18n
-- Stores all translatable strings with approval workflow
-- Run this in the Supabase SQL Editor
-- =============================================================

CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,           -- unique identifier e.g. "home.hero.title"
  section TEXT NOT NULL,              -- grouping e.g. "home", "assessment", "navbar"
  context TEXT,                       -- description e.g. "Main heading on home page"
  en TEXT NOT NULL,                   -- English (source)
  is_text TEXT,                       -- Icelandic translation (column named is_text because "is" is reserved)
  approved BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translations_section ON translations(section);
CREATE INDEX IF NOT EXISTS idx_translations_approved ON translations(approved);

ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Anyone can read translations (website needs them)
CREATE POLICY "Anyone can read translations" ON translations FOR SELECT USING (true);

-- Staff can manage translations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can manage translations') THEN
    CREATE POLICY "Staff can manage translations" ON translations
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;
