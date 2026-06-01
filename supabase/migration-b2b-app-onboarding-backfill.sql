-- =============================================================
-- Backfill clients.onboarding_complete for B2B employees
-- Run manually in the Supabase SQL editor. Idempotent.
-- =============================================================
--
-- The website B2B onboarding (api/business/onboard/[token]/complete) now sets
-- clients.onboarding_complete = true so the mobile app doesn't drop an
-- already-onboarded employee back into its own onboarding flow on first login.
--
-- This backfills employees who onboarded BEFORE that change. Scoped to clients
-- that have a company AND have accepted terms (i.e. genuinely completed web
-- onboarding) — not admin-created Biody placeholders that never set a password.

UPDATE public.clients
SET onboarding_complete = true
WHERE company_id IS NOT NULL
  AND terms_accepted_at IS NOT NULL
  AND onboarding_complete IS DISTINCT FROM true;
