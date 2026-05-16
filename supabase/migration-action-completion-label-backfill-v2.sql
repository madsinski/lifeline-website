-- =============================================================
-- Better backfill for action_completions.label.
--
-- The first backfill only matched keys of shape
-- "<cat>-w<w>d<d>-<slot>-<n>", which missed all program actions where
-- the slot key contains the program name (e.g.
-- "sleep-optimized-sleep-w0d5-midday-1"). The Activity page was
-- consequently rendering prettyKey() output like "Optimized Sleep
-- W0d5 Midday 1" instead of real action names.
--
-- Real shape of item.key for program actions:
--   "<category>-<program_slot_key>"
-- where program_slot_key matches program_actions.action_key.
--
-- This migration strips the leading category prefix and joins to
-- program_actions directly.
--
-- Idempotent.
-- =============================================================

UPDATE public.action_completions ac
SET label = pa.label
FROM public.program_actions pa
WHERE (ac.label IS NULL OR ac.label = '')
  AND pa.action_key = regexp_replace(ac.action_key, '^(exercise|nutrition|sleep|mental)-', '')
  AND pa.label IS NOT NULL
  AND pa.label <> '';

-- Steps row uses a stable static label.
UPDATE public.action_completions
SET label = 'Daily steps'
WHERE action_key = 'steps' AND (label IS NULL OR label = '');

-- Quick session rows get a clean "Quick session" label since each
-- one has bespoke composition; the actual exercises live in
-- workout_logs and aren't worth backfilling row-by-row.
UPDATE public.action_completions
SET label = 'Quick session'
WHERE action_key LIKE 'exercise-quick-session-%'
  AND (label IS NULL OR label = '');
