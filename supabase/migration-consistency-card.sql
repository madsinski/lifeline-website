-- =============================================================
-- Consistency card foundation.
--
-- Adds:
--   * clients.consistency_depth_score  — actions-completed weighted
--     against the user's own peak day, more honest than days-with-≥1.
--     Existing consistency_score (days-with-≥1) is kept for back-compat.
--   * clients.consistency_narrative + _at — AI / rule-based one-liner
--     refreshed daily by /api/ai/refresh-consistency-narratives.
--   * get_consistency_grid(uuid) — 28 rows of (date, done_count,
--     depth_pct) so the home Consistency card can render a dot grid.
--   * refresh_user_meters extended to write consistency_depth_score.
--
-- Run in Supabase SQL editor. Idempotent.
-- =============================================================

-- ─── 1. New columns ─────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS consistency_depth_score smallint;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS consistency_narrative text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS consistency_narrative_at timestamptz;

-- ─── 2. get_consistency_grid ─────────────────────────────────────
-- Returns 28 contiguous days (oldest first) with the user's completed
-- action count per day. Caller normalizes against peak for fill
-- intensity; this fn stays cheap (single GROUP BY).
CREATE OR REPLACE FUNCTION public.get_consistency_grid(p_client_id uuid)
RETURNS TABLE (date date, done_count int)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH days AS (
    SELECT (current_date - i)::date AS date
    FROM generate_series(0, 27) i
  ),
  daily AS (
    SELECT ac.date, count(*)::int AS done_count
    FROM public.action_completions ac
    WHERE ac.client_id = p_client_id
      AND ac.status = 'done'
      AND ac.date >= current_date - interval '27 days'
      AND ac.date <= current_date
    GROUP BY ac.date
  )
  SELECT d.date, coalesce(daily.done_count, 0) AS done_count
  FROM days d
  LEFT JOIN daily ON daily.date = d.date
  ORDER BY d.date ASC;
$$;

REVOKE ALL ON FUNCTION public.get_consistency_grid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_consistency_grid(uuid) TO authenticated;

-- ─── 3. refresh_user_meters — extended with depth ────────────────
-- depth_score = total_done_in_28d / (28 × peak_done_in_any_day_28d)
-- Capped to 100. NULL when no completions in the window.
CREATE OR REPLACE FUNCTION public.refresh_user_meters(p_client_id uuid)
RETURNS TABLE (consistency smallint, intensity smallint, depth smallint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consistency smallint;
  v_intensity   smallint;
  v_depth       smallint;
  v_completed_days int;
  v_total_done int;
  v_peak_day int;
  v_actual_effort numeric;
  v_prescribed_effort numeric;
BEGIN
  -- Days with ≥1 done in last 28 days (existing metric, unchanged).
  SELECT count(DISTINCT date)
    INTO v_completed_days
    FROM action_completions
   WHERE client_id = p_client_id
     AND status = 'done'
     AND date >= current_date - interval '27 days'
     AND date <= current_date;
  v_consistency := round(100.0 * v_completed_days / 28)::smallint;
  IF v_consistency > 100 THEN v_consistency := 100; END IF;

  -- Depth: actions done in 28d, weighted against the user's own peak
  -- day. Compares them to their best self instead of an arbitrary
  -- target. Empty history → NULL so the UI can hide the metric.
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

  -- Intensity (unchanged): effort over 7 days vs prescribed.
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
         intensity_score = v_intensity,
         scores_updated_at = now()
   WHERE id = p_client_id;

  consistency := v_consistency;
  intensity   := v_intensity;
  depth       := v_depth;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_user_meters(uuid) TO authenticated;
