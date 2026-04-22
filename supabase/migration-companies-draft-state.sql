-- =============================================================
-- companies.status + draft-contact fields + claim token
--
-- Admins need to pre-create companies that haven't been through the
-- full B2B signup yet: usecases are (a) onboarding a prior customer
-- who hasn't used the portal, (b) staging a Biody patient group for
-- a company whose contact person isn't ready to sign up.
--
-- We add a status enum with 'draft' / 'contact_invited' / 'active' /
-- 'archived', plus the contact-person fields that are normally
-- captured during B2B signup, plus a single-use claim token so the
-- contact can later take ownership and sign the TOS + DPA.
--
-- Existing rows keep status='active' — the check constraint default
-- is 'active' so no back-compat issue.
-- =============================================================

alter table public.companies
  alter column contact_person_id drop not null;

alter table public.companies
  add column if not exists status text not null default 'active'
    check (status in ('draft','contact_invited','active','archived'));

alter table public.companies add column if not exists contact_draft_name text;
alter table public.companies add column if not exists contact_draft_email text;
alter table public.companies add column if not exists contact_draft_phone text;
alter table public.companies add column if not exists contact_draft_role text;

alter table public.companies add column if not exists company_address text;
alter table public.companies add column if not exists company_phone text;
alter table public.companies add column if not exists admin_notes text;

alter table public.companies
  add column if not exists created_by_admin_id uuid
    references auth.users(id) on delete set null;

alter table public.companies add column if not exists claim_token_hash text;
alter table public.companies add column if not exists claim_token_expires_at timestamptz;

create index if not exists idx_companies_status
  on public.companies (status) where status <> 'active';

create index if not exists idx_companies_claim
  on public.companies (claim_token_hash) where claim_token_hash is not null;

-- Existing RLS policies continue to work:
--   • 'staff manage all companies'  — drafts visible only to staff
--   • 'contact manages own company' — once contact_person_id is set on
--     activation, the real contact regains full access
--   • 'employees read own company'  — only active companies with a
--     company_id linked through clients
