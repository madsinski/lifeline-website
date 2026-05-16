-- =============================================================
-- Denormalise the action label onto action_completions so the
-- Activity screen and any history-style surface can show real names
-- ("Chest day · push variants") instead of opaque keys
-- ("exercise-w1d2-morning-0").
--
-- The RN app's toggleActionStatus already has the label in scope at
-- the point of insert; this migration adds the column + backfills as
-- much as we can from program_actions.label using the runtime key
-- decoding (best-effort, doesn't have to be perfect).
--
-- Idempotent.
-- =============================================================

ALTER TABLE public.action_completions
  ADD COLUMN IF NOT EXISTS label text;

-- Backfill: for action keys of the canonical form
-- "<category>-w<week>d<day>-<slot>-<index>", look up program_actions
-- by program key + week/day + sort_order. Coarse — only fills rows
-- where the key shape matches and a program_action exists. Anything
-- else stays NULL and is rendered via the RN-side prettyKey() heuristic.
WITH parsed AS (
  SELECT
    ac.id,
    (regexp_match(ac.action_key, '^([a-z]+)-w(\d+)d(\d+)-([a-z]+)-(\d+)$'))[1] AS category,
    (regexp_match(ac.action_key, '^([a-z]+)-w(\d+)d(\d+)-([a-z]+)-(\d+)$'))[2]::int AS week_range,
    (regexp_match(ac.action_key, '^([a-z]+)-w(\d+)d(\d+)-([a-z]+)-(\d+)$'))[3]::int AS day_of_week,
    (regexp_match(ac.action_key, '^([a-z]+)-w(\d+)d(\d+)-([a-z]+)-(\d+)$'))[5]::int AS sort_order
  FROM public.action_completions ac
  WHERE ac.label IS NULL
    AND ac.action_key ~ '^[a-z]+-w\d+d\d+-[a-z]+-\d+$'
),
matched AS (
  SELECT
    p.id,
    pa.label
  FROM parsed p
  JOIN public.programs pr ON pr.key LIKE p.category || '-%'
  JOIN public.program_actions pa
    ON pa.program_id = pr.id
   AND pa.week_range = p.week_range
   AND pa.day_of_week = p.day_of_week
   AND pa.sort_order = p.sort_order
)
UPDATE public.action_completions ac
SET label = m.label
FROM matched m
WHERE ac.id = m.id;
