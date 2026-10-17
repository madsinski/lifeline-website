-- "Lifeline þjálfun" is approved by Lifeline before anybody pays (Mads, 2026-10-17).
--
-- The tier is sold in Vestmannaeyjar only. The postcode in the person's own
-- address is still required to ask (src/lib/hc/coaching.ts), but an address
-- is typed by the person, so a worker confirms the request before the
-- payment step opens. Evident cases (employer in Vestmannaeyjar, a completed
-- measurement at the Vestmannaeyjar station) are approved by the server at
-- request time and recorded as such.
--
--   hc_coaching_requests   one row per request. status:
--                            pending    waiting for a worker
--                            approved   may pay until expires_at
--                            declined   decline_reason is shown to the person
--                            cancelled  withdrawn by the person
--                            used       the subscription started (fulfil.ts)
--                          decision_seen_at drives the red dot in the app's
--                          notification list (/api/hc/notifications).
--
-- Code: src/lib/hc/coaching-requests.ts, src/app/api/hc/coaching-request,
--       src/app/api/vinnustod/coaching-requests, src/app/api/hc/subscribe,
--       src/lib/hc/fulfil.ts (marks 'used').
-- Access: API only (service role). Staff may read for the admin UI.
-- Idempotent. Applied with `supabase db query --linked -f`.

create table if not exists public.hc_coaching_requests (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null,
  status            text not null default 'pending',
  postcode          text,
  town              text,
  evidence          jsonb not null default '{}'::jsonb,
  auto_approved     boolean not null default false,
  decided_by        text,
  decided_at        timestamptz,
  decline_reason    text,
  decision_seen_at  timestamptz,
  used_at           timestamptz,
  subscription_id   uuid,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz
);

alter table public.hc_coaching_requests drop constraint if exists hc_coaching_requests_status_check;
alter table public.hc_coaching_requests add constraint hc_coaching_requests_status_check
  check (status in ('pending', 'approved', 'declined', 'cancelled', 'used'));
alter table public.hc_coaching_requests drop constraint if exists hc_coaching_requests_reason_len;
alter table public.hc_coaching_requests add constraint hc_coaching_requests_reason_len
  check (decline_reason is null or char_length(decline_reason) <= 500);

-- One pending request per person.
create unique index if not exists uq_hc_coaching_requests_pending
  on public.hc_coaching_requests (client_id) where status = 'pending';
create index if not exists idx_hc_coaching_requests_client
  on public.hc_coaching_requests (client_id, created_at desc);
create index if not exists idx_hc_coaching_requests_open
  on public.hc_coaching_requests (created_at) where status = 'pending';

alter table public.hc_coaching_requests enable row level security;
drop policy if exists "hc_coaching_requests no client access" on public.hc_coaching_requests;
create policy "hc_coaching_requests no client access" on public.hc_coaching_requests
  for all using (false) with check (false);
drop policy if exists "hc_coaching_requests staff read" on public.hc_coaching_requests;
create policy "hc_coaching_requests staff read" on public.hc_coaching_requests
  for select using (public.is_active_staff());
