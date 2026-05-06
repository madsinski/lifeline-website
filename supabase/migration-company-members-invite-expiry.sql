-- =============================================================
-- company_members.invite_token_expires_at
--
-- Until now, invite_token was valid forever (subject only to the
-- existing per-member lockout + per-IP rate limit). A leaked or
-- forwarded invite email could therefore be used to enumerate
-- kennitala on the company indefinitely until the member completed
-- onboarding.
--
-- Add a 30-day expiration that is set every time we (re)send an
-- invite. The verify endpoint pre-checks this column before calling
-- verify_member_invite so expired tokens never get a password
-- attempt — no enumeration surface.
--
-- Idempotent. Run in the Supabase SQL editor.
-- =============================================================

ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS invite_token_expires_at TIMESTAMPTZ;

-- Backfill: for members who already had an invite sent, treat
-- it as valid for 30 days from the original send. Members who
-- have completed onboarding are not affected; members who were
-- never invited keep NULL (no expiration to compare).
UPDATE public.company_members
SET invite_token_expires_at = invited_at + INTERVAL '30 days'
WHERE invited_at IS NOT NULL
  AND completed_at IS NULL
  AND invite_token_expires_at IS NULL;
