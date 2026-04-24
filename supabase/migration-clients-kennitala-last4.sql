-- =============================================================
-- clients.kennitala_last4 — last four digits of the national ID.
--
-- Used by the admin bulk-create / bulk-invite flows to identify
-- a person when combined with full_name (we can't store the full
-- kennitala plaintext on clients without encryption, but the last
-- four are low-sensitivity and useful for disambiguation).
-- Already referenced in:
--   • /api/admin/biody/bulk-create (writes on insert)
--   • /api/admin/biody/convert-to-b2b (reads)
--   • /api/admin/clients/bulk-invite (writes on upsert)
--   • /api/admin/companies/[id]/export (reads for CSV)
-- The company_members mirror has had this column for a while; this
-- adds it on the clients row itself so the bulk flows stop crashing
-- with "Could not find the 'kennitala_last4' column of 'clients'".
-- =============================================================

alter table public.clients
  add column if not exists kennitala_last4 text;

-- Guardrails — keep it strictly 4 digits when present.
alter table public.clients
  drop constraint if exists clients_kennitala_last4_format;
alter table public.clients
  add constraint clients_kennitala_last4_format
    check (kennitala_last4 is null or kennitala_last4 ~ '^[0-9]{4}$');

-- Look-ups by last-four are used in admin search.
create index if not exists idx_clients_kennitala_last4
  on public.clients (kennitala_last4)
  where kennitala_last4 is not null;

-- PostgREST normally reloads its schema cache on DDL, but nudge it
-- explicitly so the API picks up the new column without a restart.
notify pgrst, 'reload schema';
