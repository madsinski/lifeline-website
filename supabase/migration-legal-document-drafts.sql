-- =============================================================
-- legal_document_drafts — admin-edited revisions of legal docs.
--
-- Workflow this supports:
--   1. The lawyer downloads the .txt of a document from
--      /admin/legal/drafts and edits it in his own environment
--      (Word, Pages, etc.) with redlines.
--   2. He emails the revised file back to admin (Mads).
--   3. Mads pastes the revised text into the Edit field on the
--      document's card and saves. A row is inserted here.
--   4. From that point /admin/legal/drafts shows the latest draft
--      from this table instead of the hardcoded source-code text,
--      so the lawyer immediately sees + signs off on what he wrote.
--   5. Once both Mads and the lawyer are satisfied with a draft,
--      the .ts source file is updated to match (version bumped) so
--      that in-app click-through acceptances also use the new text.
--      Until then, the click-through hash continues to use the
--      previous source-code text — which is correct, because no
--      one signed the new text yet.
--
-- Insert-only history. Latest row per (document_key, language) is
-- the one shown. We never delete; we never update.
--
-- Run in the Supabase SQL editor. Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.legal_document_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_key    TEXT NOT NULL,                  -- e.g. 'staff-nda'
  language        TEXT NOT NULL CHECK (language IN ('is','en')),
  proposed_version TEXT NOT NULL,                 -- e.g. 'v1.2 (draft)'
  text            TEXT NOT NULL,
  text_hash       TEXT NOT NULL,                  -- sha256 of text, for traceability
  edited_by       UUID NOT NULL,                  -- staff.id
  edited_by_email TEXT NOT NULL,
  edited_by_name  TEXT,
  source_note     TEXT,                           -- e.g. "Ragnar's redlines, 2026-05-04"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_document_drafts_lookup_idx
  ON public.legal_document_drafts (document_key, language, created_at DESC);

ALTER TABLE public.legal_document_drafts ENABLE ROW LEVEL SECURITY;

-- Read: any active staff (so the lawyer can see his own changes
-- after Mads pastes them in, and so any admin can review history).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Active staff can read legal drafts') THEN
    CREATE POLICY "Active staff can read legal drafts" ON public.legal_document_drafts
      FOR SELECT TO authenticated
      USING (is_active_staff());
  END IF;
END $$;

-- Write: admin only (lawyer reviews, doesn't author).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert legal drafts') THEN
    CREATE POLICY "Admin can insert legal drafts" ON public.legal_document_drafts
      FOR INSERT TO authenticated
      WITH CHECK (is_admin_staff());
  END IF;
END $$;

-- No UPDATE / DELETE policies — table is append-only history.
