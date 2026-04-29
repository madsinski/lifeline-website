-- Fix: RLS infinite recursion on staff + clients tables.
--
-- The original "Active staff can view team" / "Admin can manage staff"
-- policies on staff used:
--   USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid()))
-- This is self-referential — evaluating the policy queries staff, which
-- evaluates the same policy, → infinite recursion error.
--
-- Same recursion existed on clients via "Staff can view all clients" /
-- "Staff can update clients" — they referenced staff and inherited the loop.
--
-- User-visible symptom: every clients SELECT failed with
--   "infinite recursion detected in policy for relation 'staff'"
-- which surfaced as "always onboarding screen" because the login flow
-- couldn't read clients.onboarding_complete and defaulted to redirecting.
--
-- Fix: swap recursive EXISTS subqueries for the SECURITY DEFINER helper
-- functions is_active_staff() and is_admin_staff() that already exist.
-- Those run with elevated privilege and bypass RLS internally, breaking
-- the loop.

DROP POLICY IF EXISTS "Active staff can view team" ON public.staff;
DROP POLICY IF EXISTS "Admin can manage staff" ON public.staff;

CREATE POLICY "Active staff can view team" ON public.staff
  FOR SELECT TO authenticated
  USING (is_active_staff());

CREATE POLICY "Admin can manage staff" ON public.staff
  FOR ALL TO authenticated
  USING (is_admin_staff())
  WITH CHECK (is_admin_staff());

DROP POLICY IF EXISTS "Staff can update clients" ON public.clients;
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;

CREATE POLICY "Staff can update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (is_active_staff())
  WITH CHECK (is_active_staff());

CREATE POLICY "Staff can view all clients" ON public.clients
  FOR SELECT TO authenticated
  USING (is_active_staff());
