-- =============================================================
-- legal_review_links — no-login, tokenised links for external
-- counsel to review, edit (redline) and approve legal documents
-- WITHOUT a Supabase account.
--
-- Why this exists:
--   The existing flow required the lawyer to hold a role='lawyer'
--   staff account and log in (see migration-lawyer-role.sql). For
--   ad-hoc external review we instead mint a long random token, put
--   it in a URL, and let the holder act at /legal-review/<token>.
--   The lawyer identifies himself by typing his name + email; every
--   edit and approval is attributed to that name/email plus the
--   captured IP, user-agent, timestamp and sha256 of the text he saw.
--
-- Security model:
--   - The token IS the secret. It is long + random + revocable + can
--     expire. Treat the link like a password: anyone with it can edit
--     drafts and record approvals on LEGAL DOCUMENT TEXT (no patient
--     data, no PII — these documents contain none).
--   - All reads/writes for the link flow go through the API using the
--     service-role client, which validates the token. The table is
--     NOT readable by anon/authenticated directly (RLS below).
--   - Approvals are non-repudiation evidence, not an auth boundary:
--     the typed identity is asserted, and corroborated by IP/UA/time.
--
-- Run in the Supabase SQL editor. Idempotent.
-- =============================================================

-- ─── 1. legal_review_links ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legal_review_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token        TEXT NOT NULL UNIQUE,           -- the secret in the URL (base64url, 32 bytes)
  label        TEXT,                           -- e.g. "Ragnar @ Fosslögmenn — July review"
  active       BOOLEAN NOT NULL DEFAULT true,
  expires_at   TIMESTAMPTZ,                    -- NULL = no expiry
  created_by   UUID,                           -- staff.id of the admin who minted it
  created_by_email TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ                      -- touched on each successful token use
);

CREATE INDEX IF NOT EXISTS legal_review_links_token_idx
  ON public.legal_review_links (token);

ALTER TABLE public.legal_review_links ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated direct access — the API (service role) is the
-- only path for the token flow. Admins manage links through the API too,
-- but we add an admin read policy so the management UI can list them.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read review links') THEN
    CREATE POLICY "Admin can read review links" ON public.legal_review_links
      FOR SELECT TO authenticated
      USING (is_admin_staff());
  END IF;
END $$;

-- ─── 2. Allow EXTERNAL reviewers on legal_review_signoffs ────
-- The existing table (migration-lawyer-role.sql) assumed a staff
-- lawyer: reviewer_id UUID NOT NULL. External counsel via a link has
-- no staff.id, so relax that and record the asserted identity instead.
ALTER TABLE public.legal_review_signoffs
  ALTER COLUMN reviewer_id DROP NOT NULL;
ALTER TABLE public.legal_review_signoffs
  ADD COLUMN IF NOT EXISTS reviewer_email  TEXT;
ALTER TABLE public.legal_review_signoffs
  ADD COLUMN IF NOT EXISTS reviewer_via    TEXT NOT NULL DEFAULT 'staff'
    CHECK (reviewer_via IN ('staff','link'));
ALTER TABLE public.legal_review_signoffs
  ADD COLUMN IF NOT EXISTS review_link_id  UUID REFERENCES public.legal_review_links(id);

-- Integrity: a row must be attributable to EITHER a staff reviewer_id
-- OR (for link reviews) a reviewer_email.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'legal_review_signoffs_attribution_chk'
  ) THEN
    ALTER TABLE public.legal_review_signoffs
      ADD CONSTRAINT legal_review_signoffs_attribution_chk
      CHECK (reviewer_id IS NOT NULL OR reviewer_email IS NOT NULL);
  END IF;
END $$;

-- ─── 3. Allow EXTERNAL editors on legal_document_drafts ─────
-- Same relaxation for redlines saved via a link. edited_by_email /
-- edited_by_name already exist and are the asserted identity.
ALTER TABLE public.legal_document_drafts
  ALTER COLUMN edited_by DROP NOT NULL;
ALTER TABLE public.legal_document_drafts
  ADD COLUMN IF NOT EXISTS edited_via     TEXT NOT NULL DEFAULT 'staff'
    CHECK (edited_via IN ('staff','link'));
ALTER TABLE public.legal_document_drafts
  ADD COLUMN IF NOT EXISTS review_link_id UUID REFERENCES public.legal_review_links(id);

-- No new client-facing RLS needed: both tables are written only by the
-- API via the service-role client, which bypasses RLS. Existing staff
-- read policies are unchanged.
