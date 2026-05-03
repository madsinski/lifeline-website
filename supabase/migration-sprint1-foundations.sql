-- =============================================================
-- Sprint 1 foundations: health_audit_log, client_consents,
-- staff_access_reviews, and specialty-based access helpers.
--
-- Bundled because they share the same SECURITY DEFINER helper pattern
-- (is_active_staff, is_admin_staff already in production from
-- migration-fix-staff-rls-recursion.sql) and because their RLS policies
-- cross-reference each other.
--
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
-- =============================================================

-- ─── 1.4  Audit log for health-data access ───────────────────
-- Captures every write to health-sensitive tables, plus a manual
-- channel for application-layer SELECT auditing (Postgres can't
-- trigger on SELECT).
--
-- Retention: 6 years per Lög 55/2009 §13. Cleanup is manual until
-- a retention cron is added.

CREATE TABLE IF NOT EXISTS public.health_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  actor_id     UUID,
  actor_email  TEXT,
  actor_role   TEXT,
  action       TEXT NOT NULL CHECK (action IN ('SELECT','INSERT','UPDATE','DELETE')),
  table_name   TEXT NOT NULL,
  row_id       TEXT,
  request_id   TEXT,
  metadata     JSONB,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_audit_log_table_row_idx ON public.health_audit_log (table_name, row_id);
