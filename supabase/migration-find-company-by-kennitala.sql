-- Match a PayDay customer to a company by kennitala (added 2026-06-13),
-- so "Import from PayDay" can link customers whose PayDay customer id
-- was never stored in our DB. Matches on the last 4 of the kennitala via
-- the existing kennitala_last4() helper, and only when exactly one
-- company matches (no ambiguous links).
--
-- Apply manually in the Supabase SQL editor. Idempotent.

create or replace function public.find_company_by_kennitala(p_kt text)
returns uuid
language plpgsql
security definer
stable
as $$
declare
  v uuid;
  n int;
  l4 text := right(regexp_replace(coalesce(p_kt, ''), '\D', '', 'g'), 4);
begin
  if length(l4) < 4 then return null; end if;
  select count(*) into n from public.companies
    where kennitala_encrypted is not null and public.kennitala_last4(kennitala_encrypted) = l4;
  if n <> 1 then return null; end if;
  select id into v from public.companies
    where kennitala_encrypted is not null and public.kennitala_last4(kennitala_encrypted) = l4;
  return v;
end $$;

grant execute on function public.find_company_by_kennitala(text) to authenticated, service_role;
