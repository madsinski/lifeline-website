-- =============================================================
-- dsr_requests — track every Data Subject Rights request as a row,
-- not just an email. Gives admin a queryable audit trail and the
-- foundation for a future /admin/data-requests page.
--
-- Run in the Supabase SQL editor. Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.dsr_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL,
  client_email    TEXT,
  request_type    TEXT NOT NULL CHECK (request_type IN (
    'access','rectification','erasure','restriction',
    'portability','objection','withdraw_consent'
  )),
  details         TEXT,
  status          TEXT NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received','in_progress','completed','withdrawn','rejected')),
  ip              TEXT,
  user_agent      TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS dsr_requests_client_idx
  ON public.dsr_requests (client_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS dsr_requests_status_idx
  ON public.dsr_requests (status, submitted_at DESC);

ALTER TABLE public.dsr_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own dsr requests') THEN
    CREATE POLICY "Clients can view own dsr requests" ON public.dsr_requests
      FOR SELECT TO authenticated
      USING (client_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can insert own dsr requests') THEN
    CREATE POLICY "Clients can insert own dsr requests" ON public.dsr_requests
      FOR INSERT TO authenticated
      WITH CHECK (client_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage dsr requests') THEN
    CREATE POLICY "Admins can manage dsr requests" ON public.dsr_requests
      FOR ALL TO authenticated
      USING (is_admin_staff())
      WITH CHECK (is_admin_staff());
  END IF;
END $$;
