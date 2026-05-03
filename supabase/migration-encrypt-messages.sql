-- =============================================================
-- Encrypt messages.content
--
-- Stage 1: add content_enc column + write trigger that mirrors NEW.content.
-- Stage 2 (operator action): run backfill_messages_content_enc() repeatedly
-- until 0 rows updated.
-- Stage 3 (operator action, after read paths flip): drop messages.content
-- and rename content_enc → content (or keep separate, your call).
--
-- This file ships stage 1 only. Backfill is an operator action.
-- Read-path swap requires application changes that ship separately.
--
-- Prerequisite: migration-encryption-foundation.sql must have run first.
-- =============================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS content_enc BYTEA;

-- Trigger: keep content_enc in sync with content on every INSERT/UPDATE.
-- Runs BEFORE so it can mutate NEW.
CREATE OR REPLACE FUNCTION public.tg_encrypt_messages_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only re-encrypt if the plaintext value actually changed.
  IF TG_OP = 'INSERT' OR NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.content_enc := public.encrypt_text(NEW.content);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encrypt_messages_content ON public.messages;
CREATE TRIGGER encrypt_messages_content
BEFORE INSERT OR UPDATE OF content ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.tg_encrypt_messages_content();

-- Backfill helper. Run repeatedly:
--   SELECT public.backfill_messages_content_enc(500);
-- until it returns 0. Off-peak hours preferred but not strictly required —
-- it batches in groups of N to avoid long lock chains.
CREATE OR REPLACE FUNCTION public.backfill_messages_content_enc(batch_size INT DEFAULT 500)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_done INT;
BEGIN
  WITH batch AS (
    SELECT id FROM public.messages
    WHERE content IS NOT NULL AND content_enc IS NULL
    ORDER BY id
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.messages m
  SET content_enc = public.encrypt_text(m.content)
  FROM batch
  WHERE m.id = batch.id;
  GET DIAGNOSTICS rows_done = ROW_COUNT;
  RETURN rows_done;
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_messages_content_enc(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_messages_content_enc(INT) TO service_role;

-- Decrypted view for application read paths (Stage 3 cutover target).
-- Until you flip reads to this view, the application keeps reading
-- messages.content directly, which is fine — the trigger keeps both
-- columns in sync.
CREATE OR REPLACE VIEW public.messages_decrypted
WITH (security_invoker = true)
AS SELECT
  id,
  conversation_id,
  sender_id,
  sender_name,
  sender_role,
  public.decrypt_text(content_enc) AS content,
  read,
  created_at
FROM public.messages;

GRANT SELECT ON public.messages_decrypted TO authenticated, service_role;
