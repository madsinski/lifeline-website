-- The client's side of the action plan: what they actually did, and what they
-- asked to change. The plan itself stays in hc_action_plans.modules (each
-- action has a stable uid); these tables hang off those uids.
--
--   hc_action_logs  — one row per action per day the client ticked it
--   hc_action_prefs — the client's adjustments: hidden actions, personal note
--
-- The client writes these from /account (API-mediated, own journey only) and
-- the workstation reads them to see how the plan is going.

create table if not exists public.hc_action_logs (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null references public.hc_journeys(id) on delete cascade,
  client_id   uuid not null,
  action_uid  text not null,
  done_on     date not null,
  created_at  timestamptz not null default now(),
  unique (journey_id, action_uid, done_on)
);

create index if not exists hc_action_logs_journey_idx on public.hc_action_logs (journey_id, done_on desc);

create table if not exists public.hc_action_prefs (
  journey_id  uuid not null references public.hc_journeys(id) on delete cascade,
  client_id   uuid not null,
  action_uid  text not null,
  hidden      boolean not null default false,
  note        text,
  updated_at  timestamptz not null default now(),
  primary key (journey_id, action_uid)
);

alter table public.hc_action_logs enable row level security;
drop policy if exists "hc_action_logs no client access" on public.hc_action_logs;
create policy "hc_action_logs no client access"
  on public.hc_action_logs for all using (false) with check (false);

alter table public.hc_action_prefs enable row level security;
drop policy if exists "hc_action_prefs no client access" on public.hc_action_prefs;
create policy "hc_action_prefs no client access"
  on public.hc_action_prefs for all using (false) with check (false);
