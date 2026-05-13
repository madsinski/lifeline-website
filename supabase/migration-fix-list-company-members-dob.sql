-- =============================================================
-- list_company_members: drop the stale c.date_of_birth reference
-- left over from stage-3 encryption.
--
-- The deployed function used c.date_of_birth in the profile_complete
-- check. That plaintext column was dropped when column encryption
-- shipped, so /admin/business → expand company → "Loading employees…"
-- errored with "column c.date_of_birth does not exist".
--
-- Fix: check c.date_of_birth_enc instead — presence of the encrypted
-- ciphertext is enough to know the user filled their DOB; we don't
-- need to decrypt to evaluate the boolean. Every other column the
-- function reads (full_name / sex / height_cm / weight_kg /
-- activity_level / biody_patient_id) is still on the base clients
-- table.
--
-- Nothing else changes — same signature, same auth gate, same join.
-- Safe to re-run.
-- =============================================================

CREATE OR REPLACE FUNCTION public.list_company_members(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  kennitala_last4 text,
  invited_at timestamptz,
  invite_sent_count int,
  completed_at timestamptz,
  profile_complete boolean,
  biody_activated boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if not exists (
    select 1 from public.companies c
    where c.id = p_company_id
      and (c.contact_person_id = auth.uid()
           or exists (select 1 from public.company_admins ca where ca.company_id = p_company_id and ca.user_id = auth.uid())
           or exists (select 1 from public.staff s where s.id = auth.uid() and s.active = true))
  ) then raise exception 'forbidden'; end if;

  return query
    select m.id,
           m.full_name,
           m.email,
           m.phone,
           public.kennitala_last4(m.kennitala_encrypted) as kennitala_last4,
           m.invited_at,
           m.invite_sent_count,
           m.completed_at,
           -- profile_complete: all onboarding fields present. DOB now
           -- lives encrypted (date_of_birth_enc); presence of the
           -- ciphertext is enough — no need to decrypt for a boolean.
           (c.full_name is not null
             and c.sex is not null
             and c.height_cm is not null
             and c.weight_kg is not null
             and c.activity_level is not null
             and c.date_of_birth_enc is not null) as profile_complete,
           (c.biody_patient_id is not null) as biody_activated,
           m.created_at
      from public.company_members m
      left join public.clients c on c.id = m.client_id
     where m.company_id = p_company_id
     order by m.created_at desc;
end $$;

revoke all on function public.list_company_members(uuid) from public;
grant execute on function public.list_company_members(uuid) to authenticated;
