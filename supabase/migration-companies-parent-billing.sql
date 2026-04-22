-- =============================================================
-- Parent company hierarchy + billing contact
--
-- Some customers are municipalities with several sub-entities
-- (schools, departments, etc.) each with its own operational contact
-- and roster, but one shared legal signatory + billing contact at
-- the municipal level. This migration adds:
--
--   • companies.parent_company_id — self-referencing FK. Top-level
--     companies have null; sub-companies point at a parent.
--   • Trigger to cap nesting at one level (no grandparents).
--   • Billing contact fields (name / email / phone / role / address).
--     Only meaningful on top-level companies; subs fall back to
--     their parent for billing via walk-up in the invoice route.
--
-- Legal signing policy: the parent signs TOS + DPA on behalf of the
-- whole organisation. Sub-company contact persons only bind their
-- auth account via a lightweight claim variant (no TOS/DPA re-sign).
-- =============================================================

alter table public.companies
  add column if not exists parent_company_id uuid
    references public.companies(id) on delete restrict;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_no_self_parent'
  ) then
    alter table public.companies
      add constraint companies_no_self_parent
      check (parent_company_id is null or parent_company_id <> id);
  end if;
end $$;

create index if not exists idx_companies_parent
  on public.companies (parent_company_id)
  where parent_company_id is not null;

create or replace function public.tg_companies_cap_nesting() returns trigger
language plpgsql as $$
declare
  v_parents_parent uuid;
begin
  if new.parent_company_id is not null then
    select parent_company_id into v_parents_parent
      from public.companies
      where id = new.parent_company_id;
    if v_parents_parent is not null then
      raise exception 'companies: parent_company_id cannot itself have a parent (one level of nesting only)';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists companies_cap_nesting on public.companies;
create trigger companies_cap_nesting
  before insert or update of parent_company_id on public.companies
  for each row execute function public.tg_companies_cap_nesting();

alter table public.companies add column if not exists billing_contact_name text;
alter table public.companies add column if not exists billing_contact_email text;
alter table public.companies add column if not exists billing_contact_phone text;
alter table public.companies add column if not exists billing_contact_role text;
alter table public.companies add column if not exists billing_address text;
