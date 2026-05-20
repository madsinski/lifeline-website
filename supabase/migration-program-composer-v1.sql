-- Program composer v1 — replaces the static program_actions weekly
-- template with a per-user composed weekly plan, driven by the pulse
-- engine + a library of atomic action units.
--
-- Old model:
--   programs ─< program_actions (week×day×action, hard-coded per program)
--   client picks one program per category; sees the same weekly
--   template as every other user on that program.
--
-- New model:
--   action_library — atomic units tagged by modality + level
--   client_training_state — per-user, per-modality level + adherence
--   client_session_completions — what session the user actually did
--   client_weekly_plan — cached composed schedule for the current week
--
-- The composer reads pulse + state + limitations and writes
-- client_weekly_plan rows. UI reads from there.
--
-- IMPORTANT: this migration ADDS infrastructure without breaking the
-- old model. Static program_actions stay live so HealthCoach
-- continues to work during the transition. Feature flag will gate
-- whether the composed plan or the static plan renders.

-- ─── action_library ─────────────────────────────────────────────
-- Atomic units. Exercise rows carry the 5-block structure
-- (warmup_general / warmup_specific / main / finisher / cooldown)
-- in the `blocks` jsonb field. Non-exercise rows leave blocks NULL.
CREATE TABLE IF NOT EXISTS session_library (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,
  category      text NOT NULL,
  modality      text,
  level         text,
  name          text NOT NULL,
  description   text,
  duration_min  int,
  intensity_rpe int,
  equipment     text[] DEFAULT '{}',
  contraindications text[] DEFAULT '{}',
  blocks        jsonb,
  rationale_template text,
  ai_generated  boolean NOT NULL DEFAULT false,
  reviewed_by_clinician boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT session_library_category_chk CHECK (category IN ('exercise','nutrition','sleep','mental','recovery')),
  CONSTRAINT session_library_modality_chk CHECK (
    modality IS NULL OR modality IN (
      'strength','zone2','hiit','mobility','breathwork','meditation',
      'meal','hydration','sleep_routine','social','nature'
    )
  ),
  CONSTRAINT session_library_level_chk CHECK (
    level IS NULL OR level IN ('foundation','build','performance')
  )
);

CREATE INDEX IF NOT EXISTS session_library_lookup_idx
  ON session_library (category, modality, level)
  WHERE active = true;

-- Open read for authenticated users; only staff write (via the
-- existing isAnyActiveStaff helper would normally apply, but
-- action_library is reference data so we keep RLS simple).
ALTER TABLE session_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_library_select ON session_library
  FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY session_library_staff_write ON session_library
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff WHERE id = auth.uid() AND active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff WHERE id = auth.uid() AND active = true)
  );


-- ─── client_training_state ─────────────────────────────────────
-- Per-user, per-modality level + adherence tracking. Drives which
-- library tier the composer pulls from (foundation / build /
-- performance) and gates progression.
CREATE TABLE IF NOT EXISTS client_training_state (
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  modality      text NOT NULL,
  current_level text NOT NULL DEFAULT 'foundation',
  weeks_at_level int NOT NULL DEFAULT 0,
  adherence_4wk real NOT NULL DEFAULT 0,
  last_level_change_at timestamptz,
  level_up_eligible_at timestamptz,
  notes         text,
  updated_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (client_id, modality),
  CONSTRAINT cts_modality_chk CHECK (modality IN (
    'strength','zone2','hiit','mobility','breathwork','meditation',
    'meal','hydration','sleep_routine','social','nature'
  )),
  CONSTRAINT cts_level_chk CHECK (current_level IN ('foundation','build','performance')),
  CONSTRAINT cts_adherence_chk CHECK (adherence_4wk >= 0 AND adherence_4wk <= 1)
);

ALTER TABLE client_training_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY cts_self_select ON client_training_state
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY cts_self_upsert ON client_training_state
  FOR ALL TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());


-- ─── client_session_completions ────────────────────────────────
-- What the user actually did on a given day. Supports the
-- "different session" feature — prescribed_action_key is what the
-- composer scheduled; completed_action_key is what the user picked
-- and finished. When they differ, we still credit the day as done
-- (same modality is enough).
CREATE TABLE IF NOT EXISTS client_session_completions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prescribed_action_key text,
  completed_action_key  text NOT NULL,
  modality      text NOT NULL,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  duration_min  int,
  intensity_rpe int,
  notes         text
);

CREATE INDEX IF NOT EXISTS csc_lookup_idx
  ON client_session_completions (client_id, modality, completed_at DESC);

ALTER TABLE client_session_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY csc_self_select ON client_session_completions
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY csc_self_insert ON client_session_completions
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

