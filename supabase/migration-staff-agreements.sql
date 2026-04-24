-- =============================================================
-- Staff legal layer — two tables + two storage buckets.
--
-- 1. staff_agreement_acceptances
--    Mirrors platform_agreement_acceptances but for our team (not
--    end users). Every staff member clicks through NDA, þagnarskylda,
--    acceptable-use, data-protection briefing at onboarding; each
--    acceptance is recorded with text_hash / IP / UA / PDF certificate.
--
-- 2. staff_documents
--    Mirrors company_documents. Admin uploads for bespoke signed PDFs
--    — offer letters, amendments, paper-signed contracts, tax forms,
--    anything we can't template.
--
-- Both tables key off staff.id (which already == auth.uid() thanks to
-- migration-staff-rls.sql).
-- =============================================================

-- ── staff_agreement_acceptances ────────────────────────────────
create table if not exists public.staff_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  document_key text not null,
  document_version text not null,
  document_title text,
  text_hash text not null,
  ip text,
  user_agent text,
  typed_signature text,
  pdf_storage_path text,
  pdf_sha256 text,
  accepted_at timestamptz not null default now(),
  unique (staff_id, document_key, document_version)
);

create index if not exists idx_staff_acceptances_staff
  on public.staff_agreement_acceptances (staff_id, document_key);

alter table public.staff_agreement_acceptances enable row level security;

-- A staff member can read their own acceptances.
drop policy if exists "staff read own acceptances" on public.staff_agreement_acceptances;
create policy "staff read own acceptances" on public.staff_agreement_acceptances
  for select using (staff_id = auth.uid());

-- A staff member can insert their own acceptance (used by /me/accept route
-- when running under the user's JWT — in practice the server uses service
-- role, but keep this open for symmetry with the platform table).
drop policy if exists "staff insert own acceptance" on public.staff_agreement_acceptances;
create policy "staff insert own acceptance" on public.staff_agreement_acceptances
  for insert with check (staff_id = auth.uid());

-- Admin-level staff (or anyone with manage_team permission) can read/manage all.
drop policy if exists "admin manage staff acceptances" on public.staff_agreement_acceptances;
create policy "admin manage staff acceptances" on public.staff_agreement_acceptances
  for all using (
    exists (
      select 1 from public.staff s
      where s.id = auth.uid() and s.active = true
        and (s.role = 'admin' or ('manage_team' = any (coalesce(s.permissions, array[]::text[]))))
    )
  ) with check (
    exists (
      select 1 from public.staff s
      where s.id = auth.uid() and s.active = true
        and (s.role = 'admin' or ('manage_team' = any (coalesce(s.permissions, array[]::text[]))))
    )
  );

-- Private storage bucket for the per-acceptance PDF certificates.
insert into storage.buckets (id, name, public)
values ('staff-acceptance-pdfs', 'staff-acceptance-pdfs', false)
on conflict (id) do nothing;

-- ── staff_documents ────────────────────────────────────────────
create table if not exists public.staff_documents (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  kind text not null check (kind in ('nda','confidentiality','employment_contract','offer_letter','amendment','tax_form','other')),
  title text,
  filename text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  signer_name text,
  signed_at date,
  note text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_staff_documents_staff
  on public.staff_documents (staff_id, kind);

alter table public.staff_documents enable row level security;

-- Staff member reads their own uploaded documents.
drop policy if exists "staff read own documents" on public.staff_documents;
create policy "staff read own documents" on public.staff_documents
  for select using (staff_id = auth.uid());

-- Admin-level staff (or manage_team permission) can upload, update, delete.
drop policy if exists "admin manage staff documents" on public.staff_documents;
create policy "admin manage staff documents" on public.staff_documents
  for all using (
    exists (
      select 1 from public.staff s
      where s.id = auth.uid() and s.active = true
        and (s.role = 'admin' or ('manage_team' = any (coalesce(s.permissions, array[]::text[]))))
    )
  ) with check (
    exists (
      select 1 from public.staff s
      where s.id = auth.uid() and s.active = true
        and (s.role = 'admin' or ('manage_team' = any (coalesce(s.permissions, array[]::text[]))))
    )
  );

-- Private storage bucket for bespoke staff PDFs.
insert into storage.buckets (id, name, public)
values ('staff-documents', 'staff-documents', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
