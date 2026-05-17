-- =============================================================
-- program_actions.label ← action_library.label backfill
--
-- The recommend-programs prompt now includes a sample_actions line
-- per program, built from program_actions.label. Rows where label
-- is NULL/empty contribute nothing to the prompt — the model goes
-- back to name-only guessing.
--
-- This migration fills program_actions.label from action_library.label
-- (joined by lib_key) for any row that is missing it. Idempotent.
-- Rows without a lib_key (legacy / custom programs) are untouched —
-- those need to be hand-authored anyway.
-- =============================================================

UPDATE public.program_actions pa
SET    label = al.label
FROM   public.action_library al
WHERE  pa.lib_key IS NOT NULL
  AND  pa.lib_key = al.lib_key
  AND  (pa.label IS NULL OR pa.label = '')
  AND  al.label IS NOT NULL
  AND  al.label <> '';

-- Audit: how many program_actions still have no label after the backfill?
-- A high count means the lib_key fan-out is incomplete and the AI
-- catalog will be sparse for those programs.
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM public.program_actions
  WHERE label IS NULL OR label = '';
  RAISE NOTICE 'program_actions rows still missing label after backfill: %', remaining;
END $$;
