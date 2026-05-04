-- =============================================================
-- app_errors — local mirror of error events captured by Sentry.
--
-- Sentry sends emails on errors and we have its dashboard, but the
-- founder needs to be able to triage errors directly from the admin
-- panel and ask Claude to investigate via SQL. Mirroring the most
-- relevant fields into a queryable table makes that trivial.
--
-- Captured by sentry beforeSend hook (server + client) — fire-and-forget
-- so a DB outage never breaks the actual error reporting to Sentry.
--
-- Run in Supabase SQL editor. Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.app_errors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message      TEXT NOT NULL,
  stack        TEXT,
  url          TEXT,
  pathname     TEXT,
  runtime      TEXT CHECK (runtime IN ('browser','server','edge')),
  user_agent   TEXT,
  user_id      UUID,
  user_email   TEXT,
  fingerprint  TEXT,
  level        TEXT DEFAULT 'error' CHECK (level IN ('error','warning','fatal','info')),
  metadata     JSONB,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_errors_occurred_idx
  ON public.app_errors (occurred_at DESC);
CREATE INDEX IF NOT EXISTS app_errors_fingerprint_idx
  ON public.app_errors (fingerprint, occurred_at DESC);
CREATE INDEX IF NOT EXISTS app_errors_runtime_idx
  ON public.app_errors (runtime, occurred_at DESC);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

-- Admin-only read. Inserts always come from service role (capture endpoint).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read app errors') THEN
    CREATE POLICY "Admin can read app errors" ON public.app_errors
      FOR SELECT TO authenticated
      USING (is_admin_staff());
  END IF;
END $$;

-- Admin-only delete (for triage / cleanup).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete app errors') THEN
    CREATE POLICY "Admin can delete app errors" ON public.app_errors
      FOR DELETE TO authenticated
      USING (is_admin_staff());
  END IF;
END $$;
