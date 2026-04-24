-- =============================================================
-- platform-acceptance-pdfs bucket
--
-- The claim / onboard / account-onboard / platform-accept-terms
-- routes all try to upload the per-acceptance PDF certificate to
-- this bucket after writing the platform_agreement_acceptances
-- row. The bucket was referenced in code but never created, so
-- every upload silently 404'd (error logged, not surfaced) and
-- pdf_storage_path stayed NULL on every row. The admin legal tab
-- then renders "Missing" on every download button.
--
-- This migration creates the bucket. A follow-up backfill route
-- (/api/admin/legal/backfill-acceptance-pdfs) regenerates PDFs
-- for rows that already had their acceptance recorded but never
-- got a PDF saved.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('platform-acceptance-pdfs', 'platform-acceptance-pdfs', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