CREATE POLICY csc_self_update ON client_session_completions
  FOR UPDATE TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());


-- ─── client_weekly_plan ────────────────────────────────────────
-- Cached composed schedule. The composer writes one row per
-- (client_id, week_start_date). Subsequent renders read from here
-- rather than re-composing on every page load.
CREATE TABLE IF NOT EXISTS client_weekly_plan (
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  slots         jsonb NOT NULL,
  composed_at   timestamptz NOT NULL DEFAULT now(),
  composer_version int NOT NULL DEFAULT 1,
  pulse_run_id  uuid,   -- which pulse run drove this composition
  notes         text,

  PRIMARY KEY (client_id, week_start_date)
);

ALTER TABLE client_weekly_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY cwp_self ON client_weekly_plan
  FOR ALL TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());


-- ─── Seed: starter action_library ──────────────────────────────
-- ~25 items spanning Exercise (strength, zone2, hiit, mobility) and
-- a few of the cross-pillar modalities (breathwork, meditation).
-- All marked active + clinician_reviewed=false for now; clinic team
-- iterates from here in the admin UI.
-- Exercise sessions carry the 5-block structure in `blocks`.

INSERT INTO session_library (key, category, modality, level, name, description, duration_min, intensity_rpe, equipment, contraindications, blocks)
VALUES
  -- ─── Strength · foundation ────────────────────────────────────
  ('strength-foundation-fullbody-a', 'exercise', 'strength', 'foundation',
   'Foundation Strength A',
   'First exposure to compound patterns. Bodyweight or light dumbbell. Builds the movement before adding load.',
   35, 5, ARRAY['bodyweight','dumbbells_light'], ARRAY['recent-surgery'],
   '{"warmup_general":[{"name":"Easy walk in place","duration_min":3},{"name":"Cat-cow","duration_min":2}],"warmup_specific":[{"name":"Bodyweight squat","sets":1,"reps":"10"},{"name":"Glute bridge","sets":1,"reps":"10"},{"name":"Wall push-up","sets":1,"reps":"10"}],"main":[{"name":"Goblet squat","sets":3,"reps":"8-10","rest_sec":90,"rpe":6},{"name":"DB Romanian deadlift","sets":3,"reps":"8-10","rest_sec":90,"rpe":6},{"name":"DB bench press (or floor press)","sets":3,"reps":"8-10","rest_sec":90,"rpe":6},{"name":"DB row","sets":3,"reps":"8-10/side","rest_sec":60,"rpe":6}],"finisher":[{"name":"Plank hold","duration_min":1,"description":"3 × 30s, easy pace"}],"cooldown":[{"name":"Box breathing","duration_min":3}]}'::jsonb),

  ('strength-foundation-fullbody-b', 'exercise', 'strength', 'foundation',
   'Foundation Strength B',
   'Companion session to A — second compound pattern day. Same volume, different lifts to balance the week.',
   35, 5, ARRAY['bodyweight','dumbbells_light'], ARRAY['recent-surgery'],
   '{"warmup_general":[{"name":"Easy walk in place","duration_min":3},{"name":"World''s greatest stretch","duration_min":2}],"warmup_specific":[{"name":"Reverse lunge","sets":1,"reps":"6/side"},{"name":"Inchworm","sets":1,"reps":"6"}],"main":[{"name":"DB step-up","sets":3,"reps":"8/side","rest_sec":90,"rpe":6},{"name":"DB overhead press (seated)","sets":3,"reps":"8-10","rest_sec":90,"rpe":6},{"name":"Single-arm DB row","sets":3,"reps":"10/side","rest_sec":60,"rpe":6},{"name":"DB suitcase carry","sets":3,"reps":"30s","rest_sec":45,"rpe":6}],"finisher":[{"name":"Dead bug","duration_min":2,"description":"3 × 8/side"}],"cooldown":[{"name":"Hip 90/90 stretch","duration_min":3}]}'::jsonb),

  -- ─── Strength · build ─────────────────────────────────────────
  ('strength-build-fullbody-a', 'exercise', 'strength', 'build',
   'Build Strength A',
   'Compound lifts with moderate load. Established movement quality; now building strength.',
   50, 7, ARRAY['barbell','dumbbells','bench'], ARRAY['lower-back-injury'],
   '{"warmup_general":[{"name":"Bike or row","duration_min":5}],"warmup_specific":[{"name":"Bodyweight squat to depth","sets":2,"reps":"8"},{"name":"Banded shoulder dislocation","sets":2,"reps":"10"}],"main":[{"name":"Back squat","sets":4,"reps":"5-6","rest_sec":150,"rpe":8},{"name":"Bench press","sets":4,"reps":"5-6","rest_sec":150,"rpe":8},{"name":"Bent-over row","sets":3,"reps":"8","rest_sec":90,"rpe":7}],"finisher":[{"name":"Farmers carry","duration_min":3,"description":"3 × 40m heavy"}]}'::jsonb),

  ('strength-build-fullbody-b', 'exercise', 'strength', 'build',
   'Build Strength B',
   'Posterior-chain emphasis. Deadlift + overhead press + accessories.',
   50, 7, ARRAY['barbell','dumbbells'], ARRAY['lower-back-injury'],
   '{"warmup_general":[{"name":"Bike or row","duration_min":5}],"warmup_specific":[{"name":"Romanian deadlift drill","sets":2,"reps":"6"},{"name":"Scap pull-up","sets":2,"reps":"5"}],"main":[{"name":"Deadlift","sets":4,"reps":"5","rest_sec":180,"rpe":8},{"name":"Standing overhead press","sets":4,"reps":"5-6","rest_sec":150,"rpe":7},{"name":"Pull-up or lat pulldown","sets":3,"reps":"6-8","rest_sec":90,"rpe":7}],"finisher":[{"name":"Plank","duration_min":3,"description":"3 × 45-60s"}]}'::jsonb),

  -- ─── Strength · performance ───────────────────────────────────
  ('strength-performance-lower', 'exercise', 'strength', 'performance',
   'Performance Lower Body',
   'Heavy compound lower with intensity techniques. For experienced lifters.',
   65, 8, ARRAY['barbell','dumbbells','rack'], ARRAY['lower-back-injury','knee-injury'],
   '{"warmup_general":[{"name":"Bike at 70% effort","duration_min":6}],"warmup_specific":[{"name":"Empty-bar squat","sets":2,"reps":"5"},{"name":"Tempo bodyweight squat","sets":2,"reps":"5"}],"main":[{"name":"Back squat","sets":5,"reps":"3-5","rest_sec":180,"rpe":9},{"name":"Front squat","sets":3,"reps":"5","rest_sec":150,"rpe":8},{"name":"Walking lunge","sets":3,"reps":"10/side","rest_sec":90,"rpe":7}],"finisher":[{"name":"Sled push","duration_min":5,"description":"5 × 20m heavy"}]}'::jsonb),

  -- ─── Zone 2 cardio · all levels ───────────────────────────────
  ('zone2-foundation-walk', 'exercise', 'zone2', 'foundation',
   'Easy Walking Zone 2',
   'Steady walking pace where you can hold a conversation. Builds aerobic base.',
   30, 3, ARRAY['outdoor','treadmill'], ARRAY[]::text[],
   '{"warmup_general":[{"name":"Slow walk","duration_min":3}],"warmup_specific":[{"name":"Pick up to easy pace","duration_min":2}],"main":[{"name":"Steady walk at conversation pace","duration_min":20,"rpe":4}],"finisher":[{"name":"Slow finish + breathing","duration_min":3}]}'::jsonb),

  ('zone2-build-cycle', 'exercise', 'zone2', 'build',
   'Zone 2 Cycle',
   'Steady-state cycling at 65-75% max HR. Conversation pace.',
   45, 5, ARRAY['bike','stationary_bike'], ARRAY[]::text[],
   '{"warmup_general":[{"name":"Easy spin","duration_min":5}],"warmup_specific":[{"name":"Pick up to Zone 2 effort","duration_min":3}],"main":[{"name":"Zone 2 steady-state","duration_min":30,"rpe":5}],"finisher":[{"name":"Cool spin","duration_min":5}],"cooldown":[{"name":"Off-bike stretches","duration_min":3}]}'::jsonb),

  ('zone2-performance-row', 'exercise', 'zone2', 'performance',
   'Zone 2 Rowing',
   'Longer Z2 row at controlled effort. For trained users building aerobic capacity.',
   60, 6, ARRAY['rower'], ARRAY[]::text[],
   '{"warmup_general":[{"name":"Easy row","duration_min":5}],"warmup_specific":[{"name":"Drill pause + reach","duration_min":3}],"main":[{"name":"Z2 steady row","duration_min":45,"rpe":6,"description":"Hold conversation pace; HR ≤ 75% max"}],"cooldown":[{"name":"Easy spin or walk","duration_min":5}]}'::jsonb),

  -- ─── HIIT · all levels ────────────────────────────────────────
  ('hiit-foundation-intervals', 'exercise', 'hiit', 'foundation',
   'Walk-Jog Intervals',
   'First HIIT — alternating brisk walk + light jog. Builds the engine.',
   20, 6, ARRAY['outdoor','treadmill'], ARRAY['cardiac-condition'],
   '{"warmup_general":[{"name":"Brisk walk","duration_min":5}],"warmup_specific":[{"name":"2 × 30s easy jog","duration_min":2}],"main":[{"name":"Walk-jog intervals","duration_min":10,"description":"30s jog / 90s walk × 5","rpe":7}],"cooldown":[{"name":"Walk","duration_min":3}]}'::jsonb),

  ('hiit-build-circuit', 'exercise', 'hiit', 'build',
   'Bodyweight Circuit',
   '6 movements, 30 work / 30 rest, 3 rounds. Hits cardio + strength.',
   25, 8, ARRAY['bodyweight'], ARRAY['knee-injury','shoulder-injury'],
   '{"warmup_general":[{"name":"Jumping jacks","duration_min":3}],"warmup_specific":[{"name":"Bodyweight squat","sets":1,"reps":"10"},{"name":"Push-up","sets":1,"reps":"5"}],"main":[{"name":"Circuit: squat → push-up → lunge → row → mountain climber → plank","duration_min":18,"description":"30s on / 30s off × 6 moves × 3 rounds","rpe":8}],"cooldown":[{"name":"Slow walk + box breathing","duration_min":4}]}'::jsonb),

  ('hiit-performance-tabata', 'exercise', 'hiit', 'performance',
   'Tabata Sprints',
   '20s on / 10s off × 8 rounds, bike or row.',
   30, 9, ARRAY['bike','rower'], ARRAY['cardiac-condition','recent-surgery'],
   '{"warmup_general":[{"name":"Easy spin","duration_min":5}],"warmup_specific":[{"name":"3 × 15s accel","duration_min":3}],"main":[{"name":"Tabata: 20s max / 10s rest × 8","duration_min":4,"rpe":10},{"name":"Recover","duration_min":4,"rpe":3},{"name":"Second Tabata block","duration_min":4,"rpe":10}],"cooldown":[{"name":"Easy spin","duration_min":5}]}'::jsonb),

  -- ─── Mobility · all levels ────────────────────────────────────
  ('mobility-foundation-flow', 'exercise', 'mobility', 'foundation',
   'Daily Mobility Flow',
   '15-min full-body mobility for desk workers + returning athletes.',
   15, 2, ARRAY['bodyweight','mat'], ARRAY[]::text[],
   '{"warmup_general":[{"name":"Cat-cow","duration_min":2}],"warmup_specific":[],"main":[{"name":"World''s greatest stretch","sets":2,"reps":"5/side"},{"name":"90/90 hip switch","sets":2,"reps":"6/side"},{"name":"T-spine windmill","sets":2,"reps":"5/side"},{"name":"Scapular wall slide","sets":2,"reps":"10"}],"finisher":[{"name":"Child''s pose hold","duration_min":2}]}'::jsonb),

  ('mobility-build-yoga', 'exercise', 'mobility', 'build',
   'Yoga Flow',
   '20-min standing flow — strength-builder''s mobility companion.',
   20, 3, ARRAY['mat'], ARRAY[]::text[],
   '{"warmup_general":[{"name":"Down-dog / cobra cycles","duration_min":3}],"main":[{"name":"Sun salutation A","sets":3,"reps":"full flow"},{"name":"Warrior 1-2-3 sequence","sets":2,"reps":"per side"},{"name":"Lizard pose","sets":1,"reps":"60s/side"}],"cooldown":[{"name":"Pigeon + savasana","duration_min":5}]}'::jsonb),

  -- ─── Breathwork · level-agnostic ─────────────────────────────
  ('breathwork-box', 'exercise', 'breathwork', NULL,
   'Box Breathing',
   '4-4-4-4 breath pattern. Sympathetic-to-parasympathetic shift.',
   5, 1, ARRAY[]::text[], ARRAY[]::text[], NULL),

  ('breathwork-physiological-sigh', 'exercise', 'breathwork', NULL,
   'Physiological Sigh',
   'Two short inhales through the nose, one long exhale through the mouth. Fastest known down-regulation.',
   3, 1, ARRAY[]::text[], ARRAY[]::text[], NULL),

  -- ─── Meditation · cross-pillar ───────────────────────────────
  ('meditation-foundation-10min', 'mental', 'meditation', 'foundation',
   '10-min Body Scan',
   'Guided body-scan meditation. Entry-point for mindfulness practice.',
   10, 1, ARRAY[]::text[], ARRAY[]::text[], NULL),

  ('meditation-build-20min', 'mental', 'meditation', 'build',
   '20-min Open Awareness',
   'Open-awareness meditation. For users with an established practice.',
   20, 1, ARRAY[]::text[], ARRAY[]::text[], NULL);
