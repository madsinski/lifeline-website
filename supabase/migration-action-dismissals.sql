-- =============================================================
-- client_action_dismissals
--
-- "Not for me" — a user has chosen to permanently remove an
-- action from their plan. Different from client_action_substitutions
-- (which swaps one lib_key for another); a dismissal means the user
-- doesn't want this content at all, regardless of which program
-- prescribes it.
--
-- The reason_category is the load-bearing field for admin signal —
-- aggregated in /admin/action-feedback. reason_text is the optional
-- nuance.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.client_action_dismissals (
  client_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lib_key          text NOT NULL,
  reason_category  text NOT NULL,  -- enum (validated at app boundary)
  reason_text      text,           -- optional free-form
  dismissed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, lib_key)
);

CREATE INDEX IF NOT EXISTS idx_cad_client ON public.client_action_dismissals (client_id);
CREATE INDEX IF NOT EXISTS idx_cad_lib_key ON public.client_action_dismissals (lib_key);
CREATE INDEX IF NOT EXISTS idx_cad_reason ON public.client_action_dismissals (reason_category);
CREATE INDEX IF NOT EXISTS idx_cad_dismissed_at ON public.client_action_dismissals (dismissed_at DESC);

ALTER TABLE public.client_action_dismissals ENABLE ROW LEVEL SECURITY;

-- Users manage their own dismissals (RLS pattern matches
-- client_action_substitutions exactly).
DROP POLICY IF EXISTS "user manages own dismissals" ON public.client_action_dismissals;
CREATE POLICY "user manages own dismissals" ON public.client_action_dismissals
  FOR ALL TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Staff can read all dismissals for the admin inbox at
-- /admin/action-feedback. Aggregations + per-action drill-downs read
-- through this policy.
DROP POLICY IF EXISTS "staff read all dismissals" ON public.client_action_dismissals;
CREATE POLICY "staff read all dismissals" ON public.client_action_dismissals
  FOR SELECT TO authenticated
  USING (is_active_staff());
