-- Opt-in reminders for heilsuferð participants (src/app/api/cron/hc-nudges).
--
--   hc_nudge_prefs          — one row per participant: which channels, what
--                             hour (Iceland = UTC), how often
--   hc_push_subscriptions   — Web Push endpoints, one per device/browser
--
-- Nothing is sent unless the participant turned it on. API-only (RLS blocks
-- direct client access). Idempotent.

create table if not exists public.hc_nudge_prefs (
  client_id     uuid primary key,
  channels      text[] not null default '{}',       -- push | email | sms
  hour          int not null default 8 check (hour between 5 and 22),
  mode          text not null default 'daily' check (mode in ('daily', 'behind', 'weekly')),
  paused_until  date,
  last_sent_on  date,
  updated_at    timestamptz not null default now()
);

create table if not exists public.hc_push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index if not exists hc_push_subscriptions_client_idx on public.hc_push_subscriptions (client_id);

alter table public.hc_nudge_prefs enable row level security;
drop policy if exists "hc_nudge_prefs no client access" on public.hc_nudge_prefs;
create policy "hc_nudge_prefs no client access" on public.hc_nudge_prefs for all using (false) with check (false);

alter table public.hc_push_subscriptions enable row level security;
drop policy if exists "hc_push_subscriptions no client access" on public.hc_push_subscriptions;
create policy "hc_push_subscriptions no client access" on public.hc_push_subscriptions for all using (false) with check (false);
