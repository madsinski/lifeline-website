-- =============================================================
-- External counsel ("lawyer") role + legal_review_signoffs.
--
-- Adds a 'lawyer' staff role for external counsel (e.g. Ragnar at
-- fosslögmenn). Lawyers can read + sign off on Lifeline's legal
-- documents but are isolated from clinical data (clients, messages,
-- health_records, biody, audit log).
--
-- Run in the Supabase SQL editor. Idempotent.
-- =============================================================

-- ─── 1. Extend staff role enum to include 'lawyer' ──────────
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff
  ADD CONSTRAINT staff_role_check
  CHECK (role IN ('coach','doctor','nurse','psychologist','admin','lawyer'));

-- ─── 2. is_active_lawyer() helper ────────────────────────────
CREATE OR REPLACE FUNCTION public.is_active_lawyer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = auth.uid() AND active = true AND role = 'lawyer'
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_lawyer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_lawyer() TO authenticated;

-- ─── 3. Isolate lawyer from clinical data ───────────────────
-- The lawyer is "active staff" but must NOT see clients, messages,
-- conversations, health records, body comp, dsr requests, audit log.
-- Update each policy that uses is_active_staff() to also exclude lawyer.
--
-- Pattern: USING (is_active_staff() AND NOT is_active_lawyer())

-- clients
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;
CREATE POLICY "Staff can view all clients" ON public.clients
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer());

DROP POLICY IF EXISTS "Staff can update clients" ON public.clients;
CREATE POLICY "Staff can update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer())
  WITH CHECK (is_active_staff() AND NOT is_active_lawyer());

-- client_programs
DROP POLICY IF EXISTS "Staff can view client programs" ON public.client_programs;
CREATE POLICY "Staff can view client programs" ON public.client_programs
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer());

DROP POLICY IF EXISTS "Staff can manage client programs" ON public.client_programs;
CREATE POLICY "Staff can manage client programs" ON public.client_programs
  FOR ALL TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer())
  WITH CHECK (is_active_staff() AND NOT is_active_lawyer());

-- subscriptions
DROP POLICY IF EXISTS "Staff can view subscriptions" ON public.subscriptions;
CREATE POLICY "Staff can view subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer());

DROP POLICY IF EXISTS "Staff can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Staff can manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer())
  WITH CHECK (is_active_staff() AND NOT is_active_lawyer());

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

-- conversations + messages already use is_active_coach_or_clinician()
-- which excludes lawyer naturally (role IN coach/doctor/nurse/psychologist)
-- and is_admin_staff(). Lawyer is neither, so they're excluded. No change.

-- health_audit_log (admin-only, but tighten anyway)
DROP POLICY IF EXISTS "Admins can read health audit log" ON public.health_audit_log;
CREATE POLICY "Admins can read health audit log" ON public.health_audit_log
  FOR SELECT TO authenticated
  USING (is_admin_staff() AND NOT is_active_lawyer());

-- dsr_requests
DROP POLICY IF EXISTS "Admins can manage dsr requests" ON public.dsr_requests;
CREATE POLICY "Admins can manage dsr requests" ON public.dsr_requests
  FOR ALL TO authenticated
  USING (is_admin_staff() AND NOT is_active_lawyer())
  WITH CHECK (is_admin_staff() AND NOT is_active_lawyer());

-- ─── 4. legal_review_signoffs table ─────────────────────────
-- Per-document review state from external counsel.
-- One row per (document_key, document_version) reviewed.

CREATE TABLE IF NOT EXISTS public.legal_review_signoffs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_key    TEXT NOT NULL,            -- e.g. 'medalia-joint-controller'
  document_version TEXT NOT NULL,           -- e.g. 'v1.1'
  document_title  TEXT NOT NULL,            -- human-readable, captured at sign time
  text_hash       TEXT NOT NULL,            -- sha256 of the document text the lawyer saw
  status          TEXT NOT NULL CHECK (status IN ('pending','under_review','approved','changes_requested','rejected')),
  comments        TEXT,                     -- free-text from the lawyer
  reviewer_id     UUID NOT NULL,            -- staff.id of the lawyer
  reviewer_name   TEXT NOT NULL,            -- snapshotted name
  signed_at       TIMESTAMPTZ,              -- set when status flips to approved
  ip              TEXT,
  user_agent      TEXT,
  pdf_storage_path TEXT,                    -- signed PDF certificate
  pdf_sha256      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_review_signoffs_doc_idx
  ON public.legal_review_signoffs (document_key, document_version, created_at DESC);
CREATE INDEX IF NOT EXISTS legal_review_signoffs_reviewer_idx
  ON public.legal_review_signoffs (reviewer_id, created_at DESC);

ALTER TABLE public.legal_review_signoffs ENABLE ROW LEVEL SECURITY;

-- Lawyer can read + write their own reviews
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lawyer can view own signoffs') THEN
    CREATE POLICY "Lawyer can view own signoffs" ON public.legal_review_signoffs
      FOR SELECT TO authenticated
      USING (reviewer_id = auth.uid() AND is_active_lawyer());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lawyer can insert own signoffs') THEN
    CREATE POLICY "Lawyer can insert own signoffs" ON public.legal_review_signoffs
      FOR INSERT TO authenticated
      WITH CHECK (reviewer_id = auth.uid() AND is_active_lawyer());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lawyer can update own signoffs') THEN
    CREATE POLICY "Lawyer can update own signoffs" ON public.legal_review_signoffs
      FOR UPDATE TO authenticated
      USING (reviewer_id = auth.uid() AND is_active_lawyer())
      WITH CHECK (reviewer_id = auth.uid() AND is_active_lawyer());
  END IF;
END $$;

-- Admin can read + manage all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage signoffs') THEN
    CREATE POLICY "Admin can manage signoffs" ON public.legal_review_signoffs
      FOR ALL TO authenticated
      USING (is_admin_staff())
      WITH CHECK (is_admin_staff());
  END IF;
END $$;

-- Storage bucket for signed PDF certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-signoff-pdfs', 'legal-signoff-pdfs', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lawyer can read own signoff pdfs') THEN
    CREATE POLICY "Lawyer can read own signoff pdfs" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'legal-signoff-pdfs'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND is_active_lawyer()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read signoff pdfs') THEN
    CREATE POLICY "Admin can read signoff pdfs" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'legal-signoff-pdfs'
        AND is_admin_staff()
      );
  END IF;
END $$;
