-- =============================================================
-- client_consents: add PDF storage path + sha; create the storage
-- bucket for signed consent PDFs.
--
-- Run in the Supabase SQL editor. Idempotent.
-- =============================================================

ALTER TABLE public.client_consents
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_sha256 TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-consent-pdfs', 'client-consent-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket RLS: clients can read their own folder; admins can read all.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can read own consent pdfs') THEN
    CREATE POLICY "Clients can read own consent pdfs" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'client-consent-pdfs'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read consent pdfs') THEN
    CREATE POLICY "Admins can read consent pdfs" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'client-consent-pdfs'
        AND is_admin_staff()
      );
  END IF;
END $$;
