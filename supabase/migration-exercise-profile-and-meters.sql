-- Phase 3 + meters concept: exercise profile capture + consistency/intensity tracking.
--
-- exercise_profile JSONB schema (mirrored from onboarding step 2):
--   {
--     setting: 'gym' | 'home' | 'hybrid',
--     homeEquipment: string[],      -- always includes 'bodyweight'
--     daysPerWeek: 1..7,
--     sessionMinutes: 5..90,        -- user's preferred default
--     primaryGoal: 'fat-loss' | 'strength' | 'muscle' | 'mobility' | 'health' | 'sport'
--   }
--
-- Consistency meter: % of prescribed days with at least one completion,
-- rolling 28-day window. 0-100. Cached on clients.consistency_score.
--
-- Intensity meter: ratio of actual effort to prescribed effort, rolling
-- 7-day window. 100 = matched the plan. 80 = lighter/shorter. 120 =
-- harder/longer. Cached on clients.intensity_score.
--
-- Effort = duration_seconds × perceived_intensity (RPE 1-10 self-report
-- after each session, default 6). Prescribed values snapshotted at
-- completion time so retroactive program edits don't whiplash old scores.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS exercise_profile jsonb,
  ADD COLUMN IF NOT EXISTS consistency_score smallint,
  ADD COLUMN IF NOT EXISTS intensity_score smallint,
  ADD COLUMN IF NOT EXISTS scores_updated_at timestamptz;

ALTER TABLE action_completions
  ADD COLUMN IF NOT EXISTS actual_duration_seconds smallint,
  ADD COLUMN IF NOT EXISTS perceived_intensity smallint,
  ADD COLUMN IF NOT EXISTS prescribed_duration_seconds smallint,
  ADD COLUMN IF NOT EXISTS prescribed_intensity smallint;

CREATE INDEX IF NOT EXISTS action_completions_client_date_idx
  ON action_completions (client_id, date DESC);
