-- Company contacts may not change their own commercial terms.
--
-- The "contact manages own company" policy is FOR ALL on the whole row, and
-- Supabase grants table-wide UPDATE/INSERT to authenticated, so a column
-- REVOKE does nothing. Before this, a contact could set their own agreed
-- price (assessment_unit_price, hc_price_isk — which checkout charges),
-- discount code, agreement state or admin notes straight from the browser
-- with the anon key. Found in the single-shop security review, 2026-10-16.
--
-- No browser code outside /admin writes companies (the business portal goes
-- through /api with the service role), so this only removes a hole.
-- Staff writes (admin pages, AAL2 policy) and the server pass through.
-- Idempotent.

create or replace function public.companies_guard_staff_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  k text;
  protected text[] := array[
    'assessment_unit_price', 'app_price_isk_monthly', 'followup_doctor_price',
    'hc_price_isk', 'hc_price_locked_until', 'applied_discount_code',
    'app_enabled', 'default_tier', 'status',
    'agreement_version', 'agreement_accepted_at', 'agreement_signed_at', 'agreement_id',
    'admin_notes', 'contact_person_id', 'parent_company_id',
    'payday_customer_id', 'claim_token_hash', 'claim_token_expires_at',
    'registration_finalized_at', 'registration_finalized_by', 'created_by_admin_id',
    'current_round_id', 'last_round_completed_at', 'next_renewal_eligible_at',
    'followup_completed_at', 'roster_confirmed_at'
  ];
  priced text[] := array[
    'assessment_unit_price', 'app_price_isk_monthly', 'followup_doctor_price',
    'hc_price_isk', 'hc_price_locked_until', 'applied_discount_code', 'admin_notes'
  ];
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or public.is_active_staff() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    foreach k in array priced loop
      if to_jsonb(new) ->> k is not null then
        raise exception 'companies.% is set by Lifeline staff only', k using errcode = '42501';
      end if;
    end loop;
    return new;
  end if;
  foreach k in array protected loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception 'companies.% is set by Lifeline staff only', k using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists companies_guard_staff_columns on public.companies;
create trigger companies_guard_staff_columns
  before insert or update on public.companies
  for each row execute function public.companies_guard_staff_columns();
