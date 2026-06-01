-- =============================================================
-- B2B app subscription — per-company enablement + monthly price
-- Run manually in the Supabase SQL editor. Idempotent.
-- =============================================================
--
-- Consumed by:
--   src/app/business/[companyId]/sign/page.tsx                       (shows the app add-on + price on the order)
--   src/app/api/admin/companies/[companyId]/commercial/route.ts      (admin reads/writes these fields)
--   src/app/api/admin/companies/[companyId]/provision-app/route.ts   (grants employees app access)
--   src/app/admin/companies/page.tsx                                 (admin controls)
--
-- App ACCESS itself is governed by companies.default_tier → a subscriptions
-- row (status='active') created at employee onboarding. These two columns
-- only add the *commercial* side: whether the app add-on is offered to the
-- company and at what monthly per-employee price.

-- 1. Per-company app subscription columns ---------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS app_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS app_price_isk_monthly integer NOT NULL DEFAULT 3490;

-- 2. Normalise the default_tier check constraint --------------
--    migration-permissions-fix.sql renamed the paid tier full-access → premium
--    on clients/subscriptions, but the companies.default_tier check (added by
--    the app repo's migration-b2b-company-tier.sql) still only allowed the
--    legacy values — so selecting "premium" in admin silently failed to
--    persist. Drop-then-recreate the constraint to allow the current value
--    set (legacy 'full-access' kept for backward compatibility).
DO $$ BEGIN
  ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_default_tier_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_default_tier_check
  CHECK (
    default_tier IS NULL
    OR default_tier IN ('free-trial', 'self-maintained', 'premium', 'full-access')
  );
