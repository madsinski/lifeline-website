-- =============================================================
-- Encryption foundation — pgcrypto + Supabase Vault.
--
-- Why pgcrypto instead of pgsodium?
-- pgsodium.crypto_aead_det_encrypt requires the pgsodium_keyiduser role
-- which hosted Supabase doesn't grant to the postgres role even via
-- SECURITY DEFINER. pgcrypto.pgp_sym_encrypt has no such restriction —
-- it's a standard PostgreSQL extension enabled by default everywhere.
--
-- Why Vault for the key?
-- Vault stores the passphrase encrypted at rest using a Supabase-managed
-- root key. SECURITY DEFINER lets our public.encrypt_text fetch the
-- passphrase without exposing it to ordinary callers. Beats hardcoding
-- the passphrase in the function source (which any role with pg_proc
-- read access could see).
--
-- Run in the Supabase SQL editor. Idempotent.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Generate a strong random passphrase and store it in Vault.
-- Idempotent: only creates if not already there. The passphrase value
-- is generated once and never logged.
DO $$
DECLARE
  v_secret TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'lifeline_encryption_key') THEN
    v_secret := encode(gen_random_bytes(32), 'base64');
    PERFORM vault.create_secret(v_secret, 'lifeline_encryption_key',
      'Symmetric passphrase for application-level column encryption (pgcrypto pgp_sym_encrypt)');
  END IF;
END $$;

-- SECURITY DEFINER fetcher — callers don't need direct Vault access.
CREATE OR REPLACE FUNCTION public.lifeline_encryption_passphrase()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = vault, public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets
  WHERE name = 'lifeline_encryption_key' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.lifeline_encryption_passphrase() FROM PUBLIC;
-- Only encrypt/decrypt helpers (and superuser) need this; we don't grant
-- to authenticated. The wrapping helpers below are what the app calls.

-- Encrypt / decrypt helpers for plain text columns. Uses PGP symmetric
-- encryption (AES-256 by default in pgcrypto). NOT deterministic — same
-- plaintext encrypts to different ciphertext on each call (random salt).
-- That means equality search via LIKE/= won't work on encrypted data,
-- but for messages.content / address / phone / etc. that's fine: the app
-- doesn't search those fields.
CREATE OR REPLACE FUNCTION public.encrypt_text(p TEXT)
RETURNS BYTEA
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p IS NULL OR p = '' THEN NULL
    ELSE pgp_sym_encrypt(p, public.lifeline_encryption_passphrase(), 'cipher-algo=aes256'::text)
  END;
$$;
REVOKE ALL ON FUNCTION public.encrypt_text(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_text(TEXT) TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.decrypt_text(p BYTEA)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    ELSE pgp_sym_decrypt(p, public.lifeline_encryption_passphrase())
  END;
$$;
REVOKE ALL ON FUNCTION public.decrypt_text(BYTEA) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_text(BYTEA) TO service_role, authenticated;

-- Smoke test — should round-trip cleanly.
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
