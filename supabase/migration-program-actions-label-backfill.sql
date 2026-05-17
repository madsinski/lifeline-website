-- =============================================================
-- program_actions.label ← action_library.label backfill
--
-- The recommend-programs prompt now includes a sample_actions line
-- per program, built from program_actions.label. Rows where label
-- is NULL/empty contribute nothing to the prompt — the model goes
-- back to name-only guessing.
--
-- Fills program_actions.label from action_library.label via the
-- library_action_id FK (UUID → action_library.id) for any row that
-- is missing a label. program_actions identifies its library row by
-- library_action_id, not by lib_key directly — lib_key lives on
-- action_library and surfaces to the read path through the
-- program_actions_resolved view.
--
-- Rows without library_action_id (legacy / custom programs) are
-- untouched; those need hand-authored labels anyway.
-- =============================================================

UPDATE public.program_actions pa
SET    label = al.label
FROM   public.action_library al
WHERE  pa.library_action_id IS NOT NULL
  AND  pa.library_action_id = al.id
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
