-- =============================================================
-- Encrypt feedback_responses.text_value at rest.
--
-- Why: clients can paste personally identifying / health-sensitive
-- info into open-text answers ("Ég er með sykursýki...", "Mads
-- frá Lifeline lét mig vita..."). Plain text in the DB violates the
-- same posture the rest of the platform enforces — clients PII is
-- already encrypted via pgcrypto/Vault; survey free-text needs to
-- match.
--
-- Strategy mirrors migration-encrypt-clients-pii.sql:
--   1. Add text_value_enc bytea column.
--   2. Backfill existing rows.
--   3. Trigger encrypts on INSERT/UPDATE and nulls the plaintext
--      so we never persist it again.
--   4. View feedback_responses_decrypted exposes plaintext via
--      decrypt_text() for read paths (results, export, AI summary).
--
-- Idempotent. Run in the Supabase SQL editor.
-- =============================================================

ALTER TABLE public.feedback_responses
  ADD COLUMN IF NOT EXISTS text_value_enc BYTEA;

-- Backfill existing plaintext into the encrypted column. Only encrypts
-- rows that haven't been encrypted yet.
UPDATE public.feedback_responses
SET text_value_enc = public.encrypt_text(text_value)
WHERE text_value IS NOT NULL
  AND text_value_enc IS NULL;

-- Null the plaintext after backfill so we don't keep both copies.
UPDATE public.feedback_responses
SET text_value = NULL
WHERE text_value IS NOT NULL
  AND text_value_enc IS NOT NULL;

-- Trigger: if a writer inserts/updates with text_value plaintext, move
-- it into text_value_enc and clear text_value. This keeps the API
-- insert path (which still writes text_value) working without app
-- changes — encryption happens at the DB boundary.
CREATE OR REPLACE FUNCTION public.tg_feedback_responses_encrypt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.text_value IS NOT NULL THEN
    NEW.text_value_enc := public.encrypt_text(NEW.text_value);
    NEW.text_value := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feedback_responses_encrypt_bi ON public.feedback_responses;
CREATE TRIGGER feedback_responses_encrypt_bi
  BEFORE INSERT OR UPDATE ON public.feedback_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_feedback_responses_encrypt();

-- Decrypted view for read paths. security_invoker so the caller's
-- RLS on feedback_responses is honored — service role bypasses RLS,
-- staff RLS already grants access.
CREATE OR REPLACE VIEW public.feedback_responses_decrypted
WITH (security_invoker = true)
AS SELECT
  id,
  assignment_id,
  question_id,
  value,
  values_array,
  public.decrypt_text(text_value_enc) AS text_value,
  skipped,
  created_at
FROM public.feedback_responses;

GRANT SELECT ON public.feedback_responses_decrypted TO authenticated, service_role;
