-- Phase 2: priority tagging + bang-for-buck flag.
--
-- Rule-based classification from biomechanical metadata (mechanic, force,
-- equipment, primary_muscles, fed_category, level). Result distribution
-- across the 869 free-exercise-db imports:
--   priority 1: 150  (core compounds — squat/deadlift/press/row/pull-up)
--   priority 2: 276  (secondary compounds + core static holds)
--   priority 3: 248  (isolation accessories)
--   priority 4: 195  (stretching / cardio / plyometrics / finishers)
--   bang_for_buck=true: 61  (compound, push/pull, home-friendly equipment,
--                             beginner/intermediate level)
--
-- Priority lives on the exercise (intrinsic). Per-program overrides go in
-- action_exercises.priority_override (nullable) for rare cases where a
-- program-day's intent shifts the importance of a particular exercise.
--
-- The time-budget renderer (Phase 4) consumes priority + time_seconds_
-- estimated to fit a session into the user's chosen window.

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS priority smallint,
  ADD COLUMN IF NOT EXISTS time_seconds_estimated smallint,
  ADD COLUMN IF NOT EXISTS bang_for_buck boolean DEFAULT false;

ALTER TABLE action_exercises
  ADD COLUMN IF NOT EXISTS priority_override smallint;

UPDATE exercises SET priority = CASE
  WHEN fed_category = 'stretching' THEN 4
  WHEN fed_category IN ('cardio', 'plyometrics') THEN 4
  WHEN mechanic = 'compound' AND force IN ('push','pull')
       AND equipment IN ('barbell','dumbbell','kettlebells','body only','bodyweight','medicine ball')
       AND primary_muscles && ARRAY['quadriceps','glutes','hamstrings','lats','chest','middle back','triceps','biceps','shoulders']::text[]
    THEN 1
  WHEN mechanic = 'compound' THEN 2
  WHEN force = 'static' AND fed_category = 'strength' THEN 2
  WHEN mechanic = 'isolation' THEN 3
  ELSE 3
END
WHERE priority IS NULL;

UPDATE exercises SET time_seconds_estimated = CASE
  WHEN priority = 1 THEN 300
  WHEN priority = 2 THEN 240
  WHEN priority = 3 THEN 180
  WHEN priority = 4 AND fed_category = 'stretching' THEN 90
  WHEN priority = 4 THEN 240
  ELSE 180
END
WHERE time_seconds_estimated IS NULL;

UPDATE exercises SET bang_for_buck = true
WHERE mechanic = 'compound'
  AND force IN ('push','pull')
  AND equipment IN ('body only','bodyweight','dumbbell','kettlebells')
  AND level IN ('beginner','intermediate')
  AND fed_category <> 'stretching';

CREATE INDEX IF NOT EXISTS exercises_priority_idx ON exercises (priority);
CREATE INDEX IF NOT EXISTS exercises_bang_idx ON exercises (bang_for_buck) WHERE bang_for_buck = true;
