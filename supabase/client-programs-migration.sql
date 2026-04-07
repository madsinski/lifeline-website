-- =============================================================
-- Client custom programs + template library
-- Run in Supabase SQL Editor
-- =============================================================

-- Template library for reusable custom programs
CREATE TABLE IF NOT EXISTS program_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_key TEXT NOT NULL,
  description TEXT,
  tagline TEXT,
  level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  exercise_type TEXT CHECK (exercise_type IN ('gym', 'home')),
  target_audience TEXT,
  structured_phases JSONB,
  duration INT DEFAULT 8,
  actions JSONB NOT NULL DEFAULT '[]',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Client custom program overrides
-- When a coach customizes a program for a specific client,
-- we store the full program + actions here instead of in the general tables
CREATE TABLE IF NOT EXISTS client_custom_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  program_name TEXT NOT NULL,
  description TEXT,
  tagline TEXT,
  level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  exercise_type TEXT CHECK (exercise_type IN ('gym', 'home')),
  target_audience TEXT,
  structured_phases JSONB,
  duration INT DEFAULT 8,
  actions JSONB NOT NULL DEFAULT '[]',
  created_by UUID,
  created_from_template UUID REFERENCES program_templates(id),
  created_from_program TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, category_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_custom_programs_client ON client_custom_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_program_templates_category ON program_templates(category_key);

-- RLS
ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_custom_programs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view templates') THEN
    CREATE POLICY "Anyone can view templates" ON program_templates FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can manage templates') THEN
    CREATE POLICY "Authenticated can manage templates" ON program_templates FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view custom programs') THEN
    CREATE POLICY "Anyone can view custom programs" ON client_custom_programs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can manage custom programs') THEN
    CREATE POLICY "Authenticated can manage custom programs" ON client_custom_programs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
