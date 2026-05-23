-- =============================================================
-- get_my_staff_profile()
--
-- SECURITY DEFINER companion to is_admin_staff / is_active_staff so
-- the frontend can read the current user's staff role + permissions
-- without depending on RLS on the staff table. Same email-match
-- pattern as migration-staff-helpers-email-match.sql: works for
-- both id-aligned staff and invited staff (where staff.id !=
-- auth.uid()).
--
-- Without this, useStaffGuard's raw `select role, permissions from
-- staff where email = user.email` returned nothing for invited
-- admins (Mads logged in as mads@lifelinehealth.is sees "Admin
-- access required" everywhere) because the staff table's row-level
-- security uses id-match, which never lines up for invited rows.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_my_staff_profile()
RETURNS TABLE (
  role text,
  permissions text[],
  active boolean,
  email text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT s.role, s.permissions, s.active, s.email
  FROM public.staff s
  JOIN auth.users u ON u.email = s.email
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_staff_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_staff_profile() TO authenticated;
