-- Migration: Add INSERT/UPDATE/DELETE policies for program content tables
-- so the app's "Seed to Supabase" function can write data.
-- Also update the time_group CHECK constraint to include 'exercise'.
--
-- Run this in the Supabase SQL Editor before using the seed button.

-- 1. Update time_group CHECK constraint to allow 'exercise'
ALTER TABLE program_actions DROP CONSTRAINT IF EXISTS program_actions_time_group_check;
ALTER TABLE program_actions ADD CONSTRAINT program_actions_time_group_check
  CHECK (time_group IN ('morning', 'exercise', 'midday', 'evening'));

-- 2. Add write policies for program content tables (authenticated users only)

-- program_categories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can insert program categories'
  ) THEN
    CREATE POLICY "Authenticated can insert program categories"
      ON program_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can update program categories'
  ) THEN
    CREATE POLICY "Authenticated can update program categories"
      ON program_categories FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- programs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can insert programs'
  ) THEN
    CREATE POLICY "Authenticated can insert programs"
      ON programs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can update programs'
  ) THEN
    CREATE POLICY "Authenticated can update programs"
      ON programs FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- program_actions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can insert program actions'
  ) THEN
    CREATE POLICY "Authenticated can insert program actions"
      ON program_actions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can delete program actions'
  ) THEN
    CREATE POLICY "Authenticated can delete program actions"
      ON program_actions FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;
