-- Unified completion model: action_completions tracks every exercise
-- session through ONE row per (client, action_key, date), with
-- session_type indicating which path the user took.
--
-- Before:
--   - Prescribed completion → action_completions[exercise-X-w0d2-...]
--   - Adapt sheet           → action_completions[same key, with effort]
--   - Quick Session         → action_completions[quick-session-strength-2026-04-29]   ← orphan
--
-- After:
--   - All paths              → action_completions[today's prescribed key]
--   - session_type identifies which path produced the completion
--   - replaced_intent records what the user actually did when they
--     deviated (Quick Session strength on a prescribed leg day → leg
--     day key with session_type='quick', replaced_intent='strength')

ALTER TABLE action_completions
  ADD COLUMN IF NOT EXISTS session_type text,
  ADD COLUMN IF NOT EXISTS replaced_intent text;

-- Backfill from existing data:
-- - quick-session-* keys → session_type='quick'
-- - rows with effort data → session_type='adapted'
-- - rest → session_type='prescribed'
UPDATE action_completions
   SET session_type = CASE
     WHEN action_key LIKE 'quick-session-%' THEN 'quick'
     WHEN actual_duration_seconds IS NOT NULL THEN 'adapted'
     ELSE 'prescribed'
   END
 WHERE session_type IS NULL;

UPDATE action_completions
   SET replaced_intent = split_part(action_key, '-', 3)
 WHERE action_key LIKE 'quick-session-%'
   AND replaced_intent IS NULL;
