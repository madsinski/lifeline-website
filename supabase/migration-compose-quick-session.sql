-- Quick Session composer.
--
-- Returns a balanced ad-hoc workout for the home tile / "Switch it up"
-- branch:
--   - warmup (cat stretch + world's greatest stretch) for strength/cardio
--   - main: bang-for-buck exercises DEDUPLICATED by (primary_muscles[1],
--     force) so longer sessions get one push / one pull / one squat /
--     one hinge instead of 5 push-up variants and 2 dip variants
--   - cooldown (child's pose) for strength/cardio
--   - mobility / recovery intents skip the warmup/cooldown bookends —
--     the session itself is stretching
--
-- Tie-breakers when picking the canonical exercise per movement
-- pattern: beginner > intermediate > expert, then bodyweight over
-- equipment-required, then alphabetical.
--
-- sort_order is reserved (-100 = warmup, -50 = dynamic warmup, 1000 =
-- cooldown) so the time-budget renderer in renderForBudget() picks
-- them as warm/cool naturally.

CREATE OR REPLACE FUNCTION public.compose_quick_session(
  p_intent text,
  p_setting text,
  p_equipment text[]
) RETURNS TABLE (
  id uuid,
  exercise_id uuid,
  name text,
  priority smallint,
  priority_override smallint,
  time_seconds_estimated smallint,
  fed_category text,
  sort_order int,
  sets int,
  reps text,
  duration text,
  rest text,
  video_url text,
  illustration_url text,
  swapped boolean
) AS $$
DECLARE
  v_eq text[];
  v_warmup_id uuid;
  v_dyn_warmup_id uuid;
  v_cooldown_id uuid;
BEGIN
  IF p_setting = 'home' THEN
    v_eq := array_remove(array(SELECT DISTINCT unnest(ARRAY['bodyweight'] || coalesce(p_equipment, ARRAY[]::text[]))), NULL);
  ELSE
    v_eq := NULL;
  END IF;

  SELECT e.id INTO v_warmup_id     FROM exercises e WHERE e.name = 'Cat Stretch'           LIMIT 1;
  SELECT e.id INTO v_dyn_warmup_id FROM exercises e WHERE e.name = 'World''s Greatest Stretch' LIMIT 1;
  SELECT e.id INTO v_cooldown_id   FROM exercises e WHERE e.name = 'Child''s Pose'         LIMIT 1;

  IF p_intent IN ('strength', 'cardio') AND v_warmup_id IS NOT NULL THEN
    RETURN QUERY
      SELECT e.id, e.id, e.name,
        4::smallint, NULL::smallint,
        e.time_seconds_estimated, e.fed_category,
        -100::int, 2::int, '45s'::text, NULL::text, NULL::text,
        e.video_url, e.illustration_url, false
      FROM exercises e WHERE e.id = v_warmup_id;

    IF v_dyn_warmup_id IS NOT NULL THEN
      RETURN QUERY
        SELECT e.id, e.id, e.name,
          4::smallint, NULL::smallint,
          e.time_seconds_estimated, e.fed_category,
          -50::int, 2::int, '5 each side'::text, NULL::text, NULL::text,
          e.video_url, e.illustration_url, false
        FROM exercises e WHERE e.id = v_dyn_warmup_id;
    END IF;
  END IF;

  RETURN QUERY
    SELECT DISTINCT ON ((e.primary_muscles)[1], e.force)
      e.id, e.id, e.name,
      coalesce(e.priority, 1)::smallint, NULL::smallint,
      coalesce(e.time_seconds_estimated, 240)::smallint,
      e.fed_category,
      coalesce(e.priority, 1)::int * 100 + abs(hashtext(e.id::text) % 100),
      3::int,
      CASE p_intent
        WHEN 'strength' THEN '8-12 reps'
        WHEN 'mobility' THEN '30s hold'
        WHEN 'cardio'   THEN '45s on / 15s off'
        ELSE '60s'
      END,
      NULL::text,
      CASE p_intent WHEN 'strength' THEN '60s' ELSE NULL END,
      e.video_url, e.illustration_url, false
    FROM exercises e
    WHERE e.bang_for_buck = true
      AND (v_eq IS NULL OR e.equipment = ANY(v_eq))
      AND (
        (p_intent = 'strength' AND e.fed_category = 'strength') OR
        (p_intent = 'mobility' AND e.fed_category = 'stretching') OR
        (p_intent = 'cardio'   AND e.fed_category IN ('cardio','plyometrics')) OR
        (p_intent = 'recovery' AND e.fed_category = 'stretching' AND e.priority = 4)
      )
    ORDER BY (e.primary_muscles)[1], e.force,
             CASE e.level WHEN 'beginner' THEN 0 WHEN 'intermediate' THEN 1 ELSE 2 END,
             CASE WHEN e.equipment = 'bodyweight' THEN 0 ELSE 1 END,
             e.name;

  IF p_intent IN ('strength', 'cardio') AND v_cooldown_id IS NOT NULL THEN
    RETURN QUERY
      SELECT e.id, e.id, e.name,
        4::smallint, NULL::smallint,
        e.time_seconds_estimated, e.fed_category,
        1000::int, 1::int, '90s'::text, NULL::text, NULL::text,
        e.video_url, e.illustration_url, false
      FROM exercises e WHERE e.id = v_cooldown_id;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.compose_quick_session(text, text, text[]) TO authenticated;
