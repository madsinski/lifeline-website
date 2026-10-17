-- Who belongs to which company, and where a company is, are set by Lifeline
-- and the server only. Security review of coaching approval, 2026-10-17:
--   • clients.company_id was writable by the client itself ("Users can update
--     own data"), so anyone could attach themselves to any company — read that
--     company's row via "employees read own company", and fake a Vestmannaeyjar
--     employer for coaching auto-approval.
--   • companies.name / company_address / billing_address were writable by the
--     company's contact person, so the region evidence could be rewritten.
-- No browser code writes these (B2B binding, claims and portal edits go
-- through /api with the service role). Staff and the server pass through.
-- Idempotent.

create or replace function public.clients_guard_paid_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') or public.is_active_staff() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.company_id is not null then
      raise exception 'clients.company_id is set by the server only' using errcode = '42501';
    end if;
    if new.checkin_doctor_addon_paid_at is not null then
      raise exception 'clients.checkin_doctor_addon_paid_at is set by the server only' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.checkin_doctor_addon_paid_at is not null
     and new.checkin_doctor_addon_paid_at is distinct from old.checkin_doctor_addon_paid_at then
    raise exception 'clients.checkin_doctor_addon_paid_at is set by the server only' using errcode = '42501';
  end if;
  if new.company_id is distinct from old.company_id then
    raise exception 'clients.company_id is set by the server only' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists clients_guard_paid_columns on public.clients;
create trigger clients_guard_paid_columns
  before insert or update on public.clients
  for each row execute function public.clients_guard_paid_columns();

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
    'followup_completed_at', 'roster_confirmed_at',
    'name', 'company_address', 'billing_address'
  ];
  priced text[] := array[
    'assessment_unit_price', 'app_price_isk_monthly', 'followup_doctor_price',
    'hc_price_isk', 'hc_price_locked_until', 'applied_discount_code', 'admin_notes',
    'company_address', 'billing_address'
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
