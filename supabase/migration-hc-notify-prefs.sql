-- "Tilkynningar frá Lifeline": how a participant wants to hear from staff
-- (messages, requests such as leave to put their report in) — separate from
-- the daily habit reminders in hc_nudge_prefs, which stay opt-in.
--
--   hc_notify_prefs   one row per participant; no row = all on (a message
--                     from a nurse is a person waiting, not a schedule).
--   hc_journeys.staff_import_consent_requested_at / _request_seen_at
--                     the nurse asked for leave to put the report in; the
--                     in-app notification is unread until seen, and the
--                     request stands until consent is given.
--
-- Code: src/lib/hc/notify.ts, src/app/api/hc/notify-prefs, src/app/api/hc/notifications,
--       src/app/api/vinnustod/journeys/[id] (request_staff_import_consent)
-- Idempotent. Applied with `supabase db query --linked -f`.

create table if not exists public.hc_notify_prefs (
  client_id   uuid primary key,
  push        boolean not null default true,
  sms         boolean not null default true,
  email       boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table public.hc_notify_prefs enable row level security;
drop policy if exists "hc_notify_prefs no client access" on public.hc_notify_prefs;
create policy "hc_notify_prefs no client access" on public.hc_notify_prefs for all using (false) with check (false);

alter table public.hc_journeys add column if not exists staff_import_consent_requested_at timestamptz;
alter table public.hc_journeys add column if not exists staff_import_consent_request_seen_at timestamptz;
