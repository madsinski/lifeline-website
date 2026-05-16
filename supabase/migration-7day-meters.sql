-- =============================================================
-- Add 7-day showing-up + completion scores to clients.
--
-- The Home hero shows the short-window view (last 7 days — feels
-- immediate, tracks recent rhythm). The Activity page shows the
-- 28-day view for the bigger picture. Same formulas, different
-- windows.
--
--   consistency_score_7d  = days with ≥1 done in last 7 ÷ 7 × 100
--   completion_score_7d   = done ÷ touched in last 7 × 100
--
-- Idempotent.
-- =============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS consistency_score_7d smallint,
  ADD COLUMN IF NOT EXISTS completion_score_7d smallint;

DROP FUNCTION IF EXISTS public.refresh_user_meters(uuid);

CREATE FUNCTION public.refresh_user_meters(p_client_id uuid)
RETURNS TABLE (
  consistency      smallint,
  intensity        smallint,
  depth            smallint,
  completion       smallint,
  consistency_7d   smallint,
  completion_7d    smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consistency     smallint;
  v_intensity       smallint;
  v_depth           smallint;
  v_completion      smallint;
  v_consistency_7d  smallint;
  v_completion_7d   smallint;
  v_completed_days_28  int;
  v_completed_days_7   int;
  v_total_done_28      int;
  v_total_touched_28   int;
  v_total_done_7       int;
  v_total_touched_7    int;
  v_peak_day           int;
  v_actual_effort      numeric;
  v_prescribed_effort  numeric;
BEGIN
  -- 28-day showing-up + done aggregate (for depth) — kept as-is.
  SELECT count(DISTINCT date)
    INTO v_completed_days_28
    FROM action_completions
   WHERE client_id = p_client_id AND status = 'done'
     AND date >= current_date - interval '27 days' AND date <= current_date;
  v_consistency := round(100.0 * v_completed_days_28 / 28)::smallint;
  IF v_consistency > 100 THEN v_consistency := 100; END IF;

  SELECT coalesce(sum(daily_count), 0), coalesce(max(daily_count), 0)
    INTO v_total_done_28, v_peak_day
    FROM (
      SELECT date, count(*) AS daily_count FROM action_completions
       WHERE client_id = p_client_id AND status = 'done'
         AND date >= current_date - interval '27 days' AND date <= current_date
       GROUP BY date
    ) per_day;
  IF v_peak_day > 0 THEN
    v_depth := least(100, round(100.0 * v_total_done_28 / (28 * v_peak_day)))::smallint;
  ELSE v_depth := NULL;
  END IF;

  -- 28-day completion = done ÷ touched.
  SELECT count(*) INTO v_total_touched_28 FROM action_completions
   WHERE client_id = p_client_id
     AND date >= current_date - interval '27 days' AND date <= current_date;
  IF v_total_touched_28 > 0 THEN
    v_completion := least(100, round(100.0 * v_total_done_28 / v_total_touched_28))::smallint;
  ELSE v_completion := NULL;
  END IF;

  -- 7-day showing-up.
  SELECT count(DISTINCT date)
    INTO v_completed_days_7
    FROM action_completions
   WHERE client_id = p_client_id AND status = 'done'
     AND date >= current_date - interval '6 days' AND date <= current_date;
  v_consistency_7d := round(100.0 * v_completed_days_7 / 7)::smallint;
  IF v_consistency_7d > 100 THEN v_consistency_7d := 100; END IF;

  -- 7-day completion = done ÷ touched in last 7.
  SELECT
    count(*) FILTER (WHERE status = 'done'),
    count(*)
    INTO v_total_done_7, v_total_touched_7
    FROM action_completions
   WHERE client_id = p_client_id
     AND date >= current_date - interval '6 days' AND date <= current_date;
  IF v_total_touched_7 > 0 THEN
    v_completion_7d := least(100, round(100.0 * v_total_done_7 / v_total_touched_7))::smallint;
  ELSE v_completion_7d := NULL;
  END IF;

  -- 7-day intensity (unchanged — kept for deload detector).
  SELECT
    coalesce(sum(coalesce(actual_duration_seconds, 1800) * coalesce(perceived_intensity, 6)::numeric), 0),
    coalesce(sum(coalesce(prescribed_duration_seconds, 1800) * coalesce(prescribed_intensity, 6)::numeric), 0)
    INTO v_actual_effort, v_prescribed_effort
    FROM action_completions
   WHERE client_id = p_client_id AND status = 'done'
     AND date >= current_date - interval '6 days' AND date <= current_date;
  IF v_prescribed_effort > 0 THEN
    v_intensity := least(round(100.0 * v_actual_effort / v_prescribed_effort)::int, 250)::smallint;
  ELSE v_intensity := NULL;
  END IF;

  UPDATE clients
     SET consistency_score = v_consistency,
         consistency_depth_score = v_depth,
         completion_score = v_completion,
         consistency_score_7d = v_consistency_7d,
         completion_score_7d = v_completion_7d,
         intensity_score = v_intensity,
         scores_updated_at = now()
   WHERE id = p_client_id;

  consistency     := v_consistency;
  intensity       := v_intensity;
  depth           := v_depth;
  completion      := v_completion;
  consistency_7d  := v_consistency_7d;
  completion_7d   := v_completion_7d;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_user_meters(uuid) TO authenticated;
