-- =============================================================
-- Stage 3: drop the plaintext columns + their old BEFORE triggers.
--
-- After Stage 2 deploy is verified working in production, run this to
-- complete the cutover. Once these columns are gone, the only readable
-- form of the data is via decrypt_text() through the *_decrypted views.
--
-- IRREVERSIBLE — make sure Stage 2 is in production and verified before
-- running this. Backup the database before running if you're nervous.
-- =============================================================

-- Drop the BEFORE triggers first (they reference the columns about to go).
DROP TRIGGER IF EXISTS encrypt_messages_content ON public.messages;
DROP TRIGGER IF EXISTS encrypt_clients_pii ON public.clients;
DROP FUNCTION IF EXISTS public.tg_encrypt_messages_content();
DROP FUNCTION IF EXISTS public.tg_encrypt_clients_pii();

-- Drop the plaintext columns. After this, the only place these values
-- exist is encrypted in *_enc columns.
ALTER TABLE public.messages DROP COLUMN IF EXISTS content;

ALTER TABLE public.clients
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS emergency_contact_name,
  DROP COLUMN IF EXISTS emergency_contact_phone,
  DROP COLUMN IF EXISTS kennitala_last4;

-- Verification: these should all return 0.
DO $$
DECLARE
  msg_plain INT;
  cli_phone_plain INT;
BEGIN
  -- Are there any messages with content_enc but no decryptable content?
  SELECT count(*) INTO msg_plain
  FROM public.messages
  WHERE content_enc IS NOT NULL AND public.decrypt_text(content_enc) IS NULL;
  IF msg_plain > 0 THEN
    RAISE EXCEPTION 'Found % messages where content_enc cannot be decrypted', msg_plain;
  END IF;

  SELECT count(*) INTO cli_phone_plain
  FROM public.clients
  WHERE phone_enc IS NOT NULL AND public.decrypt_text(phone_enc) IS NULL;
  IF cli_phone_plain > 0 THEN
    RAISE EXCEPTION 'Found % clients where phone_enc cannot be decrypted', cli_phone_plain;
  END IF;
END $$;
