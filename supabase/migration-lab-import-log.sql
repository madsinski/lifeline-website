-- =============================================================
-- lab_import_log
--
-- Records every AI lab-report import call:
--   • Used to enforce the 5/day free-tier rate limit
--   • Useful for cost monitoring and abuse detection
-- Stores the MARKER COUNT only — the image bytes never come near
-- this table.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.lab_import_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ok            boolean NOT NULL,
  marker_count  int NOT NULL DEFAULT 0,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lil_client_created
  ON public.lab_import_log (client_id, created_at DESC);

ALTER TABLE public.lab_import_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own history (so the app can show "3 of 5
-- imports left today" if we ever want to).
DROP POLICY IF EXISTS "user reads own log" ON public.lab_import_log;
CREATE POLICY "user reads own log" ON public.lab_import_log
  FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

-- Staff can see the global picture for cost / abuse monitoring.
DROP POLICY IF EXISTS "staff reads all logs" ON public.lab_import_log;
CREATE POLICY "staff reads all logs" ON public.lab_import_log
  FOR SELECT TO authenticated
  USING (is_active_staff());

-- Inserts only happen server-side via the API route using the
-- service-role client, so no INSERT policy is needed.
