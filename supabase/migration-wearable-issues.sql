-- =============================================================
-- wearable_setup_issues
--
-- Inbox for user-submitted troubleshooting reports from the
-- "Stuck?" form on the wearable-setup wizard. Staff triage in
-- /admin/wearable-issues; users can keep using the app.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.wearable_setup_issues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  brand           text NOT NULL,
  step            int NOT NULL,
  message         text NOT NULL,
  device_platform text,
  device_version  text,
  status          text NOT NULL DEFAULT 'open',   -- 'open' | 'in_progress' | 'resolved' | 'dismissed'
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wsi_status_created
  ON public.wearable_setup_issues (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wsi_client
  ON public.wearable_setup_issues (client_id);

ALTER TABLE public.wearable_setup_issues ENABLE ROW LEVEL SECURITY;

-- Users can INSERT their own row (the API route additionally validates
-- the JWT). They can SELECT their own history if we ever surface it
-- back to them.
DROP POLICY IF EXISTS "users insert own issue" ON public.wearable_setup_issues;
CREATE POLICY "users insert own issue" ON public.wearable_setup_issues
  FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "users read own issues" ON public.wearable_setup_issues;
CREATE POLICY "users read own issues" ON public.wearable_setup_issues
  FOR SELECT USING (auth.uid() = client_id);

-- Staff have full access (read + update). Use the SECURITY DEFINER
-- helper instead of inlining a staff EXISTS — the inline form would
-- recurse through staff's own RLS if a self-referencing policy is
-- ever added there. See migration-fix-staff-rls-recursion.sql.
DROP POLICY IF EXISTS "staff manage issues" ON public.wearable_setup_issues;
CREATE POLICY "staff manage issues" ON public.wearable_setup_issues
  FOR ALL TO authenticated
  USING (is_active_staff())
  WITH CHECK (is_active_staff());