CREATE INDEX IF NOT EXISTS health_audit_log_actor_idx ON public.health_audit_log (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS health_audit_log_occurred_idx ON public.health_audit_log (occurred_at DESC);

ALTER TABLE public.health_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read audit log') THEN
    CREATE POLICY "Admins can read audit log" ON public.health_audit_log
      FOR SELECT TO authenticated
      USING (is_admin_staff());
  END IF;
END $$;

-- No INSERT/UPDATE/DELETE policy — health_audit_log is written only by
-- triggers and the SECURITY DEFINER helpers below. Callers cannot
-- mutate it directly.

-- Helper: write a single health_audit_log row. SECURITY DEFINER so ordinary
-- callers can record their own access without needing INSERT
-- privilege on health_audit_log.
CREATE OR REPLACE FUNCTION public.log_health_access(
  p_action TEXT,
  p_table TEXT,
  p_row_id TEXT,
  p_metadata JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_email TEXT;
  v_role  TEXT;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email, role INTO v_email, v_role
    FROM public.staff WHERE id = v_actor LIMIT 1;
    IF v_email IS NULL THEN
      SELECT email INTO v_email FROM public.clients WHERE id = v_actor LIMIT 1;
      v_role := 'client';
    END IF;
  END IF;

  INSERT INTO public.health_audit_log (actor_id, actor_email, actor_role, action, table_name, row_id, metadata)
  VALUES (v_actor, v_email, v_role, p_action, p_table, p_row_id, p_metadata);
END;
$$;
REVOKE ALL ON FUNCTION public.log_health_access(TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_health_access(TEXT,TEXT,TEXT,JSONB) TO authenticated;

-- Trigger function for write-side auditing (INSERT/UPDATE/DELETE).
CREATE OR REPLACE FUNCTION public.tg_audit_health_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_email TEXT;
  v_role  TEXT;
  v_row_id TEXT;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email, role INTO v_email, v_role FROM public.staff WHERE id = v_actor LIMIT 1;
    IF v_email IS NULL THEN
      SELECT email INTO v_email FROM public.clients WHERE id = v_actor LIMIT 1;
      v_role := 'client';
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

-- Attach triggers. Use IF NOT EXISTS via DO blocks.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_clients_writes') THEN
    CREATE TRIGGER audit_clients_writes
      AFTER INSERT OR UPDATE OR DELETE ON public.clients
      FOR EACH ROW EXECUTE FUNCTION public.tg_audit_health_writes();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_messages_writes') THEN
    CREATE TRIGGER audit_messages_writes
      AFTER INSERT OR UPDATE OR DELETE ON public.messages
      FOR EACH ROW EXECUTE FUNCTION public.tg_audit_health_writes();
  END IF;
END $$;

-- weight_log + body_comp_events may not yet exist as Postgres tables
-- in some environments — guard with IF.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'weight_log')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_weight_log_writes') THEN
    CREATE TRIGGER audit_weight_log_writes
      AFTER INSERT OR UPDATE OR DELETE ON public.weight_log
      FOR EACH ROW EXECUTE FUNCTION public.tg_audit_health_writes();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'body_comp_events')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_body_comp_events_writes') THEN
    CREATE TRIGGER audit_body_comp_events_writes
      AFTER INSERT OR UPDATE OR DELETE ON public.body_comp_events
      FOR EACH ROW EXECUTE FUNCTION public.tg_audit_health_writes();
  END IF;
END $$;

-- ─── 1.3  client_consents table ──────────────────────────────
-- Versioned, hashed consent records. Same crypto-evidence pattern as
-- staff_agreement_acceptances. Used initially for the Biody-import
-- opt-in (Q1) but generic enough for any future client consent.

CREATE TABLE IF NOT EXISTS public.client_consents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL,
  consent_key     TEXT NOT NULL,           -- e.g. 'biody-import-v1'
  consent_version TEXT NOT NULL,
  text_hash       TEXT NOT NULL,           -- sha256 of the consent text
  granted         BOOLEAN NOT NULL DEFAULT true,
  ip              TEXT,
  user_agent      TEXT,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  metadata        JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS client_consents_unique_active
  ON public.client_consents (client_id, consent_key)
  WHERE revoked_at IS NULL;

ALTER TABLE public.client_consents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own consents') THEN
    CREATE POLICY "Clients can view own consents" ON public.client_consents
      FOR SELECT TO authenticated
      USING (client_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can insert own consents') THEN
    CREATE POLICY "Clients can insert own consents" ON public.client_consents
      FOR INSERT TO authenticated
      WITH CHECK (client_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can update own consents') THEN
    CREATE POLICY "Clients can update own consents" ON public.client_consents
      FOR UPDATE TO authenticated
      USING (client_id = auth.uid())
      WITH CHECK (client_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view consents') THEN
    CREATE POLICY "Admins can view consents" ON public.client_consents
      FOR SELECT TO authenticated
      USING (is_admin_staff());
  END IF;
END $$;

-- ─── 2.4  Staff access review log ────────────────────────────
-- Quarterly review record. Each row: who reviewed which staff
-- member, what was decided (kept / role changed / deactivated /
-- permissions adjusted), and when. Drives a Persónuvernd-friendly
-- audit trail of "we revisit who has access to health data every
-- 90 days".

CREATE TABLE IF NOT EXISTS public.staff_access_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewed_staff_id UUID NOT NULL,
  reviewer_id       UUID NOT NULL,
  decision          TEXT NOT NULL CHECK (decision IN ('keep','adjust_permissions','change_role','deactivate')),
  notes             TEXT,
  before_role       TEXT,
  after_role        TEXT,
  before_permissions TEXT[],
  after_permissions  TEXT[],
  reviewed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_access_reviews_staff_idx
  ON public.staff_access_reviews (reviewed_staff_id, reviewed_at DESC);

ALTER TABLE public.staff_access_reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage access reviews') THEN
    CREATE POLICY "Admins can manage access reviews" ON public.staff_access_reviews
      FOR ALL TO authenticated
      USING (is_admin_staff())
      WITH CHECK (is_admin_staff());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view their own reviews') THEN
    CREATE POLICY "Staff can view their own reviews" ON public.staff_access_reviews
      FOR SELECT TO authenticated
      USING (reviewed_staff_id = auth.uid());
  END IF;
END $$;

-- ─── 1.5  Specialty-based access helpers ─────────────────────
-- Helpers used by RLS policies that need to distinguish between
-- coaches, clinicians, and admins. SECURITY DEFINER + EXISTS-on-staff
-- so they don't recurse on the staff table when used inside policies.

CREATE OR REPLACE FUNCTION public.is_active_clinician()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = auth.uid()
      AND active = true
      AND role IN ('doctor','nurse','psychologist')
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_clinician() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_clinician() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_psychologist()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = auth.uid() AND active = true AND role = 'psychologist'
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_psychologist() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_psychologist() TO authenticated;

-- Convenience: coach + clinician (i.e. anyone who legitimately needs
-- access to health-coaching conversations).
CREATE OR REPLACE FUNCTION public.is_active_coach_or_clinician()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = auth.uid()
      AND active = true
      AND role IN ('coach','doctor','nurse','psychologist')
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_coach_or_clinician() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_coach_or_clinician() TO authenticated;

-- Tighten messaging-staff policies to exclude pure admins from reading
-- coach↔client conversation content. Admins still manage scheduling +
-- billing; clinical communications are clinician/coach scope only.
-- Messaging access: coaches, clinicians, AND admins (admins are
-- effectively superusers in this app — they can see everything for
-- support and incident response). Pure non-admin coach/clinician roles
-- are still scoped via is_active_coach_or_clinician().
DROP POLICY IF EXISTS "Staff can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Coach or clinician can view conversations" ON public.conversations;
CREATE POLICY "Messaging staff can view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (is_active_coach_or_clinician() OR is_admin_staff());

DROP POLICY IF EXISTS "Staff can manage conversations" ON public.conversations;
DROP POLICY IF EXISTS "Coach or clinician can manage conversations" ON public.conversations;
CREATE POLICY "Messaging staff can manage conversations" ON public.conversations
  FOR ALL TO authenticated
  USING (is_active_coach_or_clinician() OR is_admin_staff())
  WITH CHECK (is_active_coach_or_clinician() OR is_admin_staff());

DROP POLICY IF EXISTS "Staff can view all messages" ON public.messages;
DROP POLICY IF EXISTS "Coach or clinician can view messages" ON public.messages;
CREATE POLICY "Messaging staff can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (is_active_coach_or_clinician() OR is_admin_staff());

DROP POLICY IF EXISTS "Staff can send messages" ON public.messages;
DROP POLICY IF EXISTS "Coach or clinician can send messages" ON public.messages;
CREATE POLICY "Messaging staff can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (is_active_coach_or_clinician() OR is_admin_staff());

-- Note: client-side policies from migration-fix-blanket-rls.sql remain
-- in place and are unchanged — clients still see/send their own messages.
