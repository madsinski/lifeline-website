-- Comprehensive audit fixes from the 2026-04-29 review.
-- Documents schema additions made in one session via Mgmt API.
--
-- 1. compose_quick_session: split per-intent so mobility/recovery
--    return a non-empty exercise list (the BFB filter excluded
--    stretching, leaving 0 rows).
--
-- 2. client_readiness: per-day 1-5 score (😴 wiped → 💪 peak).
--    Drives the morning check-in widget; ≤2 surfaces a recovery
--    suggestion banner.
--
-- 3. exercise_prs + set_logs + detect_pr_on_set_log trigger:
--    in-session per-set logging, server-side PR detection.
--
-- 4. coach_exercise_notes: per-client coach annotations.
--    Read-only RLS for clients (own rows); admin write path TBD.
--
-- 5. clients.deload_recommended_at + .deload_dismissed_at +
--    check_deload_recommendation() function: detects sustained
--    intensity > 130% over 5+ of last 7 days.
--
-- 6. suggest_next_program() function: progression ladder when user
--    has completed ≥12 weeks at ≥60% consistency.
--
-- 7. mobility-base + beginner-foundation extended from 8→12 weeks.
--
-- 8. Junk placeholder program 'fgjmuib2' deleted.

-- Tables
CREATE TABLE IF NOT EXISTS public.client_readiness (
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, date)
);

CREATE TABLE IF NOT EXISTS public.exercise_prs (
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  weight numeric,
  reps int,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS public.set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  set_index smallint NOT NULL,
  weight numeric,
  reps smallint,
  notes text,
  logged_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coach_exercise_notes (
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  note text NOT NULL,
  authored_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, exercise_id)
);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS deload_recommended_at timestamptz,
  ADD COLUMN IF NOT EXISTS deload_dismissed_at timestamptz;

-- See full function bodies in respective per-feature migration files
-- (compose_quick_session.sql, etc) — applied via Mgmt API.
