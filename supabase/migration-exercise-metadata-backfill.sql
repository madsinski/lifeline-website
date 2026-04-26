-- Backfill biomechanical metadata from free-exercise-db upstream JSON.
-- Adds mechanic, force, level, fed_category, primary_muscles,
-- secondary_muscles. These power the priority auto-tagger and the
-- bang-for-buck library filter (Phase 2+).
--
-- Source: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
-- Joined to public.exercises by source_id (upstream id slug).
--
-- The actual UPDATE with 873 VALUES rows was applied via the Supabase
-- Management API; this file documents the schema change so future
-- environments can recreate it from the upstream JSON.

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS mechanic text,
  ADD COLUMN IF NOT EXISTS force text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS fed_category text,
  ADD COLUMN IF NOT EXISTS primary_muscles text[],
  ADD COLUMN IF NOT EXISTS secondary_muscles text[];

-- Helpful indexes for the upcoming priority renderer.
CREATE INDEX IF NOT EXISTS exercises_mechanic_idx ON exercises (mechanic);
CREATE INDEX IF NOT EXISTS exercises_fed_category_idx ON exercises (fed_category);
CREATE INDEX IF NOT EXISTS exercises_level_idx ON exercises (level);
