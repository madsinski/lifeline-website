-- Substitutions are recorded, visible and used (2026-10-16).
--
-- client_session_completions already keeps what was prescribed beside what
-- was done (prescribed_action_key / completed_action_key). Two additive
-- columns so a "Gera annað" can be told from a done session, and so the
-- session it replaced can be named later without regenerating the programme:
--
--   substituted       true when the participant did something else instead
--   prescribed_label  the prescribed session's title at the time ("Styrkur A")
--
-- Additive only: the RN app (fhir-health-dashboard) reads and writes this
-- table too and ignores columns it does not know. Idempotent.
-- Read by: src/lib/hc/activity-server.ts, src/app/api/vinnustod/queue/route.ts

ALTER TABLE public.client_session_completions
  ADD COLUMN IF NOT EXISTS substituted boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_session_completions
  ADD COLUMN IF NOT EXISTS prescribed_label text;

-- The queue's "keeps swapping the same session" signal: substituted rows in
-- the last fortnight, per client.
CREATE INDEX IF NOT EXISTS csc_substituted_recent_idx
  ON public.client_session_completions (completed_at DESC, client_id)
  WHERE substituted;

-- Backfill: the web's "Gera annað" used to insert duration NULL and a fixed
-- RPE 5 (a placeholder, never asked). Mark those as substitutions and drop
-- the invented effort. A real workout always carries a duration.
UPDATE public.client_session_completions
   SET substituted = true, intensity_rpe = NULL
 WHERE substituted = false
   AND duration_min IS NULL
   AND intensity_rpe = 5
   AND prescribed_action_key IS NOT NULL
   AND completed_action_key IS DISTINCT FROM prescribed_action_key;
