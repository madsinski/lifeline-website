-- =============================================================
-- Backfill action_completions.label for client_custom_programs rows.
--
-- The v2 backfill matched program_actions only. Custom programs live
-- in client_custom_programs.actions (jsonb array), so any historical
-- completion from a custom program (e.g. coach-built sleep or mental
-- routine) still had a NULL label and rendered as a key in Activity.
--
-- Custom-program action_completions.action_key shape:
--   "<category>-custom-<uuid>-w<w>d<d>-<time_group>-<sort_order>"
-- where <uuid> is the client_custom_programs.id and the trailing
-- segments match the JSON element.
--
-- Idempotent.
-- =============================================================

WITH parts AS (
  SELECT
    ac.id,
    m[2] AS db_id,
    m[3]::int AS w,
    m[4]::int AS d,
    m[5] AS tg,
    m[6]::int AS sort
  FROM public.action_completions ac
  CROSS JOIN LATERAL regexp_match(
    ac.action_key,
    '^(exercise|nutrition|sleep|mental)-custom-([0-9a-f-]{36})-w(\d+)d(\d+)-([a-z]+)-(\d+)$'
  ) AS m
  WHERE (ac.label IS NULL OR ac.label = '')
    AND m IS NOT NULL
),
matches AS (
  SELECT
    p.id,
    elem->>'label' AS label
  FROM parts p
  JOIN public.client_custom_programs ccp
    ON ccp.id::text = p.db_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(to_jsonb(ccp.actions)) = 'array' THEN to_jsonb(ccp.actions)
      ELSE '[]'::jsonb
    END
  ) AS elem
  WHERE coalesce((elem->>'week_range')::int, -1) = p.w
    AND coalesce((elem->>'day_of_week')::int, -1) = p.d
    AND coalesce(elem->>'time_group', 'morning') = p.tg
    AND coalesce((elem->>'sort_order')::int, 0) = p.sort
)
UPDATE public.action_completions ac
SET label = m.label
FROM matches m
WHERE ac.id = m.id
  AND m.label IS NOT NULL
  AND m.label <> '';

-- Action-override custom_title path: action_key of shape "custom:<lib_key>:<dow>".
-- PK is (client_id, lib_key, original_dow) so join on client_id too.
UPDATE public.action_completions ac
SET label = ao.custom_title
FROM public.action_overrides ao
WHERE (ac.label IS NULL OR ac.label = '')
  AND ac.action_key ~ '^custom:'
  AND ao.client_id = ac.client_id
  AND ao.lib_key = split_part(substring(ac.action_key from 8), ':', 1)
  AND ao.original_dow::text = split_part(ac.action_key, ':', 3)
  AND ao.custom_title IS NOT NULL
  AND ao.custom_title <> '';
