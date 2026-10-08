-- =============================================================
-- security_findings — output of the hourly intruder scan
-- (src/lib/intruder-scan.ts, /api/cron/intruder-scan, /admin/security).
--
-- One row per distinct finding (fingerprint = rule + account), kept
-- after the account itself is deleted so there is a record of what
-- was found and what was done about it. user_id is deliberately NOT a
-- foreign key for that reason.
--
-- Also defines block_suspicious_signup(), a Supabase Auth
-- "Before User Created" hook that refuses signups from scanner
-- callback domains. It does nothing until you switch it on:
--   Dashboard → Authentication → Hooks → Before User Created
--   → Postgres function → public.block_suspicious_signup
--
-- Run in Supabase SQL editor. Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.security_findings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint       TEXT NOT NULL UNIQUE,
  rule              TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('critical','high','medium')),
  user_id           UUID,
  email             TEXT,
  summary           TEXT NOT NULL,
  detail            JSONB,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','resolved')),
  action_taken      TEXT,
  note              TEXT,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  alerted_at        TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  resolved_by_email TEXT
);

CREATE INDEX IF NOT EXISTS security_findings_status_idx
  ON public.security_findings (status, first_seen_at DESC);

ALTER TABLE public.security_findings ENABLE ROW LEVEL SECURITY;

-- Admin-only read (sidebar badge + page). All writes go through the
-- API with the service role.
DROP POLICY IF EXISTS "Admin can read security findings" ON public.security_findings;
CREATE POLICY "Admin can read security findings" ON public.security_findings
  FOR SELECT TO authenticated
  USING (is_admin_staff());

-- ─── Signup hook (inactive until enabled in the dashboard) ───────
CREATE OR REPLACE FUNCTION public.block_suspicious_signup(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_domain TEXT := lower(split_part(coalesce(event->'user'->>'email', ''), '@', 2));
  v_blocked TEXT[] := ARRAY[
    'oastify.com','burpcollaborator.net','interact.sh','interactsh.com',
    'oast.pro','oast.live','oast.site','oast.online','oast.fun','oast.me',
    'dnslog.cn','ceye.io','canarytokens.com','requestbin.net','pipedream.net',
    'webhook.site','xss.ht','bxss.me'
  ];
  d TEXT;
BEGIN
  FOREACH d IN ARRAY v_blocked LOOP
    IF v_domain = d OR v_domain LIKE '%.' || d THEN
      RETURN jsonb_build_object('error', jsonb_build_object(
        'http_code', 403,
        'message', 'Signups from this email domain are not allowed.'
      ));
    END IF;
  END LOOP;
  RETURN '{}'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.block_suspicious_signup(JSONB) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.block_suspicious_signup(JSONB) FROM authenticated, anon, PUBLIC;
