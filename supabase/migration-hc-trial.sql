-- The 14-day app trial: card on file, conversion, and the reminders.
--
-- Mads, 2026-10-15: a self-made plan unlocks the whole app for a 14-day
-- trial; a card is saved at the start so the subscription can begin when the
-- trial ends; the person is reminded by email and in the app.
--
--   subscriptions.card_saved_at  — when a card was saved for this trial, i.e.
--                                  when the person agreed that it converts to
--                                  the paid subscription at trial_ends_at.
--                                  Only rows with this set are ever charged by
--                                  the conversion cron.
--   hc_trial_notices             — one row per (subscription, kind) that was
--                                  sent: the idempotency marker for the cron,
--                                  and the source of the in-app notification
--                                  (/api/hc/notifications reads it; seen_at
--                                  clears the dot). kind 'convert' is the lock
--                                  taken before a card is charged, so a card
--                                  can never be charged twice for one trial.
--
-- Code: src/lib/hc/subscription.ts, src/app/api/hc/subscribe/route.ts,
--       src/app/api/cron/hc-trial-reminders/route.ts,
--       src/app/api/hc/notifications/route.ts
--
-- Until this is run: trials still start and run, but the cron sends nothing
-- (no marker table = no way to send once only) and no card is recorded. The
-- code logs once and carries on.
--
-- Run manually in the Supabase SQL editor. Idempotent.

alter table public.subscriptions add column if not exists card_saved_at timestamptz;
comment on column public.subscriptions.card_saved_at is
  'When a card was saved for this free-trial row: consent to convert to the paid tier at trial_ends_at. Null = no card, the trial just ends.';

create table if not exists public.hc_trial_notices (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid not null references public.subscriptions(id) on delete cascade,
  client_id        uuid not null,
  kind             text not null check (kind in ('ends_soon', 'ended', 'convert')),
  title            text,
  body             text,
  email_sent       boolean not null default false,
  push_sent        integer not null default 0,
  sent_at          timestamptz not null default now(),
  seen_at          timestamptz,
  unique (subscription_id, kind)
);
create index if not exists hc_trial_notices_client_idx on public.hc_trial_notices (client_id, sent_at desc);

alter table public.hc_trial_notices enable row level security;
drop policy if exists "hc_trial_notices no client access" on public.hc_trial_notices;
create policy "hc_trial_notices no client access" on public.hc_trial_notices
  for all using (false) with check (false);

drop policy if exists "hc_trial_notices staff read" on public.hc_trial_notices;
create policy "hc_trial_notices staff read" on public.hc_trial_notices
  for select using (public.is_active_staff());
