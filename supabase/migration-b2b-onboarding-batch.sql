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

-- ── #18 — Discount codes (afsláttarkóði) ─────────────────────────────
-- Admin-generated codes, validated against this table at signing time.
create table if not exists public.discount_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- stored upper-cased
  kind        text not null check (kind in ('percent','fixed')),
  value       numeric not null check (value >= 0),  -- percent 0–100, or ISK
  active      boolean not null default true,
  expires_at  timestamptz,
  max_uses    integer,                              -- null = unlimited
  used_count  integer not null default 0,
  note        text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- Track the applied code + discount on each purchase order.
alter table public.b2b_purchase_orders
  add column if not exists discount_code text,
  add column if not exists discount_isk integer not null default 0;

alter table public.discount_codes enable row level security;

-- Staff manage codes; everyone else goes through the SECURITY DEFINER
-- RPCs below (so a contact can validate a code without reading the table).
drop policy if exists discount_codes_staff_all on public.discount_codes;
create policy discount_codes_staff_all on public.discount_codes
  for all using (public.is_active_staff()) with check (public.is_active_staff());

-- Validate a code without exposing the table. Returns validity + terms.
create or replace function public.validate_discount_code(p_code text)
returns table(valid boolean, kind text, value numeric, error text)
language plpgsql security definer set search_path = public as $$
declare r public.discount_codes%rowtype;
begin
  select * into r from public.discount_codes
    where code = upper(trim(p_code));
  if not found then
    return query select false, null::text, null::numeric, 'not_found'::text; return;
  end if;
  if not r.active then
    return query select false, r.kind, r.value, 'inactive'::text; return;
  end if;
  if r.expires_at is not null and r.expires_at < now() then
    return query select false, r.kind, r.value, 'expired'::text; return;
  end if;
  if r.max_uses is not null and r.used_count >= r.max_uses then
    return query select false, r.kind, r.value, 'exhausted'::text; return;
  end if;
  return query select true, r.kind, r.value, null::text;
end;
$$;

-- Atomically redeem (increment used_count) at sign time. Re-checks
-- validity so a code can't be over-used under concurrency.
create or replace function public.redeem_discount_code(p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.discount_codes%rowtype;
begin
  select * into r from public.discount_codes
    where code = upper(trim(p_code)) for update;
  if not found or not r.active then return false; end if;
  if r.expires_at is not null and r.expires_at < now() then return false; end if;
  if r.max_uses is not null and r.used_count >= r.max_uses then return false; end if;
  update public.discount_codes set used_count = used_count + 1 where id = r.id;
  return true;
end;
$$;

grant execute on function public.validate_discount_code(text) to authenticated;
grant execute on function public.redeem_discount_code(text) to authenticated;

-- ── #16 — Measurement-day approval workflow ──────────────────────────
-- A company-proposed measurement day starts as 'requested'; Lifeline
-- staff approve it in /admin/business before employees are invited.
alter table public.body_comp_events
  add column if not exists approval_status text not null default 'requested'
    check (approval_status in ('requested','approved','rejected')),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists admin_note text;

create index if not exists idx_body_comp_events_pending
  on public.body_comp_events (approval_status)
  where approval_status = 'requested';

-- ── #17 — Doctor-interview proposals (employees self-book the slots) ──
-- The company proposes day(s) + a mode (on-site / video|phone); staff
-- approve and generate the 30-min doctor_slots reserved for the company;
-- employees then self-book via the existing book_doctor_slot RPC.
create table if not exists public.doctor_interview_proposals (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  proposed_date   date not null,
  start_time      time not null,
  end_time        time not null,
  mode            text not null check (mode in ('onsite','video')),
  room_notes      text,
  approval_status text not null default 'requested'
    check (approval_status in ('requested','approved','rejected')),
  approved_at     timestamptz,
  approved_by     uuid references auth.users(id),
  admin_note      text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

alter table public.doctor_interview_proposals enable row level security;

drop policy if exists dip_staff_all on public.doctor_interview_proposals;
create policy dip_staff_all on public.doctor_interview_proposals
  for all using (public.is_active_staff()) with check (public.is_active_staff());

-- The company's own contact/co-admins can see + create their proposals.
drop policy if exists dip_company_read on public.doctor_interview_proposals;
create policy dip_company_read on public.doctor_interview_proposals
  for select using (
    exists (select 1 from public.companies c
            where c.id = company_id and c.contact_person_id = auth.uid())
    or exists (select 1 from public.company_admins ca
            where ca.company_id = doctor_interview_proposals.company_id and ca.user_id = auth.uid())
  );

commit;
