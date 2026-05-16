-- =============================================================
-- client_action_overrides
--
-- Per-user, per-slot overrides for actions in their daily plan.
-- One row covers all three intents (Move / Custom replace / Skip)
-- because they target the same slot (lib_key + original_dow) and
-- are mutually exclusive in the UI.
--
--   Move    →  new_dow = N, custom_* = NULL, is_skipped = false
--   Custom  →  new_dow = NULL, custom_title set, is_skipped = false
--   Skip    →  new_dow = NULL, custom_* = NULL, is_skipped = true
--
-- effective_to controls scope:
--   "Just this week"  →  effective_to = last-day-of-current-week
--   "Every week"      →  effective_to = NULL  (recurring)
--
-- Read path: src/services/api.ts applyClientOverrides() mutates the
-- daily plan rows before pillar grouping. Write paths:
--   - src/components/ActionOverrideSheet.tsx (long-press surface)
--   - src/components/HealthCoachChatSheet.tsx (AI-proposed intent)
--
-- Distinct from client_action_dismissals: a dismissal is "I don't
-- want this action AT ALL". A Skip override is "skip this slot this
-- week (or recurring)" without flagging the action as wrong-for-me.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.client_action_overrides (
  client_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lib_key              text NOT NULL,
  original_dow         smallint NOT NULL CHECK (original_dow BETWEEN 0 AND 6),  -- 0=Mon..6=Sun

  -- Move case
  new_dow              smallint CHECK (new_dow IS NULL OR new_dow BETWEEN 0 AND 6),

  -- Custom-replace case
  custom_title         text,
  custom_details       text[] NOT NULL DEFAULT '{}',
  custom_pillar        text,   -- 'exercise' | 'nutrition' | 'sleep' | 'mental'
  custom_duration_min  integer CHECK (custom_duration_min IS NULL OR custom_duration_min > 0),

  -- Skip case
  is_skipped           boolean NOT NULL DEFAULT false,

  -- Scope window
  effective_from       date NOT NULL DEFAULT CURRENT_DATE,
  effective_to         date,                                                    -- NULL = recurring

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (client_id, lib_key, original_dow),

  -- Guard: exactly one intent expressed per row.
  CONSTRAINT one_intent_per_override CHECK (
    (is_skipped = true  AND new_dow IS NULL AND custom_title IS NULL)
    OR (is_skipped = false AND new_dow IS NOT NULL AND custom_title IS NULL)
    OR (is_skipped = false AND new_dow IS NULL AND custom_title IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cao_client ON public.client_action_overrides (client_id);
CREATE INDEX IF NOT EXISTS idx_cao_client_window
  ON public.client_action_overrides (client_id, effective_from, effective_to);

-- updated_at touch trigger (matches the pattern used by
-- client_action_substitutions / client_programs).
CREATE OR REPLACE FUNCTION public.touch_client_action_overrides_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cao_touch ON public.client_action_overrides;
CREATE TRIGGER trg_cao_touch
  BEFORE UPDATE ON public.client_action_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_client_action_overrides_updated_at();

ALTER TABLE public.client_action_overrides ENABLE ROW LEVEL SECURITY;

-- Users manage their own overrides (mirrors client_action_substitutions).
DROP POLICY IF EXISTS "user manages own overrides" ON public.client_action_overrides;
CREATE POLICY "user manages own overrides" ON public.client_action_overrides
  FOR ALL TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Staff read for coach-view + future admin surfaces.
DROP POLICY IF EXISTS "staff read all overrides" ON public.client_action_overrides;
CREATE POLICY "staff read all overrides" ON public.client_action_overrides
  FOR SELECT TO authenticated
  USING (is_active_staff());
