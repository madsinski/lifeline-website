-- =============================================================
-- Unified 28-day completion_score on clients.
--
-- The Home hero tile and the Activity stats tile were both labeled
-- "Completion %" but computed different things (today vs 28d), so a
-- user could see 91% in the hero and 24% on Activity at the same
-- time. This migration adds a single source of truth.
--
-- completion_score = done_count / touched_count × 100  (28-day window,
-- where touched = any row in action_completions regardless of status).
-- NULL when the user hasn't touched anything in the window.
--
-- Idempotent. Run in Supabase SQL editor.
-- =============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS completion_score smallint;

-- Recreate refresh_user_meters with completion_score added to the OUT
-- columns. Postgres requires DROP for return type changes.
DROP FUNCTION IF EXISTS public.refresh_user_meters(uuid);

CREATE FUNCTION public.refresh_user_meters(p_client_id uuid)
RETURNS TABLE (
  consistency smallint,
  intensity smallint,
  depth smallint,
  completion smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consistency smallint;
  v_intensity   smallint;
  v_depth       smallint;
  v_completion  smallint;
  v_completed_days int;
  v_total_done int;
  v_total_touched int;
  v_peak_day int;
  v_actual_effort numeric;
  v_prescribed_effort numeric;
BEGIN
  -- Days with ≥1 done in last 28 days ("showing up %").
  SELECT count(DISTINCT date)
    INTO v_completed_days
    FROM action_completions
   WHERE client_id = p_client_id
     AND status = 'done'
     AND date >= current_date - interval '27 days'
     AND date <= current_date;
  v_consistency := round(100.0 * v_completed_days / 28)::smallint;
  IF v_consistency > 100 THEN v_consistency := 100; END IF;

  -- Depth (kept for AI narrative). Total done ÷ (28 × peak_day).
  SELECT
    coalesce(sum(daily_count), 0),
    coalesce(max(daily_count), 0)
    INTO v_total_done, v_peak_day
    FROM (
      SELECT date, count(*) AS daily_count
        FROM action_completions
       WHERE client_id = p_client_id
         AND status = 'done'
         AND date >= current_date - interval '27 days'
         AND date <= current_date
       GROUP BY date
    ) per_day;

  IF v_peak_day > 0 THEN
    v_depth := least(100, round(100.0 * v_total_done / (28 * v_peak_day)))::smallint;
  ELSE
    v_depth := NULL;
  END IF;

  -- Completion: done ÷ touched over 28 days. "Of the actions you
  -- engaged with, what % did you finish?" Matches the Activity page.
  SELECT count(*)
    INTO v_total_touched
    FROM action_completions
   WHERE client_id = p_client_id
     AND date >= current_date - interval '27 days'
     AND date <= current_date;

  IF v_total_touched > 0 THEN
    v_completion := least(100, round(100.0 * v_total_done / v_total_touched))::smallint;
  ELSE
    v_completion := NULL;
  END IF;

  -- Intensity: effort over 7 days vs prescribed (unchanged, kept for
  -- the deload detector — not user-facing in the new design).
  SELECT
    coalesce(sum(coalesce(actual_duration_seconds, 1800) * coalesce(perceived_intensity, 6)::numeric), 0),
    coalesce(sum(coalesce(prescribed_duration_seconds, 1800) * coalesce(prescribed_intensity, 6)::numeric), 0)
    INTO v_actual_effort, v_prescribed_effort
    FROM action_completions
   WHERE client_id = p_client_id
     AND status = 'done'
     AND date >= current_date - interval '6 days'
     AND date <= current_date;

  IF v_prescribed_effort > 0 THEN
    v_intensity := least(round(100.0 * v_actual_effort / v_prescribed_effort)::int, 250)::smallint;
  ELSE
    v_intensity := NULL;
  END IF;

  UPDATE clients
     SET consistency_score = v_consistency,
         consistency_depth_score = v_depth,
         completion_score = v_completion,
         intensity_score = v_intensity,
         scores_updated_at = now()
   WHERE id = p_client_id;

  consistency := v_consistency;
  intensity   := v_intensity;
  depth       := v_depth;
  completion  := v_completion;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_user_meters(uuid) TO authenticated;
