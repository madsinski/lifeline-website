-- =============================================================
-- Encryption foundation — pgsodium key + helper functions.
--
-- This is the prerequisite for the per-column migrations
-- (migration-encrypt-messages.sql, migration-encrypt-clients-pii.sql).
-- Run this first, exactly once.
--
-- pgsodium is pre-enabled on Supabase. If your project doesn't have it,
-- the CREATE EXTENSION statement is a no-op via IF NOT EXISTS.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Named application key. The actual key material lives in pgsodium's
-- internal key store; we reference it by name everywhere so the key id
-- stays stable across rotations.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgsodium.key WHERE name = 'lifeline_app_v1') THEN
    PERFORM pgsodium.create_key(name := 'lifeline_app_v1');
  END IF;
END $$;

-- SECURITY DEFINER fetcher so callers don't need direct pgsodium ACL.
CREATE OR REPLACE FUNCTION public.lifeline_encryption_key_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pgsodium, public
AS $$
  SELECT id FROM pgsodium.key WHERE name = 'lifeline_app_v1' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.lifeline_encryption_key_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lifeline_encryption_key_id() TO service_role;

-- Encrypt / decrypt helpers for plain-text columns. Deterministic
-- AEAD so equal plaintexts encrypt to equal ciphertexts — slightly
-- weaker than non-deterministic, but enables equality search and
-- avoids breaking unique constraints. For health-conversation content
-- where you'd never search by content, this is still the practical
-- choice; the threat model we're defending against is "DB read-only
-- exfiltration", which det AEAD blocks.
CREATE OR REPLACE FUNCTION public.encrypt_text(p TEXT)
RETURNS BYTEA
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pgsodium, public
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    ELSE pgsodium.crypto_aead_det_encrypt(
      convert_to(p, 'utf8'),
      ''::BYTEA,
      public.lifeline_encryption_key_id()
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.encrypt_text(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_text(TEXT) TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.decrypt_text(p BYTEA)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pgsodium, public
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    ELSE convert_from(
      pgsodium.crypto_aead_det_decrypt(
        p,
        ''::BYTEA,
        public.lifeline_encryption_key_id()
      ),
      'utf8'
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.decrypt_text(BYTEA) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_text(BYTEA) TO service_role, authenticated;

-- Smoke test — should round-trip cleanly. Comment out after first run if
-- noisy in your logs.
DO $$
DECLARE
  ct BYTEA;
  pt TEXT;
BEGIN
  ct := public.encrypt_text('encryption_smoke_test');
  pt := public.decrypt_text(ct);
  IF pt IS DISTINCT FROM 'encryption_smoke_test' THEN
    RAISE EXCEPTION 'Encryption round-trip failed';
  END IF;
END $$;
