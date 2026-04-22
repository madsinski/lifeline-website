-- =============================================================
-- clients.biody_placeholder_data — flag for admin-bulk-created rows
--
-- The Biody bulk-create admin tool sets height / activity level
-- (and sometimes sex) to fleet-wide defaults because the roster
-- HR shares usually doesn't include them. We flag those rows so
-- we can later:
--   1. Find them and send B2B onboarding invites to collect the
--      real data.
--   2. Display a "placeholder" badge in the admin clients list
--      so staff know measurements against these profiles carry
--      a caveat until corrected.
-- =============================================================

alter table public.clients
  add column if not exists biody_placeholder_data boolean not null default false;

create index if not exists idx_clients_biody_placeholder
  on public.clients (biody_placeholder_data)
  where biody_placeholder_data = true;
