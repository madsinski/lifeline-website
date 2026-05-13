-- =============================================================
-- list_all_companies: also return contact_full_name so the admin
-- companies card can show the human name under "Contact" (the
-- email already comes back).
--
-- Resolution order for the name:
--   1. clients.full_name (if the contact person has a clients row)
--   2. auth.users.raw_user_meta_data->>'full_name' (signup metadata)
-- Falls back to NULL — UI shows the draft name (contact_draft_name)
-- or em-dash in that case.
-- =============================================================

drop function if exists public.list_all_companies();

create or replace function public.list_all_companies()
returns table (
  id uuid,
  name text,
  contact_person_id uuid,
  contact_email text,
  contact_full_name text,
  created_at timestamptz,
  member_count int,
  invited_count int,
  completed_count int
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.staff s where s.id = auth.uid() and s.active = true) then
    raise exception 'forbidden';
  end if;

  return query
    select c.id,
           c.name,
           c.contact_person_id,
           (select u.email::text from auth.users u where u.id = c.contact_person_id) as contact_email,
           coalesce(
             (select cli.full_name from public.clients cli where cli.id = c.contact_person_id),
             (select u.raw_user_meta_data->>'full_name' from auth.users u where u.id = c.contact_person_id)
           )::text as contact_full_name,
           c.created_at,
           coalesce((select count(*)::int from public.company_members m where m.company_id = c.id), 0),
           coalesce((select count(*)::int from public.company_members m where m.company_id = c.id and m.invited_at is not null), 0),
           coalesce((select count(*)::int from public.company_members m where m.company_id = c.id and m.completed_at is not null), 0)
      from public.companies c
     order by c.created_at desc;
end $$;

revoke all on function public.list_all_companies() from public;
grant execute on function public.list_all_companies() to authenticated;
