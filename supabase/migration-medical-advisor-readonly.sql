-- =============================================================
-- Re-scope medical_advisor: read everything in admin, write
-- only the survey approval workflow.
--
-- Previously (in migration-feedback-surveys.sql) the medical
-- advisor was isolated like the lawyer — explicit `AND NOT
-- is_active_medical_advisor()` filters on every clinical SELECT
-- and UPDATE policy.
--
-- New scope: medical_advisor can read every operational table
-- (clients, programs, subscriptions, conversations, messages,
-- health records, etc.) so they have the full context for
-- interpreting survey responses. They remain blocked from any
-- write — UPDATE/INSERT/DELETE policies still carry the
-- `AND NOT is_active_medical_advisor()` clause.
--
-- This migration just RELAXES the SELECT side; it does not
-- change any write-side policies. Survey-related access is
-- unchanged (already read-anywhere on approved surveys, write
-- limited via the API + status-transition matrix).
--
-- Run in the Supabase SQL editor. Idempotent.
-- =============================================================

-- ─── 1. Drop the SELECT blockers on clinical tables ─────────────
-- After: any active staff (except lawyer) can SELECT. medical_advisor
-- is active staff and not a lawyer → granted.

-- clients
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;
CREATE POLICY "Staff can view all clients" ON public.clients
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer());

-- client_programs
DROP POLICY IF EXISTS "Staff can view client programs" ON public.client_programs;
CREATE POLICY "Staff can view client programs" ON public.client_programs
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer());

-- subscriptions
DROP POLICY IF EXISTS "Staff can view subscriptions" ON public.subscriptions;
CREATE POLICY "Staff can view subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer());

-- action_completions
DROP POLICY IF EXISTS "Staff can view action completions" ON public.action_completions;
CREATE POLICY "Staff can view action completions" ON public.action_completions
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer());

-- health_records
DROP POLICY IF EXISTS "Staff can view health records" ON public.health_records;
CREATE POLICY "Staff can view health records" ON public.health_records
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer());


-- ─── 2. Keep WRITE policies as-is (medical_advisor stays blocked) ──
-- These are intentionally not modified. The blockers on the
-- following policies remain in place:
--   "Staff can update clients"
--   "Staff can manage client programs"
--   "Staff can manage subscriptions"
-- → medical_advisor cannot UPDATE/INSERT/DELETE on these tables.


-- ─── 3. Admin-only tables: extend SELECT to medical_advisor ────────

-- health_audit_log: was admin-only. Allow medical_advisor read so
-- they see the same operational view as admin (no separate
-- "secret" sub-section).
DROP POLICY IF EXISTS "Admins can read health audit log" ON public.health_audit_log;
CREATE POLICY "Admins can read health audit log" ON public.health_audit_log
  FOR SELECT TO authenticated
  USING ((is_admin_staff() OR is_active_medical_advisor()) AND NOT is_active_lawyer());

-- dsr_requests: split into a read-everyone-allowed-to-read policy
-- + a write-admin-only policy.
DROP POLICY IF EXISTS "Admins can manage dsr requests" ON public.dsr_requests;
CREATE POLICY "Admins can manage dsr requests" ON public.dsr_requests
  FOR ALL TO authenticated
  USING (is_admin_staff() AND NOT is_active_lawyer())
  WITH CHECK (is_admin_staff() AND NOT is_active_lawyer());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads dsr requests') THEN
    CREATE POLICY "Medical advisor reads dsr requests" ON public.dsr_requests
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;


-- ─── 4. Conversations + messages: add medical_advisor SELECT ──────
-- These tables are gated by is_active_coach_or_clinician() OR
-- is_admin_staff(); medical_advisor is neither. Add a dedicated
-- read-only policy so they can see the conversation thread for
-- context when reviewing survey responses.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads conversations') THEN
    CREATE POLICY "Medical advisor reads conversations" ON public.conversations
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads messages') THEN
    CREATE POLICY "Medical advisor reads messages" ON public.messages
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;


-- ─── 5. Other tables that the admin layout reads from ─────────────
-- These tend to use is_active_staff() / is_admin_staff() already and
-- so already permit medical_advisor on the read path. Adding
-- explicit SELECT policies anyway makes the intent visible and
-- guards against future changes that re-introduce a blocker.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads staff') THEN
    CREATE POLICY "Medical advisor reads staff" ON public.staff
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;

-- weight_log + body_composition_events + macro_targets: clinical
-- self-tracking. Surveys may reference outcome perceptions; the
-- medical advisor cross-references against the actual numbers.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads weight log')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='weight_log') THEN
    CREATE POLICY "Medical advisor reads weight log" ON public.weight_log
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads body composition')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='body_composition_events') THEN
    CREATE POLICY "Medical advisor reads body composition" ON public.body_composition_events
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads beta feedback')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='beta_feedback') THEN
    CREATE POLICY "Medical advisor reads beta feedback" ON public.beta_feedback
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;
