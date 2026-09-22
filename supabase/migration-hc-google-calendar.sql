-- Google Calendar push sync for the heilsuferð — same design as the
-- Fjarlækningar HSU vaktakerfi (hsu_google_sync / hsu_google_events).
--
-- owner_kind 'client' = a customer's journey appointments (blood test,
-- measurements, interview, follow-up); 'worker' = a nurse/doctor's assigned
-- interviews in the workstation. Scope is calendar.app.created: we only ever
-- touch the one calendar we create in their account.
--
-- Read/written by src/lib/hc/calendar-sync.ts with the service role only.
-- Idempotent.

create table if not exists hc_google_sync (
  owner_kind        text not null check (owner_kind in ('client','worker')),
  owner_id          uuid not null,
  google_sub        text,
  google_email      text,
  refresh_token     text,
  access_token      text,
  access_expires_at timestamptz,
  calendar_id       text,
  enabled           boolean not null default true,
  connected_at      timestamptz,
  last_sync_at      timestamptz,
  last_error        text,
  last_error_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (owner_kind, owner_id)
);

-- One row per event we have written, so a removed/moved appointment can be
-- found and deleted, and an unchanged one costs no API call (synced_hash).
create table if not exists hc_google_events (
  owner_kind  text not null,
  owner_id    uuid not null,
  item_id     text not null,
  calendar_id text not null,
  synced_hash text not null default '',
  starts_at   timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (owner_kind, owner_id, item_id)
);

-- Personal .ics subscription for workstation users (Apple / Outlook).
alter table hc_workers add column if not exists calendar_token text unique;

do $$
declare t text;
begin
  foreach t in array array['hc_google_sync','hc_google_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "Block client access" on %I', t);
    execute format('create policy "Block client access" on %I for all using (false) with check (false)', t);
  end loop;
end $$;
