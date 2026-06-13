-- Attach externally-generated PayDay invoice PDFs to a company
-- (added 2026-06-13). Staff upload a PDF + the invoice number / amount /
-- date / status for an invoice that was created directly in PayDay
-- (outside the website admin). It lands as a normal company_invoices
-- row so it shows in the company's Invoices section and counts toward
-- B2B income — but with payday_invoice_id NULL (so the status sync skips
-- it) and the PDF stored in a private bucket, served via the app.
--
-- Apply manually in the Supabase SQL editor. Idempotent.

alter table company_invoices add column if not exists pdf_storage_path text;

insert into storage.buckets (id, name, public)
values ('company-invoice-pdfs', 'company-invoice-pdfs', false)
on conflict (id) do nothing;
