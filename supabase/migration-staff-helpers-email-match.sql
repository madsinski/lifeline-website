-- =============================================================
-- Staff helpers: switch from staff.id = auth.uid() to email-based
-- matching via auth.users join.
--
-- Why: when invited team members go through the existing invite-team
-- edge function, their auth.users.id is generated independently of
-- their staff.id. The two never match. RLS helpers that use
-- "staff.id = auth.uid()" silently return false → invited staff lose
-- access to everything that depends on those helpers.
--
-- Fix: helpers now do `JOIN auth.users u ON u.email = s.email WHERE
-- u.id = auth.uid()`. Works for both ID-aligned (the right way) and
-- email-only-matching (existing reality) staff.
--
-- Also fixes the audit trigger function that was looking up the actor
-- by id and getting nothing for invited staff.
--
-- Run in Supabase SQL editor. Idempotent.
-- =============================================================

CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    JOIN auth.users u ON u.email = s.email
    WHERE u.id = auth.uid() AND s.active = true
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    JOIN auth.users u ON u.email = s.email
    WHERE u.id = auth.uid() AND s.active = true AND s.role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_lawyer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    JOIN auth.users u ON u.email = s.email
    WHERE u.id = auth.uid() AND s.active = true AND s.role = 'lawyer'
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_lawyer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_lawyer() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_clinician()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    JOIN auth.users u ON u.email = s.email
    WHERE u.id = auth.uid() AND s.active = true
      AND s.role IN ('doctor','nurse','psychologist')
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_clinician() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_clinician() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_psychologist()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    JOIN auth.users u ON u.email = s.email
    WHERE u.id = auth.uid() AND s.active = true AND s.role = 'psychologist'
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_psychologist() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_psychologist() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_coach_or_clinician()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    JOIN auth.users u ON u.email = s.email
    WHERE u.id = auth.uid() AND s.active = true
      AND s.role IN ('coach','doctor','nurse','psychologist')
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_coach_or_clinician() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_coach_or_clinician() TO authenticated;

-- Audit trigger function: same fix — look up actor by email, not id.
CREATE OR REPLACE FUNCTION public.tg_audit_health_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_email TEXT;
  v_email TEXT;
  v_role  TEXT;
  v_row_id TEXT;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor LIMIT 1;
    IF v_actor_email IS NOT NULL THEN
      SELECT email, role INTO v_email, v_role FROM public.staff WHERE email = v_actor_email LIMIT 1;
      IF v_email IS NULL THEN
        SELECT email INTO v_email FROM public.clients WHERE id = v_actor LIMIT 1;
        v_role := 'client';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_row_id := COALESCE((OLD.id)::TEXT, '');
  ELSE
    v_row_id := COALESCE((NEW.id)::TEXT, '');
  END IF;

  INSERT INTO public.health_audit_log (actor_id, actor_email, actor_role, action, table_name, row_id, metadata)
  VALUES (v_actor, v_email, v_role, TG_OP, TG_TABLE_NAME, v_row_id,
          jsonb_build_object('op', TG_OP));

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Same fix for log_health_access (manual SELECT-side audit).
CREATE OR REPLACE FUNCTION public.log_health_access(
  p_action TEXT,
  p_table TEXT,
  p_row_id TEXT,
  p_metadata JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_email TEXT;
  v_email TEXT;
  v_role  TEXT;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor LIMIT 1;
    IF v_actor_email IS NOT NULL THEN
      SELECT email, role INTO v_email, v_role FROM public.staff WHERE email = v_actor_email LIMIT 1;
      IF v_email IS NULL THEN
        SELECT email INTO v_email FROM public.clients WHERE id = v_actor LIMIT 1;
        v_role := 'client';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.health_audit_log (actor_id, actor_email, actor_role, action, table_name, row_id, metadata)
  VALUES (v_actor, v_email, v_role, p_action, p_table, p_row_id, p_metadata);
END;
$$;
REVOKE ALL ON FUNCTION public.log_health_access(TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_health_access(TEXT,TEXT,TEXT,JSONB) TO authenticated;
