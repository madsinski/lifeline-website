-- =============================================================
-- Beta Tester Agreement (NDA) acceptances.
--
-- Modeled on platform_agreement_acceptances + staff_agreement_
-- acceptances: every beta tester signs the NDA the first time they
-- open a beta build of the app. The acceptance is recorded with the
-- canonical text hash, IP, user-agent, the typed signature (their
-- full legal name), and a generated PDF certificate that gets
-- emailed to them and stored for audit.
--
-- Storage bucket: beta-nda-pdfs (private). Same convention as
-- platform-acceptance-pdfs.
-- =============================================================

create table if not exists public.beta_nda_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,                    -- captured at sign time for audit
  document_key text not null,         -- 'beta-tester-agreement'
  document_version text not null,     -- e.g. '1.0'
  text_hash text not null,            -- sha256 hex of the canonical text shown
  typed_signature text not null,      -- full name typed by the tester
  ip text,
  user_agent text,
  app_platform text,                  -- 'ios' | 'android' (Platform.OS)
  app_version text,                   -- from expo-constants Constants.expoConfig.version
  pdf_storage_path text,              -- relative path inside the beta-nda-pdfs bucket
  pdf_sha256 text,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,             -- set if the tester later withdraws
  revoke_reason text,
  unique (user_id, document_key, document_version)
);

create index if not exists idx_beta_nda_user
  on public.beta_nda_acceptances (user_id, document_key);
create index if not exists idx_beta_nda_accepted_at
  on public.beta_nda_acceptances (accepted_at desc);

alter table public.beta_nda_acceptances enable row level security;

-- A user can read their own NDA row.
drop policy if exists "user read own beta nda" on public.beta_nda_acceptances;
create policy "user read own beta nda" on public.beta_nda_acceptances
  for select using (user_id = auth.uid());

-- A user can insert their own acceptance (the server uses service-role
-- in practice but this keeps the symmetry with the other consent
-- tables and lets a future client-only flow work).
drop policy if exists "user insert own beta nda" on public.beta_nda_acceptances;
create policy "user insert own beta nda" on public.beta_nda_acceptances
  for insert with check (user_id = auth.uid());

-- Admin staff can read/manage every row. Uses the SECURITY DEFINER
-- helper from migration-staff-rls.sql so we don't trigger the
-- recursive-RLS trap inlining EXISTS(SELECT FROM staff) would cause.
drop policy if exists "admin manage beta nda" on public.beta_nda_acceptances;
create policy "admin manage beta nda" on public.beta_nda_acceptances
  for all using (is_admin_staff())
  with check (is_admin_staff());

-- Private storage bucket for the per-acceptance PDF certificates.
insert into storage.buckets (id, name, public)
values ('beta-nda-pdfs', 'beta-nda-pdfs', false)
on conflict (id) do nothing;

-- Storage policies — only the signing user can read their own PDF,
-- and any admin staff can read/list everything in the bucket.
drop policy if exists "user read own beta nda pdf" on storage.objects;
create policy "user read own beta nda pdf" on storage.objects
  for select using (
    bucket_id = 'beta-nda-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin manage beta nda pdfs" on storage.objects;
create policy "admin manage beta nda pdfs" on storage.objects
  for all using (
    bucket_id = 'beta-nda-pdfs' and is_admin_staff()
  ) with check (
    bucket_id = 'beta-nda-pdfs' and is_admin_staff()
  );

notify pgrst, 'reload schema';
