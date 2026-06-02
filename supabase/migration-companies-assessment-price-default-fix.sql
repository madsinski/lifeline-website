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
-- (it had no committed migration) as `integer NOT NULL DEFAULT 29900` — the
-- B2C "premium" tier price (src/app/admin/page.tsx), reused by mistake. Two
-- problems compounded:
--
--   1. NOT NULL contradicts the code, which types the column `number | null`
--      and uses NULL as the sentinel for "no admin-stipulated price → fall
--      back to the tiered ~52 000 ISK price" (src/lib/b2b-pricing.ts,
--      src/app/business/[companyId]/sign/page.tsx). With NOT NULL the value
--      can never be NULL, so the tiered fallback never fires, and the admin
--      "leave blank" action (commercial/route.ts sends null) would error.
--   2. DEFAULT 29900 meant every company whose INSERT omitted the field
--      (api/business/companies/route.ts on self-signup; create-draft/route.ts
--      when the price box is blank) silently inherited 29900, which the rest
--      of the app then read as a real custom price.
--
-- The fix: make the column nullable, drop the default, and null out the rows
-- that inherited 29900 automatically. This file documents the column so it is
-- finally tracked in the repo.

-- 1. Ensure the column exists (it predates the repo's migrations) ----
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS assessment_unit_price integer;

-- 2. Allow NULL — the code uses NULL = "no custom price, use tiered default"
ALTER TABLE public.companies
  ALTER COLUMN assessment_unit_price DROP NOT NULL;

-- 3. Remove the accidental column default ---------------------------
ALTER TABLE public.companies
  ALTER COLUMN assessment_unit_price DROP DEFAULT;

-- 4. Clear the value on companies that inherited 29900 automatically.
--    These were never priced by an admin; NULL lets them fall back to the
--    tiered default. Scope by id instead if any company was intentionally
--    priced at 29 900.
UPDATE public.companies
SET assessment_unit_price = NULL
WHERE assessment_unit_price = 29900;
