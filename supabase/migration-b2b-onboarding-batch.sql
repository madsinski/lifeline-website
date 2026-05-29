-- =============================================================
-- B2B onboarding feedback batch — apply as one transaction.
-- Covers: contact-person details (#14), discount codes (#18),
-- measurement-day approval (#16), doctor-interview proposals (#17).
-- Safe to re-run (idempotent: IF NOT EXISTS / IF EXISTS guards).
-- =============================================================

begin;

-- ── #14 — Company contact-person details captured at signup ──────────
-- So a self-signup contact is identifiable (not "just anyone claiming to
-- be the company leader"). Kennitala stored encrypted like the company
-- kennitala (enc_kennitala), with last-4 kept for display/support.
alter table public.companies
  add column if not exists contact_phone text,
  add column if not exists contact_position text,
  add column if not exists contact_kennitala_encrypted bytea,
  add column if not exists contact_kennitala_last4 text;

commit;
