-- =============================================================
-- Employment contracts (ráðningarsamningar).
--
-- Phase 2 of the job-description workflow. Once a job description's
-- "agreed" column is settled, an admin generates an employment
-- contract from those agreed terms and sends it to the candidate to
-- sign. Signing follows the same simple-electronic-signature pattern
-- as the B2B service agreement: canonical text → SHA-256 hash →
-- signature record (name/kennitala/IP/UA/timestamp) → server-rendered
-- PDF → private storage.
--
-- A token (unguessable) gates the public signing page
-- /radningarsamningur/[token]; no login is required of the candidate.
--
-- Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.employment_contracts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_description_id    text REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
  token                 text NOT NULL UNIQUE,           -- public signing link gate

  -- Snapshot of the agreed terms at send time, so later edits to the
  -- job description never change what the candidate was sent.
  candidate_name        text NOT NULL,
  candidate_email       text NOT NULL,
  agreed_terms          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- salary/equity/vesting/start/etc.
  contract_version      text NOT NULL,
  terms_hash            text NOT NULL,                  -- sha256 of canonical IS text at send

  status                text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','signed','void')),

  -- Signature audit (populated on sign).
  signatory_name        text,
  signatory_kennitala   text,
  signatory_ip          text,
  signatory_user_agent  text,
  signed_at             timestamptz,

  -- Optional company countersignature.
  company_signatory_name text,
  company_signed_at      timestamptz,

  -- Signed PDF.
  pdf_storage_path      text,
  pdf_sha256            text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_contracts_jobdesc ON public.employment_contracts (job_description_id);
CREATE INDEX IF NOT EXISTS idx_emp_contracts_status  ON public.employment_contracts (status);

ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;

-- All access flows through the API (service role): admin endpoints for
-- create/list, and the token-gated public sign endpoint. Block direct
-- client access.
DROP POLICY IF EXISTS "Block client access" ON public.employment_contracts;
CREATE POLICY "Block client access"
ON public.employment_contracts
FOR ALL USING (false) WITH CHECK (false);

-- Private storage bucket for the signed contract PDFs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('employment-contracts', 'employment-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Only admin staff can read/list/manage the signed PDFs. The candidate
-- receives their copy by email; they don't read from the bucket
-- directly (no auth user for them).
DROP POLICY IF EXISTS "admin manage employment contracts" ON storage.objects;
CREATE POLICY "admin manage employment contracts" ON storage.objects
  FOR ALL USING (
    bucket_id = 'employment-contracts' AND is_admin_staff()
  ) WITH CHECK (
    bucket_id = 'employment-contracts' AND is_admin_staff()
  );

NOTIFY pgrst, 'reload schema';
