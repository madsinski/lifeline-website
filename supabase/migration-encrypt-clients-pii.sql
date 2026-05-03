-- =============================================================
-- Encrypt clients PII
--
-- Columns covered (the most sensitive PII a Persónuvernd auditor would
-- ask about specifically):
--   - phone, address
--   - date_of_birth
--   - emergency_contact_name, emergency_contact_phone
--   - kennitala_last4
--
-- NOT covered here (deliberate):
--   - email — needed unhashed for Supabase Auth + sendEmail addressing.
--     Auth-side is hashed in auth.users; the public.clients.email is a
--     denormalised mirror. Encrypting it would break sendEmail flows.
--   - full_name — searched/displayed in admin UIs constantly. Could be
--     encrypted later but more invasive; defer.
--   - height_cm, weight_kg, body_fat_pct, muscle_mass_pct, sex —
--     these will be removed entirely once the Biody on-demand fetch is
--     fully wired (lib/biody-client.ts). Don't encrypt what we're about
--     to delete.
--
-- Same staging pattern as messages.content:
-- Stage 1 (this file): add *_enc columns + write triggers.
-- Stage 2: run backfill_clients_pii_enc(N) repeatedly until it returns 0.
-- Stage 3: flip read paths, then drop the plaintext columns.
--
-- Prerequisite: migration-encryption-foundation.sql must have run first.
-- =============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS phone_enc BYTEA,
  ADD COLUMN IF NOT EXISTS address_enc BYTEA,
  ADD COLUMN IF NOT EXISTS date_of_birth_enc BYTEA,
  ADD COLUMN IF NOT EXISTS emergency_contact_name_enc BYTEA,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone_enc BYTEA,
  ADD COLUMN IF NOT EXISTS kennitala_last4_enc BYTEA;

CREATE OR REPLACE FUNCTION public.tg_encrypt_clients_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.phone_enc := public.encrypt_text(NEW.phone);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.address IS DISTINCT FROM OLD.address THEN
    NEW.address_enc := public.encrypt_text(NEW.address);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
    NEW.date_of_birth_enc := public.encrypt_text(NEW.date_of_birth::TEXT);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.emergency_contact_name IS DISTINCT FROM OLD.emergency_contact_name THEN
    NEW.emergency_contact_name_enc := public.encrypt_text(NEW.emergency_contact_name);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.emergency_contact_phone IS DISTINCT FROM OLD.emergency_contact_phone THEN
    NEW.emergency_contact_phone_enc := public.encrypt_text(NEW.emergency_contact_phone);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.kennitala_last4 IS DISTINCT FROM OLD.kennitala_last4 THEN
    NEW.kennitala_last4_enc := public.encrypt_text(NEW.kennitala_last4);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encrypt_clients_pii ON public.clients;
CREATE TRIGGER encrypt_clients_pii
BEFORE INSERT OR UPDATE OF phone, address, date_of_birth, emergency_contact_name, emergency_contact_phone, kennitala_last4
ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.tg_encrypt_clients_pii();

-- Backfill helper.
CREATE OR REPLACE FUNCTION public.backfill_clients_pii_enc(batch_size INT DEFAULT 500)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_done INT;
BEGIN
  WITH batch AS (
    SELECT id FROM public.clients
    WHERE
      (phone IS NOT NULL AND phone_enc IS NULL)
      OR (address IS NOT NULL AND address_enc IS NULL)
      OR (date_of_birth IS NOT NULL AND date_of_birth_enc IS NULL)
      OR (emergency_contact_name IS NOT NULL AND emergency_contact_name_enc IS NULL)
      OR (emergency_contact_phone IS NOT NULL AND emergency_contact_phone_enc IS NULL)
      OR (kennitala_last4 IS NOT NULL AND kennitala_last4_enc IS NULL)
    ORDER BY id
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.clients c
  SET
    phone_enc                   = COALESCE(c.phone_enc,                   public.encrypt_text(c.phone)),
    address_enc                 = COALESCE(c.address_enc,                 public.encrypt_text(c.address)),
    date_of_birth_enc           = COALESCE(c.date_of_birth_enc,           public.encrypt_text(c.date_of_birth::TEXT)),
    emergency_contact_name_enc  = COALESCE(c.emergency_contact_name_enc,  public.encrypt_text(c.emergency_contact_name)),
    emergency_contact_phone_enc = COALESCE(c.emergency_contact_phone_enc, public.encrypt_text(c.emergency_contact_phone)),
    kennitala_last4_enc         = COALESCE(c.kennitala_last4_enc,         public.encrypt_text(c.kennitala_last4))
  FROM batch
  WHERE c.id = batch.id;
  GET DIAGNOSTICS rows_done = ROW_COUNT;
  RETURN rows_done;
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_clients_pii_enc(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_clients_pii_enc(INT) TO service_role;

-- Decrypted view for read-path cutover.
CREATE OR REPLACE VIEW public.clients_decrypted
WITH (security_invoker = true)
AS SELECT
  id,
  email,
  full_name,
  public.decrypt_text(phone_enc) AS phone,
  public.decrypt_text(address_enc) AS address,
  public.decrypt_text(date_of_birth_enc)::DATE AS date_of_birth,
  public.decrypt_text(emergency_contact_name_enc) AS emergency_contact_name,
  public.decrypt_text(emergency_contact_phone_enc) AS emergency_contact_phone,
  public.decrypt_text(kennitala_last4_enc) AS kennitala_last4,
  -- Non-encrypted fields the app reads alongside; mirrored straight through.
  sex,
  height_cm,
  weight_kg,
  body_fat_pct,
  muscle_mass_pct,
  activity_level,
  macro_goal,
  avatar_url,
  company_id,
  biody_patient_id,
  biody_uuid,
  last_body_comp_at,
  welcome_seen_at,
  terms_accepted_at,
  terms_version,
  created_at,
  updated_at
FROM public.clients;

GRANT SELECT ON public.clients_decrypted TO authenticated, service_role;
