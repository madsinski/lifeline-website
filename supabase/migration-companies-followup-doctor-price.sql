-- =============================================================
-- companies.followup_doctor_price — per-company custom price for the
-- 3-month follow-up doctor call (the optional B2B add-on).
-- Run manually in the Supabase SQL editor. Idempotent.
-- =============================================================
--
-- Consumed by:
--   src/lib/b2b-pricing.ts                                       (followupUnitPrice override; NULL → flat FOLLOWUP_DOCTOR_PRICE_ISK)
--   src/app/business/[companyId]/sign/page.tsx                   (applies the custom price on the purchase order)
--   src/app/api/admin/companies/[companyId]/commercial/route.ts  (admin reads/writes the custom price)
--   src/app/admin/companies/page.tsx                             ("Pricing & app" → "Custom 3-month doctor call price")
--
-- Mirrors companies.assessment_unit_price: NULLABLE with NO default. NULL
-- means "no staff-stipulated price → use the flat default (12 900 ISK,
-- FOLLOWUP_DOCTOR_PRICE_ISK in src/lib/b2b-pricing.ts)". Do NOT add a column
-- DEFAULT here — a non-NULL value is treated everywhere as an explicit
-- custom price and would suppress the flat default (see the incident behind
-- supabase/migration-companies-assessment-price-default-fix.sql).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS followup_doctor_price integer;
