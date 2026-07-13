-- Lyfja measurement days ────────────────────────────────────────────────────
-- A walk-in body-composition measurement option that mirrors blood_test_days.
-- Instead of a Lifeline staff member travelling to the office (body_comp_events),
-- the company can pick days on which employees walk in to the Lyfja station in
-- Smáratorg for their measurement. No Lifeline approval needed — the station is
-- fixed and staffed, exactly like the Sameind blood-test walk-in.
--
-- Applied manually in the Supabase SQL editor (repo convention). Idempotent.

create table if not exists public.body_comp_days (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  day         date not null,
  notes       text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (company_id, day)
);

create index if not exists body_comp_days_company_day_idx
  on public.body_comp_days (company_id, day);

alter table public.body_comp_days enable row level security;

-- Staff: full access.
drop policy if exists bcd_staff_all on public.body_comp_days;
create policy bcd_staff_all on public.body_comp_days
  for all using (public.is_active_staff()) with check (public.is_active_staff());

-- Company contact person / co-admins: read their own company's days.
drop policy if exists bcd_company_read on public.body_comp_days;
create policy bcd_company_read on public.body_comp_days
  for select using (
    exists (select 1 from public.companies c
            where c.id = company_id and c.contact_person_id = auth.uid())
    or exists (select 1 from public.company_admins ca
            where ca.company_id = body_comp_days.company_id and ca.user_id = auth.uid())
  );

-- Company employees: read their own company's days.
drop policy if exists bcd_member_read on public.body_comp_days;
create policy bcd_member_read on public.body_comp_days
  for select using (
    exists (select 1 from public.clients cl
            where cl.id = auth.uid() and cl.company_id = body_comp_days.company_id)
  );

-- Writes go exclusively through /api/business/body-comp-days using the
-- service-role key — no anon insert/update/delete policy is granted.
