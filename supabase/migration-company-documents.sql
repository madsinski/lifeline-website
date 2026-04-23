-- =============================================================
-- company_documents — historic agreement / PO / DPA PDF uploads
--
-- Some companies signed Lifeline's agreements offline (on paper,
-- or via email) before the digital signing flow existed. We need a
-- place for admins to upload those PDFs so every company has its
-- full legal pack attached to its record — even ones that pre-date
-- the platform_agreement_acceptances electronic audit table.
--
-- Separate from platform_agreement_acceptances because:
--   • This table stores admin-uploaded third-party-signed artifacts
--     (no IP / user-agent / text_hash / electronic timestamp).
--   • That table stores rigorous click-through acceptances with
--     cryptographic audit trail.
-- =============================================================

create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('tos','dpa','purchase_order','other')),
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

create index if not exists idx_company_documents_company
  on public.company_documents (company_id, kind);

alter table public.company_documents enable row level security;

drop policy if exists "staff manage company documents" on public.company_documents;
create policy "staff manage company documents" on public.company_documents
  for all using (
    exists (select 1 from public.staff s where s.id = auth.uid() and s.active = true)
  ) with check (
    exists (select 1 from public.staff s where s.id = auth.uid() and s.active = true)
  );

-- Contact person of the company may read their own uploaded documents.
drop policy if exists "contact reads own company documents" on public.company_documents;
create policy "contact reads own company documents" on public.company_documents
  for select using (
    exists (select 1 from public.companies c
      where c.id = company_documents.company_id
        and (c.contact_person_id = auth.uid()
             or public.is_company_admin(c.id, auth.uid()))
    )
  );

-- Private storage bucket — every fetch goes through a staff-gated
-- API route that generates short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('company-docs','company-docs', false)
on conflict (id) do nothing;
