-- legal_review_links: no-login tokenised links for external counsel to
-- review, edit (redline) and approve legal documents without a Supabase
-- account. The token is the secret in the URL (/legal-review/<token>);
-- treat it like a password. It only touches legal document text (no PII).
-- Every edit/approval is attributed to a typed name+email plus IP, time
-- and a sha256 of the text. Idempotent. ASCII-only, no DO/$$ blocks and
-- one statement per line -- the Supabase SQL editor mishandles both.

CREATE TABLE IF NOT EXISTS public.legal_review_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS legal_review_links_token_idx ON public.legal_review_links (token);

ALTER TABLE public.legal_review_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read review links" ON public.legal_review_links;
CREATE POLICY "Admin can read review links" ON public.legal_review_links FOR SELECT TO authenticated USING (is_admin_staff());

-- External reviewers on legal_review_signoffs (no staff.id).
ALTER TABLE public.legal_review_signoffs ALTER COLUMN reviewer_id DROP NOT NULL;
ALTER TABLE public.legal_review_signoffs ADD COLUMN IF NOT EXISTS reviewer_email TEXT;
ALTER TABLE public.legal_review_signoffs ADD COLUMN IF NOT EXISTS reviewer_via TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE public.legal_review_signoffs ADD COLUMN IF NOT EXISTS review_link_id UUID REFERENCES public.legal_review_links(id);
ALTER TABLE public.legal_review_signoffs DROP CONSTRAINT IF EXISTS legal_review_signoffs_reviewer_via_chk;
ALTER TABLE public.legal_review_signoffs ADD CONSTRAINT legal_review_signoffs_reviewer_via_chk CHECK (reviewer_via IN ('staff','link'));
ALTER TABLE public.legal_review_signoffs DROP CONSTRAINT IF EXISTS legal_review_signoffs_attribution_chk;
ALTER TABLE public.legal_review_signoffs ADD CONSTRAINT legal_review_signoffs_attribution_chk CHECK (reviewer_id IS NOT NULL OR reviewer_email IS NOT NULL);

-- External editors on legal_document_drafts (no staff.id).
ALTER TABLE public.legal_document_drafts ALTER COLUMN edited_by DROP NOT NULL;
ALTER TABLE public.legal_document_drafts ADD COLUMN IF NOT EXISTS edited_via TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE public.legal_document_drafts ADD COLUMN IF NOT EXISTS review_link_id UUID REFERENCES public.legal_review_links(id);
ALTER TABLE public.legal_document_drafts DROP CONSTRAINT IF EXISTS legal_document_drafts_edited_via_chk;
ALTER TABLE public.legal_document_drafts ADD CONSTRAINT legal_document_drafts_edited_via_chk CHECK (edited_via IN ('staff','link'));
