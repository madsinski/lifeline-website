-- =============================================================
-- Co-admin contact details (2026-06-01)
--
-- Give company co-admins the same identifying details the primary
-- contact already has: phone, position, and kennitala (encrypted +
-- last-4 for display). Co-admins enter these themselves at
-- /business/co-admin-setup (mirroring how the primary contact enters
-- their own at signup); the values are persisted to company_admins via
-- /api/business/co-admin-profile. Apply manually in the Supabase SQL
-- editor. Idempotent.
--
-- ⚠️  RECONCILIATION REQUIRED on list_company_admins
--     ------------------------------------------------
--     list_company_admins already exists in the live DB; its source is
--     NOT in this repo. The body below is RECONSTRUCTED from its
--     call-site contract (the `Admin` interface in
--     src/app/business/[companyId]/page.tsx returns
--     { user_id, full_name, email, added_at, is_primary }). Before
--     running the CREATE OR REPLACE, open your live list_company_admins
--     and compare.
--
--     If your live version differs (e.g. it does NOT union the primary
--     contact from companies, or company_admins already stores the
--     primary row), DO NOT replace it wholesale. Instead just ADD these
--     three output columns to its RETURNS TABLE and SELECT list:
--         phone           -> co-admin: company_admins.phone
--                            primary : companies.contact_phone
--         position        -> co-admin: company_admins.position
--                            primary : companies.contact_position
--         kennitala_last4 -> co-admin: company_admins.kennitala_last4
--                            primary : companies.contact_kennitala_last4
--
--     The column additions below are safe and certain — run them
--     regardless.
-- =============================================================

begin;

-- ── Co-admin detail columns (SAFE — run regardless) ─────────────────
alter table public.company_admins
  add column if not exists phone               text,
  add column if not exists "position"          text,
  add column if not exists kennitala_encrypted bytea,
  add column if not exists kennitala_last4     text;

-- ── list_company_admins — RECONSTRUCTED, see reconciliation note ────
-- Returns the primary contact (from companies) + every co-admin (from
-- company_admins) for a company, each with name/email/phone/position/
-- kennitala_last4. Phone/position for co-admins fall back to the values
-- they saved in auth user_metadata before this migration existed.
-- Adding OUT columns changes the return type, which CREATE OR REPLACE can't
-- do — drop the old signature first. (uuid arg, so this targets the one we mean.)
drop function if exists public.list_company_admins(uuid);

create or replace function public.list_company_admins(p_company_id uuid)
returns table(
  user_id         uuid,
  full_name       text,
  email           text,
  added_at        timestamptz,
  is_primary      boolean,
  phone           text,
  "position"      text,
  kennitala_last4 text
)
language sql security definer set search_path = public, auth as $$
  -- Primary contact person (lives on companies, not company_admins)
  select
    c.contact_person_id                              as user_id,
    (u.raw_user_meta_data->>'full_name')             as full_name,
    u.email::text                                    as email,
    c.created_at                                     as added_at,
    true                                             as is_primary,
    c.contact_phone                                  as phone,
    c.contact_position                               as "position",
    c.contact_kennitala_last4                        as kennitala_last4
  from public.companies c
  join auth.users u on u.id = c.contact_person_id
  where c.id = p_company_id
    and c.contact_person_id is not null

  union all

  -- Co-admins
  select
    ca.user_id,
    (u.raw_user_meta_data->>'full_name')             as full_name,
    u.email::text                                    as email,
    ca.added_at,
    false                                            as is_primary,
    coalesce(ca.phone,      u.raw_user_meta_data->>'phone')    as phone,
    coalesce(ca."position", u.raw_user_meta_data->>'position') as "position",
    ca.kennitala_last4
  from public.company_admins ca
  join auth.users u on u.id = ca.user_id
  where ca.company_id = p_company_id
    -- guard against the primary also appearing in company_admins
    and ca.user_id is distinct from (
      select c2.contact_person_id from public.companies c2 where c2.id = p_company_id
    )
  order by is_primary desc, added_at;
$$;

grant execute on function public.list_company_admins(uuid) to authenticated;

commit;
