-- Meter recompute function. Called from RN client after each
-- action_completion (fire-and-forget) and nightly via cron.
--
-- Consistency: % of distinct dates in last 28 days with at least one
--              completed action. Capped at 100. NULL never returned.
--
-- Intensity:   actual_effort / prescribed_effort × 100 over last 7 days.
--              effort = duration_seconds × perceived_intensity (RPE).
--              Defaults: 30 min duration, RPE 6. Capped at 250 to avoid
--              runaway values from miscalibrated RPE.
--              Returns NULL when no completions exist in the window.
--
-- SECURITY DEFINER: needs to write clients table even when RLS would
-- normally block the cross-row update. Caller-validated by the RN app
-- which only passes its own auth.uid().

CREATE OR REPLACE FUNCTION public.refresh_user_meters(p_client_id uuid)
RETURNS TABLE (consistency smallint, intensity smallint) AS $$
DECLARE
  v_consistency smallint;
  v_intensity smallint;
  v_prescribed_days int;
  v_completed_days int;
  v_actual_effort numeric;
  v_prescribed_effort numeric;
BEGIN
  SELECT count(DISTINCT date)
    INTO v_completed_days
    FROM action_completions
   WHERE client_id = p_client_id
     AND status = 'done'
     AND date >= current_date - interval '27 days'
     AND date <= current_date;

  v_prescribed_days := 28;
  v_consistency := round(100.0 * v_completed_days / v_prescribed_days)::smallint;
  IF v_consistency > 100 THEN v_consistency := 100; END IF;

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
         intensity_score = v_intensity,
         scores_updated_at = now()
   WHERE id = p_client_id;

  consistency := v_consistency;
  intensity := v_intensity;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.refresh_user_meters(uuid) TO authenticated;
