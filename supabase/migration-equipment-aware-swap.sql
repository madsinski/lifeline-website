-- Phase 7: equipment-aware exercise swap.
--
-- find_equipment_swap(exercise_id, equipment[]) returns the best
-- equivalent exercise the user can perform given their available
-- equipment. If the source already matches OR is bodyweight, returns
-- it unchanged. Otherwise picks the closest match by primary_muscles
-- + force, ranked by mechanic match → level match → presence of video.
--
-- get_action_exercises_for_user(action_key, client_id) returns enriched
-- action_exercises with swaps applied for pure-home users (setting='home').
-- gym/hybrid users get the canonical exercises unchanged. Used by the RN
-- getActionEnrichedExercises(actionKey, applyUserSwap=true) path.

CREATE OR REPLACE FUNCTION public.find_equipment_swap(
  p_exercise_id uuid,
  p_user_equipment text[]
) RETURNS uuid AS $$
DECLARE
  v_swap uuid;
  v_src_muscles text[];
  v_src_force text;
  v_src_mechanic text;
  v_src_equipment text;
  v_src_level text;
BEGIN
  SELECT primary_muscles, force, mechanic, equipment, level
    INTO v_src_muscles, v_src_force, v_src_mechanic, v_src_equipment, v_src_level
    FROM exercises WHERE id = p_exercise_id;

  IF v_src_equipment IS NULL OR v_src_equipment = ANY(p_user_equipment)
     OR v_src_equipment IN ('body only', 'bodyweight') THEN
    RETURN p_exercise_id;
  END IF;

  IF v_src_muscles IS NULL OR array_length(v_src_muscles, 1) = 0 THEN
    RETURN p_exercise_id;
  END IF;

  SELECT id INTO v_swap
    FROM exercises
   WHERE primary_muscles && v_src_muscles
     AND coalesce(force, '') = coalesce(v_src_force, '')
     AND (equipment = ANY(p_user_equipment)
          OR equipment IN ('body only', 'bodyweight'))
     AND id <> p_exercise_id
     AND coalesce(video_url, '') <> ''
   ORDER BY
     CASE WHEN mechanic = v_src_mechanic THEN 0 ELSE 1 END,
     CASE WHEN level = v_src_level THEN 0 ELSE 1 END,
     CASE WHEN equipment IN ('body only','bodyweight') THEN 1 ELSE 0 END,
     random()
   LIMIT 1;

  RETURN coalesce(v_swap, p_exercise_id);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_action_exercises_for_user(
  p_action_key text,
  p_client_id uuid
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
  v_setting text;
BEGIN
  SELECT
    coalesce(c.exercise_profile->>'setting', 'hybrid'),
    coalesce(
      (SELECT array_agg(value) FROM jsonb_array_elements_text(c.exercise_profile->'homeEquipment') AS t(value)),
      ARRAY[]::text[]
    )
    INTO v_setting, v_eq
    FROM clients c WHERE c.id = p_client_id;

  IF v_setting <> 'home' THEN
    RETURN QUERY
      SELECT
        ae.id, ae.exercise_id, e.name,
        e.priority, ae.priority_override,
        e.time_seconds_estimated, e.fed_category, ae.sort_order,
        ae.sets, ae.reps, ae.duration, ae.rest,
        e.video_url, e.illustration_url,
        false AS swapped
      FROM action_exercises ae
      JOIN exercises e ON e.id = ae.exercise_id
      WHERE ae.action_key = p_action_key
      ORDER BY ae.sort_order;
  ELSE
    RETURN QUERY
      SELECT
        ae.id,
        find_equipment_swap(ae.exercise_id, v_eq) AS exercise_id,
        e.name,
        e.priority, ae.priority_override,
        e.time_seconds_estimated, e.fed_category, ae.sort_order,
        ae.sets, ae.reps, ae.duration, ae.rest,
        e.video_url, e.illustration_url,
        (find_equipment_swap(ae.exercise_id, v_eq) <> ae.exercise_id) AS swapped
      FROM action_exercises ae
      JOIN exercises e ON e.id = find_equipment_swap(ae.exercise_id, v_eq)
      WHERE ae.action_key = p_action_key
      ORDER BY ae.sort_order;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.find_equipment_swap(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_action_exercises_for_user(text, uuid) TO authenticated;
