-- =============================================================
-- Swap the "staff manage issues" policy from an inline staff
-- EXISTS to the SECURITY DEFINER helper. The inline form would
-- recurse through staff's own RLS if anyone ever adds a self-
-- referencing policy there. is_active_staff() bypasses that.
-- =============================================================

DROP POLICY IF EXISTS "staff manage issues" ON public.wearable_setup_issues;
CREATE POLICY "staff manage issues" ON public.wearable_setup_issues
  FOR ALL TO authenticated
  USING (is_active_staff())
  WITH CHECK (is_active_staff());
