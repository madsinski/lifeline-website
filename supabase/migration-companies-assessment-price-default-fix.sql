-- =============================================================
-- companies.assessment_unit_price — remove accidental column default
-- Run manually in the Supabase SQL editor. Idempotent.
-- =============================================================
--
-- Consumed by:
--   src/app/business/[companyId]/sign/page.tsx                       (custom price overrides the tiered price on the PO)
--   src/app/api/admin/companies/[companyId]/commercial/route.ts      (admin reads/writes the custom price)
--   src/app/api/admin/companies/[companyId]/invoice/route.ts         (unit price fallback: assessment_unit_price || 49900)
--   src/app/api/admin/companies/[companyId]/consolidated-invoice/route.ts
--   src/app/admin/companies/page.tsx                                 ("Pricing & app" controls)
--   src/lib/b2b-pricing.ts                                           (tiered default when this column is NULL)
--
-- Background: this column was originally created directly in the SQL editor
-- (it had no committed migration) with a column-level DEFAULT 29990. Because
-- the company INSERT paths never set assessment_unit_price explicitly
-- (api/business/companies/route.ts on self-signup; api/admin/companies/
-- create-draft/route.ts when the price field is left blank), Postgres filled
-- the omitted column with 29990 on every new company. The non-NULL value was
-- then treated as an admin-stipulated custom price, so the intended tiered
-- default (~52 000 ISK, see src/lib/b2b-pricing.ts) was never reached.
--
-- The fix: drop the default so an unspecified price stays NULL and the code
-- falls back to the tiered price, and null out companies that inherited 29990
-- automatically. This file documents the column so it is finally tracked in
-- the repo.

-- 1. Ensure the column exists (it predates the repo's migrations) ----
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS assessment_unit_price integer;

-- 2. Remove the accidental column default ---------------------------
ALTER TABLE public.companies
  ALTER COLUMN assessment_unit_price DROP DEFAULT;

-- 3. Clear the value on companies that inherited 29990 automatically.
--    These were never priced by an admin; NULL lets them fall back to the
--    tiered default. Scope by id instead if any company was intentionally
--    priced at 29 990.
UPDATE public.companies
SET assessment_unit_price = NULL
WHERE assessment_unit_price = 29990;
